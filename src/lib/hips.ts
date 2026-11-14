/**
 * Motor matemático HEALPix (NESTED), decodificador MOC (NUNIQ FITS) y cargador de teselas
 * del cubo HiPS oficial de NASA/IPAC IRSA para SPHEREx (`spherex_allsky_cube`).
 *
 * Implementado 100% en cliente con TypeScript puro, DataView y Canvas 2D.
 */

export const SPHEREX_HIPS_BASE_URL =
  "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube";

export const SPHEREX_MOC_URLS = {
  obscore: "https://irsa.ipac.caltech.edu/data/MOC/spherex.obscore.moc.fits",
  deepField: "https://irsa.ipac.caltech.edu/data/MOC/spherex.deep_field.moc.fits",
} as const;

export type MocLayerId = keyof typeof SPHEREX_MOC_URLS;

/**
 * Los 102 canales espectrales en micrómetros (µm) de `spherex_allsky_cube` (data_cube_crval3_arr).
 * Índice de frame = 0..101 (los frames 50 y 51 corresponden a canales dicroicos).
 */
export const SPHEREX_HIPS_WAVELENGTHS_UM: readonly number[] = [
  0.753, 0.771, 0.79, 0.809, 0.828, 0.848, 0.868, 0.889, 0.91, 0.932, 0.955, 0.978, 1.001, 1.025,
  1.05, 1.075, 1.102, 1.113, 1.139, 1.167, 1.195, 1.224, 1.254, 1.284, 1.315, 1.346, 1.378, 1.412,
  1.446, 1.481, 1.517, 1.554, 1.592, 1.631, 1.656, 1.695, 1.735, 1.775, 1.818, 1.861, 1.905, 1.949,
  1.995, 2.041, 2.089, 2.139, 2.189, 2.24, 2.292, 2.345, 2.399, 2.445, 2.506, 2.575, 2.646, 2.719,
  2.794, 2.871, 2.951, 3.033, 3.118, 3.204, 3.293, 3.383, 3.476, 3.57, 3.667, 3.768, 3.833, 3.867,
  3.901, 3.935, 3.97, 4.005, 4.04, 4.076, 4.112, 4.148, 4.184, 4.22, 4.257, 4.294, 4.331, 4.368,
  4.405, 4.435, 4.467, 4.5, 4.533, 4.566, 4.6, 4.635, 4.669, 4.704, 4.739, 4.773, 4.808, 4.843,
  4.879, 4.915, 4.951, 4.988,
] as const;

export function getBandLabelForChannel(frameIdx: number): string {
  const bandNum = Math.min(6, Math.max(1, Math.floor(frameIdx / 17) + 1));
  const channelInBand = (frameIdx % 17) + 1;
  return `D${bandNum} · Ch ${channelInBand}`;
}

// Tablas de caras base HEALPix (0..11)
// jrll[f] es la latitud de anillo (en unidades de nside) del vértice sur/central de la cara f: {2, 3, 4}
const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4] as const;
// jpll[f] es la longitud azimutal (en unidades de cuarto de cuadrante) del centro de la cara f: {1, 3, 5, 7, 0, 2, 4, 6}
const JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7] as const;

/**
 * Intercala los bits de las coordenadas enteras locales (ix, iy) dentro de una cara HEALPix
 * para obtener el índice NESTED local (Morton code).
 */
export function xy2nestInFace(ix: number, iy: number): number {
  let res = 0;
  for (let b = 0; b < 14; b++) {
    res |= ((ix >> b) & 1) << (2 * b);
    res |= ((iy >> b) & 1) << (2 * b + 1);
  }
  return res;
}

/**
 * Desintercala un índice local NESTED en sus coordenadas (ix, iy) dentro de la cara base.
 */
export function nest2xyInFace(localPix: number): { ix: number; iy: number } {
  let ix = 0;
  let iy = 0;
  for (let b = 0; b < 14; b++) {
    ix |= ((localPix >> (2 * b)) & 1) << b;
    iy |= ((localPix >> (2 * b + 1)) & 1) << b;
  }
  return { ix, iy };
}

/**
 * Convierte coordenadas fraccionales (fx, fy) en [0..1] dentro de una cara base HEALPix (0..11)
 * a coordenadas celestes ecuatoriales ICRS (RA, Dec en grados).
 *
 * Convención estándar HEALPix / HiPS:
 * - fx crece de sur-este hacia norte-este (borde derecho-inferior)
 * - fy crece de sur-oeste hacia norte-oeste (borde izquierdo-inferior)
 */
export function healpixFaceXYToRaDec(
  face: number,
  fx: number,
  fy: number
): { ra: number; dec: number } {
  const jr = JRLL[face] - fx - fy; // Rango [-2..4], donde jr=2 es el ecuador (z=0)
  let z: number;
  let kshift: number;
  let nr: number;

  if (jr < 1) {
    // Casquete polar norte
    nr = jr;
    const tmp = nr * nr / 3;
    z = 1 - tmp;
    kshift = 0;
  } else if (jr > 3) {
    // Casquete polar sur
    nr = 4 - jr;
    const tmp = nr * nr / 3;
    z = tmp - 1;
    kshift = 0;
  } else {
    // Cinturón ecuatorial
    nr = 1;
    z = ((2 - jr) * 2) / 3;
    kshift = 1;
  }

  // En los polos exactos (nr === 0)
  if (nr <= 1e-11) {
    return {
      ra: 0,
      dec: z >= 0 ? 90 : -90,
    };
  }

  let jp = (JPLL[face] * nr + fx - fy + 1 + kshift) / 2;
  if (jp > 4 * nr) jp -= 4 * nr;
  if (jp < 0) jp += 4 * nr;

  const phiRad = ((jp - (kshift + 1) * 0.5) * Math.PI) / (2 * nr);
  const raDeg = (((phiRad * 180) / Math.PI) % 360 + 360) % 360;
  const clampedZ = Math.max(-1, Math.min(1, z));
  const decDeg = (Math.asin(clampedZ) * 180) / Math.PI;

  return { ra: raDeg, dec: decDeg };
}

/**
 * Obtiene los 4 vértices celestes (RA, Dec) de un píxel HEALPix NESTED en el orden `order`.
 * Orden de esquinas: Sur (0,0), Este (1,0), Norte (1,1), Oeste (0,1).
 */
export function getHealpixCellCorners(
  order: number,
  npix: number
): [
  { ra: number; dec: number },
  { ra: number; dec: number },
  { ra: number; dec: number },
  { ra: number; dec: number }
] {
  const nside = 1 << order;
  const npface = nside * nside;
  const face = Math.floor(npix / npface);
  const local = npix - face * npface;
  const { ix, iy } = nest2xyInFace(local);

  const fx0 = ix / nside;
  const fy0 = iy / nside;
  const fx1 = (ix + 1) / nside;
  const fy1 = (iy + 1) / nside;

  return [
    healpixFaceXYToRaDec(face, fx0, fy0),
    healpixFaceXYToRaDec(face, fx1, fy0),
    healpixFaceXYToRaDec(face, fx1, fy1),
    healpixFaceXYToRaDec(face, fx0, fy1),
  ];
}

/**
 * Obtiene el centro celeste (RA, Dec) de una celda HEALPix NESTED en el orden `order`.
 */
export function getHealpixCellCenter(
  order: number,
  npix: number
): { ra: number; dec: number } {
  const nside = 1 << order;
  const npface = nside * nside;
  const face = Math.floor(npix / npface);
  const local = npix - face * npface;
  const { ix, iy } = nest2xyInFace(local);

  return healpixFaceXYToRaDec(face, (ix + 0.5) / nside, (iy + 0.5) / nside);
}

/**
 * Construye la URL oficial de una tesela PNG de `spherex_allsky_cube` en IRSA.
 * Cuando `frameIdx === 0`, la URL es `Npix{p}.png`; para planos > 0 del cubo es `Npix{p}_{frameIdx}.png`.
 */
export function buildSpherexHipsTileUrl(
  order: number,
  npix: number,
  frameIdx = 0
): string {
  const dir = Math.floor(npix / 10000) * 10000;
  const suffix = frameIdx > 0 ? `_${frameIdx}` : "";
  return `${SPHEREX_HIPS_BASE_URL}/Norder${order}/Dir${dir}/Npix${npix}${suffix}.png`;
}

// Caché de imágenes de teselas HiPS en memoria para renderizado a 60fps en Canvas
interface TileEntry {
  status: "loading" | "ready" | "error";
  img?: HTMLImageElement;
}

const tileCache = new Map<string, TileEntry>();
const MAX_TILE_CACHE = 320;

export function getOrLoadHipsTile(
  order: number,
  npix: number,
  frameIdx: number,
  onLoad: () => void
): HTMLImageElement | null {
  const url = buildSpherexHipsTileUrl(order, npix, frameIdx);
  const existing = tileCache.get(url);

  if (existing) {
    if (existing.status === "ready" && existing.img) {
      // Actualizar orden LRU
      tileCache.delete(url);
      tileCache.set(url, existing);
      return existing.img;
    }
    return null;
  }

  if (tileCache.size >= MAX_TILE_CACHE) {
    const oldestKey = tileCache.keys().next().value;
    if (oldestKey) tileCache.delete(oldestKey);
  }

  const entry: TileEntry = { status: "loading" };
  tileCache.set(url, entry);

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.onload = () => {
    entry.status = "ready";
    entry.img = img;
    onLoad();
  };
  img.onerror = () => {
    entry.status = "error";
  };
  img.src = url;

  return null;
}

// Decodificador de archivos FITS MOC (Multi-Order Coverage) codificados en NUNIQ (32-bit int Big-Endian)
export interface MocCell {
  order: number;
  npix: number;
}

const mocCache = new Map<MocLayerId, MocCell[]>();
const mocInFlight = new Map<MocLayerId, Promise<MocCell[]>>();

/**
 * Convierte un entero NUNIQ de IVOA MOC en `(order, npix)` y lo reduce a un orden máximo `maxOrder`
 * para dibujarlo de forma ultrarrápida sobre el lienzo interactivo.
 */
function parseMocFitsBuffer(buffer: ArrayBuffer, maxRenderOrder = 6): MocCell[] {
  const bytes = new Uint8Array(buffer);
  const textDecoder = new TextDecoder("ascii");
  const FITS_BLOCK = 2880;
  let offset = 0;

  // Saltar HDU primario (2880 bytes) y leer cabecera de BINTABLE
  while (offset + FITS_BLOCK <= bytes.length) {
    let headerOffset = offset;
    let foundEnd = false;
    let xtension = "";
    let naxis1 = 0;
    let naxis2 = 0;

    while (headerOffset + FITS_BLOCK <= bytes.length) {
      const block = textDecoder.decode(bytes.subarray(headerOffset, headerOffset + FITS_BLOCK));
      for (let i = 0; i < 36; i++) {
        const card = block.slice(i * 80, (i + 1) * 80);
        const key = card.slice(0, 8).trim();
        if (key === "END") {
          foundEnd = true;
          break;
        }
        if (card[8] === "=") {
          const valRaw = card.slice(10).split("/")[0].trim().replace(/^'|'$/g, "").trim();
          if (key === "XTENSION") xtension = valRaw;
          if (key === "NAXIS1") naxis1 = Number(valRaw);
          if (key === "NAXIS2") naxis2 = Number(valRaw);
        }
      }
      headerOffset += FITS_BLOCK;
      if (foundEnd) break;
    }

    if (!foundEnd) break;

    const dataBytes = naxis1 * naxis2;
    if (xtension === "BINTABLE" && naxis1 === 4 && naxis2 > 0) {
      const view = new DataView(buffer, headerOffset, Math.min(dataBytes, buffer.byteLength - headerOffset));
      const count = Math.floor(view.byteLength / 4);
      const dedup = new Set<string>();
      const cells: MocCell[] = [];

      for (let i = 0; i < count; i++) {
        const uniq = view.getInt32(i * 4, false);
        if (uniq < 4) continue;
        // uniq = 4 * 4^order + npix  =>  floor(log2(uniq / 4) / 2) = order
        const order = Math.floor(Math.log2(uniq / 4) / 2);
        const base = 4 * Math.pow(4, order);
        const npix = uniq - base;
        if (order < 0 || npix < 0) continue;

        // Degradar celdas de órdenes muy finos (ej. orden 10-13) a `maxRenderOrder` para render fluido
        const renderOrder = Math.min(order, maxRenderOrder);
        const shift = 2 * (order - renderOrder);
        const renderNpix = shift > 0 ? Math.floor(npix / Math.pow(4, order - renderOrder)) : npix;
        const key = `${renderOrder}:${renderNpix}`;
        if (!dedup.has(key)) {
          dedup.add(key);
          cells.push({ order: renderOrder, npix: renderNpix });
        }
      }
      return cells;
    }

    const padded = dataBytes === 0 ? 0 : Math.ceil(dataBytes / FITS_BLOCK) * FITS_BLOCK;
    offset = headerOffset + padded;
  }

  return [];
}

export async function loadSpherexMoc(layerId: MocLayerId): Promise<MocCell[]> {
  const cached = mocCache.get(layerId);
  if (cached) return cached;

  const existing = mocInFlight.get(layerId);
  if (existing) return existing;

  const url = SPHEREX_MOC_URLS[layerId];
  const proxyUrl = url.replace("https://irsa.ipac.caltech.edu", "/irsa-proxy");

  const promise = (async () => {
    let res: Response;
    try {
      res = await fetch(proxyUrl);
      if (!res.ok) {
        res = await fetch(url);
      }
    } catch {
      res = await fetch(url);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} cargando MOC ${layerId}`);
    }
    const buffer = await res.arrayBuffer();
    const cells = parseMocFitsBuffer(buffer, 6);
    mocCache.set(layerId, cells);
    return cells;
  })().finally(() => {
    mocInFlight.delete(layerId);
  });

  mocInFlight.set(layerId, promise);
  return promise;
}

/**
 * Parsea la cadena IVOA `s_region` (ej. "POLYGON ICRS ra1 dec1 ra2 dec2 ra3 dec3 ra4 dec4")
 * en un arreglo de vértices `{ ra, dec }`.
 */
export function parseSRegionPolygon(sRegion: string | undefined): Array<{ ra: number; dec: number }> {
  if (!sRegion) return [];
  const nums = sRegion
    .replace(/POLYGON\s+ICRS/i, "")
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter(Number.isFinite);

  const pts: Array<{ ra: number; dec: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ ra: ((nums[i] % 360) + 360) % 360, dec: nums[i + 1] });
  }
  return pts;
}
