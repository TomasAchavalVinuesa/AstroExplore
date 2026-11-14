import type {
  CollectionQueryMode,
  CollectionVersionData,
  ColormapName,
  MultiVersionSearchResponse,
  RenderedCutout,
  SearchResponse,
  SpherexCollectionId,
  SpherexObservation,
  StretchMode,
} from "./types";
import { decompressIfNeeded } from "./fits";
import { renderFitsBufferAsync } from "./fitsWorkerClient";
import { mjdToUtc } from "./coordinates";

const IRSA_ORIGIN = "https://irsa.ipac.caltech.edu";
const FITS_CACHE_NAME = "spherex-fits-v1";
const MAX_CONCURRENT_HIGH_DOWNLOADS = 2;
const MAX_CONCURRENT_TOTAL_DOWNLOADS = 2;
const SIA_TIMEOUT_MS = 35_000;
const FITS_TIMEOUT_MS = 60_000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

export type RequestPriority = "high" | "low";

// Caché en memoria de consultas SIA para respuesta instantánea al paginar o repetir coordenadas
const siaQueryCache = new Map<string, SpherexObservation[]>();
const MAX_SIA_CACHE_ENTRIES = 30;

export const SPHEREX_COLLECTIONS: readonly SpherexCollectionId[] = [
  "spherex_dr1",
] as const;

/**
 * Convierte una URL absoluta de IRSA al proxy local de Vite si estamos en entorno dev/proxy,
 * o la mantiene si se invoca directo.
 */
function toProxyUrl(url: string): string {
  if (url.startsWith(IRSA_ORIGIN)) {
    return url.replace(IRSA_ORIGIN, "/irsa-proxy");
  }
  return url;
}

// Recordar en la sesión si el proxy local /irsa-proxy está operativo para evitar fallbacks repetidos
let proxyAvailable: boolean | null = null;

function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Request timeout", "TimeoutError"));
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort(signal?.reason ?? new DOMException("Aborted", "AbortError"));
  };

  if (signal) {
    if (signal.aborted) {
      onExternalAbort();
    } else {
      signal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);
    },
  };
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function fetchIrsaSingleAttempt(
  officialUrl: string,
  externalSignal?: AbortSignal,
  timeoutMs = FITS_TIMEOUT_MS
): Promise<Response> {
  if (externalSignal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const { signal, cleanup } = combineSignals(externalSignal, timeoutMs);
  try {
    if (proxyAvailable !== false) {
      const proxyUrl = toProxyUrl(officialUrl);
      if (proxyUrl !== officialUrl) {
        try {
          const res = await fetch(proxyUrl, { signal });
          if (res.ok) {
            proxyAvailable = true;
            return res;
          }
          // 404 en hosting estático sin proxy Vite: desactivar proxy para esta sesión
          if (res.status === 404) {
            proxyAvailable = false;
          } else {
            return res;
          }
        } catch (err) {
          if (externalSignal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
            throw err;
          }
          if (proxyAvailable === null) {
            proxyAvailable = false;
          }
        }
      }
    }

    return await fetch(officialUrl, { signal });
  } finally {
    cleanup();
  }
}

async function fetchIrsaWithFallback(
  officialUrl: string,
  externalSignal?: AbortSignal,
  timeoutMs = FITS_TIMEOUT_MS
): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    if (externalSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (attempt > 0) {
      await sleepWithSignal(RETRY_BASE_DELAY_MS * attempt, externalSignal);
    }

    try {
      const res = await fetchIrsaSingleAttempt(officialUrl, externalSignal, timeoutMs);
      if (res.ok) {
        return res;
      }
      // Si el servidor IBE responde 503/502/429 ("Server busy, retry later"), reintentar con backoff
      if ((res.status === 503 || res.status === 502 || res.status === 504 || res.status === 429) && attempt < MAX_RETRY_ATTEMPTS) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      if (externalSignal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        throw err;
      }
      lastError = err;
      if (attempt >= MAX_RETRY_ATTEMPTS) {
        throw err;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Error de red consultando IRSA");
}

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function toFloat(val: string | undefined): number | null {
  if (!val) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function toMicrons(val: string | undefined): number | null {
  const m = toFloat(val);
  return m !== null ? Number((m * 1e6).toFixed(3)) : null;
}

/**
 * Consulta el servicio SIA de IRSA para una colección específica.
 * Intenta primero desde la caché en memoria, luego por el proxy y si falla intenta directo.
 */
export async function querySpherexSIA(params: {
  ra: number;
  dec: number;
  radius: number;
  collection: string;
  band: string;
  limit?: number;
}): Promise<SearchResponse> {
  const { ra, dec, radius, collection, band, limit = 500 } = params;

  const urlParams = new URLSearchParams({
    COLLECTION: collection,
    POS: `circle ${ra} ${dec} ${radius}`,
    RESPONSEFORMAT: "CSV",
  });
  const officialSiaUrl = `${IRSA_ORIGIN}/SIA?${urlParams.toString()}`;
  const siaCacheKey = `${collection}|${ra.toFixed(6)}|${dec.toFixed(6)}|${radius.toFixed(4)}`;

  let allObservations = siaQueryCache.get(siaCacheKey);

  if (!allObservations) {
    const res = await fetchIrsaWithFallback(officialSiaUrl, undefined, SIA_TIMEOUT_MS);

    if (!res.ok) {
      throw new Error(`IRSA SIA respondió con status HTTP ${res.status}`);
    }

    const csvText = await res.text();
    const rows = parseCsvRows(csvText);

    const parsed: SpherexObservation[] = [];

    for (const row of rows) {
      const accessUrl = (row.access_url ?? "").trim();
      if (!accessUrl) continue;

      const bandpass = (row.energy_bandpassname ?? "").trim();
      const tMin = toFloat(row.t_min);
      const tMax = toFloat(row.t_max);
      const utc = mjdToUtc(tMin);

      parsed.push({
        obs_id: row.obs_id ?? "",
        bandpass,
        em_min_um: toMicrons(row.em_min),
        em_max_um: toMicrons(row.em_max),
        s_ra: toFloat(row.s_ra),
        s_dec: toFloat(row.s_dec),
        t_exptime: toFloat(row.t_exptime),
        t_min: tMin,
        t_max: tMax,
        epoch_date: utc?.date ?? null,
        epoch_datetime: utc?.dateTime ?? null,
        obs_release_date: row.obs_release_date ?? "",
        obs_collection: row.obs_collection || collection,
        s_pixel_scale: toFloat(row.s_pixel_scale),
        access_url: accessUrl,
        s_region: (row.s_region ?? "").trim() || undefined,
      });
    }

    parsed.sort((a, b) => {
      const tA = a.t_min ?? Number.MAX_SAFE_INTEGER;
      const tB = b.t_min ?? Number.MAX_SAFE_INTEGER;
      if (tA !== tB) return tA - tB;
      return `${a.bandpass}:${a.obs_id}`.localeCompare(`${b.bandpass}:${b.obs_id}`);
    });

    allObservations = parsed;
    if (siaQueryCache.size >= MAX_SIA_CACHE_ENTRIES) {
      const oldestKey = siaQueryCache.keys().next().value;
      if (oldestKey) siaQueryCache.delete(oldestKey);
    }
    siaQueryCache.set(siaCacheKey, allObservations);
  }

  const targetBand = band.toUpperCase();
  const observations =
    targetBand === "ALL"
      ? allObservations
      : allObservations.filter((o) => o.bandpass.toUpperCase().endsWith(targetBand));

  return {
    query: { ra, dec, radius, collection, band },
    sia_url: officialSiaUrl,
    total_found: observations.length,
    observations: observations.slice(0, limit),
  };
}

/**
 * Consulta la colección DR1 Wide de SPHEREx (`spherex_dr1`) en IRSA SIA
 * para descubrir y agrupar las imágenes disponibles para las coordenadas dadas.
 */
export async function queryAllSpherexVersions(params: {
  ra: number;
  dec: number;
  radius: number;
  collectionMode: CollectionQueryMode;
  band: string;
  limitPerCollection?: number;
}): Promise<MultiVersionSearchResponse> {
  const { ra, dec, radius, collectionMode, band, limitPerCollection = 500 } = params;

  const collectionsToQuery: SpherexCollectionId[] = [collectionMode];

  const settled = await Promise.allSettled(
    SPHEREX_COLLECTIONS.map(async (col): Promise<CollectionVersionData> => {
      if (!collectionsToQuery.includes(col)) {
        const emptyParams = new URLSearchParams({
          COLLECTION: col,
          POS: `circle ${ra} ${dec} ${radius}`,
          RESPONSEFORMAT: "CSV",
        });
        return {
          collection: col,
          sia_url: `${IRSA_ORIGIN}/SIA?${emptyParams.toString()}`,
          total_found: 0,
          observations: [],
          bandsAvailable: [],
        };
      }

      const res = await querySpherexSIA({
        ra,
        dec,
        radius,
        collection: col,
        band,
        limit: limitPerCollection,
      });

      const bandsSet = new Set<string>();
      for (const obs of res.observations) {
        if (obs.bandpass) bandsSet.add(obs.bandpass);
      }

      return {
        collection: col,
        sia_url: res.sia_url,
        total_found: res.total_found,
        observations: res.observations,
        bandsAvailable: Array.from(bandsSet).sort(),
      };
    })
  );

  const versions = {} as Record<SpherexCollectionId, CollectionVersionData>;
  let totalAcrossVersions = 0;
  const availableCollections: SpherexCollectionId[] = [];

  SPHEREX_COLLECTIONS.forEach((col, idx) => {
    const item = settled[idx];
    if (item.status === "fulfilled") {
      versions[col] = item.value;
      totalAcrossVersions += item.value.total_found;
      if (item.value.observations.length > 0) {
        availableCollections.push(col);
      }
    } else {
      versions[col] = {
        collection: col,
        sia_url: `${IRSA_ORIGIN}/SIA?COLLECTION=${col}`,
        total_found: 0,
        observations: [],
        bandsAvailable: [],
      };
    }
  });

  let recommendedCollection: SpherexCollectionId = collectionMode;

  if (
    versions[collectionMode].observations.length === 0 &&
    availableCollections.length > 0
  ) {
    recommendedCollection = availableCollections[0];
  }

  return {
    query: { ra, dec, radius, collectionMode, band },
    versions,
    totalAcrossVersions,
    availableCollections,
    recommendedCollection,
  };
}

// Caché LRU de buffers FITS en memoria del navegador
const fitsBufferCache = new Map<string, ArrayBuffer>();
const MAX_CACHE_SIZE = 80;

function putInMemoryCache(cacheKey: string, buffer: ArrayBuffer): void {
  if (fitsBufferCache.has(cacheKey)) {
    fitsBufferCache.delete(cacheKey);
  }
  fitsBufferCache.set(cacheKey, buffer);
  if (fitsBufferCache.size > MAX_CACHE_SIZE) {
    const oldest = fitsBufferCache.keys().next().value;
    if (oldest) fitsBufferCache.delete(oldest);
  }
}

function getFromMemoryCache(cacheKey: string): ArrayBuffer | undefined {
  const buf = fitsBufferCache.get(cacheKey);
  if (buf) {
    // Reinsertar para mantener el orden LRU
    fitsBufferCache.delete(cacheKey);
    fitsBufferCache.set(cacheKey, buf);
  }
  return buf;
}

// Caché persistente en Cache API del navegador (sobrevive recargas)
function getPersistentCacheUrl(cacheKey: string): string {
  return `https://spherex-local-cache.invalid/${encodeURIComponent(cacheKey)}`;
}

async function readFromPersistentCache(cacheKey: string): Promise<ArrayBuffer | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(FITS_CACHE_NAME);
    const match = await cache.match(getPersistentCacheUrl(cacheKey));
    if (!match) return null;
    return await match.arrayBuffer();
  } catch {
    return null;
  }
}

async function writeToPersistentCache(cacheKey: string, buffer: ArrayBuffer): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(FITS_CACHE_NAME);
    await cache.put(
      getPersistentCacheUrl(cacheKey),
      new Response(buffer.slice(0), {
        headers: { "Content-Type": "application/octet-stream" },
      })
    );
  } catch {
    // Ignorar errores de cuota o modo privado
  }
}

// Cola de prioridad para descargas de red FITS con reserva exclusiva para el visor principal
interface QueuedTask {
  priority: RequestPriority;
  run: () => void;
}

const downloadQueue: QueuedTask[] = [];
let activeHighDownloads = 0;
let activeLowDownloads = 0;

function drainDownloadQueue(): void {
  while (downloadQueue.length > 0) {
    const totalActive = activeHighDownloads + activeLowDownloads;
    if (totalActive >= MAX_CONCURRENT_TOTAL_DOWNLOADS) break;

    // 1. Siempre despachar primero tareas de alta prioridad (visor principal)
    const highIdx = downloadQueue.findIndex((t) => t.priority === "high");
    if (highIdx !== -1 && activeHighDownloads < MAX_CONCURRENT_HIGH_DOWNLOADS) {
      const [task] = downloadQueue.splice(highIdx, 1);
      activeHighDownloads++;
      task.run();
      continue;
    }

    // 2. Solo despachar tareas de baja prioridad (galería/épocas/prefetch) si no hay tareas "high" activas ni en espera
    if (highIdx === -1 && activeHighDownloads === 0 && activeLowDownloads < 1) {
      const [task] = downloadQueue.splice(0, 1);
      activeLowDownloads++;
      task.run();
      continue;
    }

    break;
  }
}

function scheduleDownload<T>(priority: RequestPriority, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    downloadQueue.push({
      priority,
      run: () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            if (priority === "high") {
              activeHighDownloads--;
            } else {
              activeLowDownloads--;
            }
            drainDownloadQueue();
          });
      },
    });
    drainDownloadQueue();
  });
}

// Deduplicación de descargas en vuelo con conteo de suscriptores para cancelación segura
interface InFlightEntry {
  promise: Promise<ArrayBuffer>;
  controller: AbortController;
  subscribers: number;
  priority: RequestPriority;
}

const inFlightDownloads = new Map<string, InFlightEntry>();

function buildCutoutUrlAndKey(accessUrl: string, ra: number, dec: number, size: number) {
  // gzip=false evita la compresión GZIP síncrona en los servidores IBE de IRSA (~3x más rápido)
  const officialCutoutUrl = `${accessUrl}?center=${ra},${dec}d&size=${size}&gzip=false`;
  const cacheKey = `${accessUrl}|${ra.toFixed(6)}|${dec.toFixed(6)}|${size.toFixed(4)}`;
  return { officialCutoutUrl, cacheKey };
}

async function fetchFitsBuffer(options: {
  officialCutoutUrl: string;
  cacheKey: string;
  priority: RequestPriority;
  signal?: AbortSignal;
}): Promise<ArrayBuffer> {
  const { officialCutoutUrl, cacheKey, priority, signal } = options;

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  // 1. Caché en memoria (síncrona)
  const memHit = getFromMemoryCache(cacheKey);
  if (memHit) return memHit;

  // 2. Caché persistente (Cache API)
  const diskHit = await readFromPersistentCache(cacheKey);
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  if (diskHit) {
    putInMemoryCache(cacheKey, diskHit);
    return diskHit;
  }

  // 3. Deduplicación en vuelo o nueva descarga en cola con prioridad
  let entry = inFlightDownloads.get(cacheKey);
  if (!entry) {
    const controller = new AbortController();
    const downloadPromise = scheduleDownload(priority, async () => {
      const res = await fetchIrsaWithFallback(officialCutoutUrl, controller.signal, FITS_TIMEOUT_MS);
      if (!res.ok) {
        throw new Error(`IRSA IBE Cutout respondió con status HTTP ${res.status}`);
      }
      const rawArrayBuffer = await res.arrayBuffer();
      const buffer = await decompressIfNeeded(rawArrayBuffer);
      putInMemoryCache(cacheKey, buffer);
      void writeToPersistentCache(cacheKey, buffer);
      return buffer;
    }).finally(() => {
      inFlightDownloads.delete(cacheKey);
    });

    entry = {
      promise: downloadPromise,
      controller,
      subscribers: 0,
      priority,
    };
    inFlightDownloads.set(cacheKey, entry);
  }

  entry.subscribers++;

  if (!signal) {
    try {
      return await entry.promise;
    } finally {
      entry.subscribers--;
    }
  }

  return await new Promise<ArrayBuffer>((resolve, reject) => {
    let settled = false;

    const onAbort = () => {
      if (settled) return;
      settled = true;
      entry!.subscribers--;
      // Solo abortar la petición HTTP si ningún otro componente la necesita
      if (entry!.subscribers <= 0) {
        entry!.controller.abort(signal.reason ?? new DOMException("Aborted", "AbortError"));
      }
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });

    entry!.promise.then(
      (buf) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", onAbort);
        entry!.subscribers--;
        resolve(buf);
      },
      (err) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", onAbort);
        entry!.subscribers--;
        reject(err);
      }
    );
  });
}

export async function getRenderedCutout(options: {
  accessUrl: string;
  ra: number;
  dec: number;
  size: number;
  stretch: StretchMode;
  colormap: ColormapName;
  subtractZodi: boolean;
  priority?: RequestPriority;
  signal?: AbortSignal;
}): Promise<RenderedCutout> {
  const {
    accessUrl,
    ra,
    dec,
    size,
    stretch,
    colormap,
    subtractZodi,
    priority = "high",
    signal,
  } = options;

  const { officialCutoutUrl, cacheKey } = buildCutoutUrlAndKey(accessUrl, ra, dec, size);
  const buffer = await fetchFitsBuffer({
    officialCutoutUrl,
    cacheKey,
    priority,
    signal,
  });

  return renderFitsBufferAsync(
    buffer,
    {
      stretch,
      colormap,
      subtractZodi,
      fitsCutoutUrl: officialCutoutUrl,
    },
    signal
  );
}

/**
 * Precarga en segundo plano (baja prioridad) un recorte FITS en caché sin renderizarlo.
 */
export function prefetchFitsCutout(options: {
  accessUrl: string;
  ra: number;
  dec: number;
  size: number;
  signal?: AbortSignal;
}): void {
  const { accessUrl, ra, dec, size, signal } = options;
  const { officialCutoutUrl, cacheKey } = buildCutoutUrlAndKey(accessUrl, ra, dec, size);
  if (getFromMemoryCache(cacheKey) || inFlightDownloads.has(cacheKey)) {
    return;
  }
  void fetchFitsBuffer({
    officialCutoutUrl,
    cacheKey,
    priority: "low",
    signal,
  }).catch(() => {
    // Prefetch silencioso: ignorar errores o cancelaciones
  });
}
