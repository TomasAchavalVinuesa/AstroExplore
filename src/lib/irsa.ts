import type {
  ColormapName,
  RenderedCutout,
  SearchResponse,
  SpherexObservation,
  StretchMode,
  TargetPreset,
} from "./types";
import { decompressIfNeeded, renderFitsBuffer } from "./fits";

const IRSA_ORIGIN = "https://irsa.ipac.caltech.edu";

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

export const TARGET_PRESETS: TargetPreset[] = [
  {
    label: "Objetivo Test (HMS/DMS)",
    category: "Sexagesimal",
    ra: "08h55m10.831s",
    dec: "-7d14m42.53s",
    collection: "spherex_dr1",
    description: "Coordenadas astronómicas en formato sexagesimal.",
  },
  {
    label: "Galaxia M101 (Molinete)",
    category: "Galaxias",
    ra: "210.80227",
    dec: "54.34895",
    collection: "spherex_dr1",
    description: "Gran galaxia espiral en la Osa Mayor.",
  },
  {
    label: "Galaxia M51 (Remolino)",
    category: "Galaxias",
    ra: "202.46958",
    dec: "47.19526",
    collection: "spherex_dr1",
    description: "Galaxia interactuando con NGC 5195.",
  },
  {
    label: "Vela / Carina",
    category: "Plano Galáctico",
    ra: "127.69444",
    dec: "-39.17760",
    collection: "spherex_dr1",
    description: "Región rica en emisión interestelar e infrarroja.",
  },
  {
    label: "Campo Profundo NEP",
    category: "Deep Survey",
    ra: "270.0",
    dec: "66.0",
    collection: "spherex_dr1_deep",
    description: "Polo Eclíptico Norte (North Ecliptic Pole).",
  },
];

/**
 * Consulta el servicio SIA de IRSA. Intenta primero por el proxy y si falla intenta directo.
 */
export async function querySpherexSIA(params: {
  ra: number;
  dec: number;
  radius: number;
  collection: string;
  band: string;
  limit?: number;
}): Promise<SearchResponse> {
  const { ra, dec, radius, collection, band, limit = 80 } = params;

  const urlParams = new URLSearchParams({
    COLLECTION: collection,
    POS: `circle ${ra} ${dec} ${radius}`,
    RESPONSEFORMAT: "CSV",
  });
  const officialSiaUrl = `${IRSA_ORIGIN}/SIA?${urlParams.toString()}`;
  const proxySiaUrl = toProxyUrl(officialSiaUrl);

  let res: Response;
  try {
    res = await fetch(proxySiaUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    // Fallback directo por si está en hosting externo con CORS habilitado
    res = await fetch(officialSiaUrl);
  }

  if (!res.ok) {
    throw new Error(`IRSA SIA respondió con status HTTP ${res.status}`);
  }

  const csvText = await res.text();
  const rows = parseCsvRows(csvText);

  const observations: SpherexObservation[] = [];
  const targetBand = band.toUpperCase();

  for (const row of rows) {
    const accessUrl = (row.access_url ?? "").trim();
    if (!accessUrl) continue;

    const bandpass = (row.energy_bandpassname ?? "").trim();
    if (targetBand !== "ALL" && !bandpass.toUpperCase().endsWith(targetBand)) {
      continue;
    }

    observations.push({
      obs_id: row.obs_id ?? "",
      bandpass,
      em_min_um: toMicrons(row.em_min),
      em_max_um: toMicrons(row.em_max),
      s_ra: toFloat(row.s_ra),
      s_dec: toFloat(row.s_dec),
      t_exptime: toFloat(row.t_exptime),
      obs_release_date: row.obs_release_date ?? "",
      obs_collection: row.obs_collection || collection,
      s_pixel_scale: toFloat(row.s_pixel_scale),
      access_url: accessUrl,
    });
  }

  observations.sort((a, b) => `${a.bandpass}:${a.obs_id}`.localeCompare(`${b.bandpass}:${b.obs_id}`));

  return {
    query: { ra, dec, radius, collection, band },
    sia_url: officialSiaUrl,
    total_found: observations.length,
    observations: observations.slice(0, limit),
  };
}

// Caché LRU de buffers FITS en memoria del navegador
const fitsBufferCache = new Map<string, ArrayBuffer>();
const MAX_CACHE_SIZE = 20;

export async function getRenderedCutout(options: {
  accessUrl: string;
  ra: number;
  dec: number;
  size: number;
  stretch: StretchMode;
  colormap: ColormapName;
  subtractZodi: boolean;
}): Promise<RenderedCutout> {
  const { accessUrl, ra, dec, size, stretch, colormap, subtractZodi } = options;

  const officialCutoutUrl = `${accessUrl}?center=${ra},${dec}d&size=${size}`;
  const cacheKey = `${accessUrl}|${ra.toFixed(6)}|${dec.toFixed(6)}|${size.toFixed(4)}`;

  let buffer = fitsBufferCache.get(cacheKey);

  if (!buffer) {
    const fetchUrl = toProxyUrl(officialCutoutUrl);
    let res: Response;
    try {
      res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      res = await fetch(officialCutoutUrl);
    }

    if (!res.ok) {
      throw new Error(`IRSA IBE Cutout respondió con status HTTP ${res.status}`);
    }

    const rawArrayBuffer = await res.arrayBuffer();
    buffer = await decompressIfNeeded(rawArrayBuffer);

    fitsBufferCache.set(cacheKey, buffer);
    if (fitsBufferCache.size > MAX_CACHE_SIZE) {
      const oldest = fitsBufferCache.keys().next().value;
      if (oldest) fitsBufferCache.delete(oldest);
    }
  } else {
    // Reinsertar para mantener el orden LRU
    fitsBufferCache.delete(cacheKey);
    fitsBufferCache.set(cacheKey, buffer);
  }

  return renderFitsBuffer(buffer, {
    stretch,
    colormap,
    subtractZodi,
    fitsCutoutUrl: officialCutoutUrl,
  });
}

