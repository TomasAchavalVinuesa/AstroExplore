import type { FitsWcs } from "./types";

/**
 * Parsea Ascensión Recta en grados decimales (ej. "133.795129")
 * o en formato sexagesimal HMS (ej. "08h55m10.831s", "08:55:10.831", "08 55 10.831").
 */
export function parseRA(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // Decimal puro
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) {
    const val = Number(s);
    if (!Number.isFinite(val) || val < 0 || val > 360) return null;
    return val;
  }

  // Sexagesimal HMS: 08h55m10.831s | 08:55:10.831 | 08 55 10.831
  const match = s.match(
    /^(\d{1,2})\s*[h:\s]\s*(\d{1,2})\s*[m:\s]\s*(\d{1,2}(?:\.\d+)?)\s*s?$/i
  );
  if (!match) return null;

  const h = Number(match[1]);
  const m = Number(match[2]);
  const sec = Number(match[3]);
  if (h > 24 || m >= 60 || sec >= 60) return null;

  const deg = (h + m / 60 + sec / 3600) * 15;
  return deg >= 0 && deg <= 360 ? deg : null;
}

/**
 * Parsea Declinación en grados decimales (ej. "-7.245147")
 * o en formato sexagesimal DMS (ej. "-7d14m42.53s", "-07:14:42.53", "-7°14'42.53\"").
 */
export function parseDec(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  if (/^[+-]?\d+(\.\d+)?$/.test(s)) {
    const val = Number(s);
    if (!Number.isFinite(val) || val < -90 || val > 90) return null;
    return val;
  }

  const match = s.match(
    /^([+-]?)\s*(\d{1,2})\s*[d°:\s]\s*(\d{1,2})\s*[m':\s]\s*(\d{1,2}(?:\.\d+)?)\s*[s"]?$/i
  );
  if (!match) return null;

  const sign = match[1] === "-" ? -1 : 1;
  const d = Number(match[2]);
  const m = Number(match[3]);
  const sec = Number(match[4]);
  if (d > 90 || m >= 60 || sec >= 60) return null;

  const deg = sign * (d + m / 60 + sec / 3600);
  return deg >= -90 && deg <= 90 ? deg : null;
}

/**
 * Convierte grados a formato sexagesimal HMS (para RA)
 */
export function formatRAtoHMS(deg: number): string {
  const hoursTotal = deg / 15;
  const h = Math.floor(hoursTotal);
  const minutesTotal = (hoursTotal - h) * 60;
  const m = Math.floor(minutesTotal);
  const s = ((minutesTotal - m) * 60).toFixed(3);
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}m${s.padStart(6, "0")}s`;
}

/**
 * Convierte grados a formato sexagesimal DMS (para Dec)
 */
export function formatDectoDMS(deg: number): string {
  const sign = deg < 0 ? "-" : "+";
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const minutesTotal = (abs - d) * 60;
  const m = Math.floor(minutesTotal);
  const s = ((minutesTotal - m) * 60).toFixed(2);
  return `${sign}${String(d).padStart(2, "0")}°${String(m).padStart(2, "0")}'${s.padStart(5, "0")}"`;
}

/**
 * Convierte Día Juliano Modificado (MJD) a fecha y hora UTC legible.
 * MJD 40587 corresponde a 1970-01-01T00:00:00Z.
 */
export function mjdToUtc(mjd: number | null): { date: string; dateTime: string } | null {
  if (mjd === null || !Number.isFinite(mjd)) return null;
  const unixMs = (mjd - 40587) * 86400 * 1000;
  const d = new Date(unixMs);
  if (Number.isNaN(d.getTime())) return null;
  const iso = d.toISOString();
  return {
    date: iso.slice(0, 10),
    dateTime: `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`,
  };
}

export interface AxisTick {
  /** Posición normalizada [0..1] a lo largo del eje (X: izq->der, Y: arriba->abajo) */
  fraction: number;
  /** Etiqueta formateada en grados, ej. "3.05°" o "-42.80°" */
  label: string;
  /** Valor numérico en grados */
  value: number;
}

/**
 * Convierte coordenadas de píxel FITS (1-indexadas, origen abajo-izquierda)
 * a coordenadas celestes ICRS (RA, Dec en grados) usando proyección gnomónica (TAN).
 */
export function pixelToWorld(
  px: number,
  py: number,
  wcs: FitsWcs
): { ra: number; dec: number } {
  const dx = px - wcs.crpix1;
  const dy = py - wcs.crpix2;

  const xiDeg = wcs.cd1_1 * dx + wcs.cd1_2 * dy;
  const etaDeg = wcs.cd2_1 * dx + wcs.cd2_2 * dy;

  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;

  const xi = xiDeg * deg2rad;
  const eta = etaDeg * deg2rad;
  const ra0 = wcs.crval1 * deg2rad;
  const dec0 = wcs.crval2 * deg2rad;

  const rho = Math.hypot(xi, eta);
  if (rho === 0) {
    return {
      ra: ((wcs.crval1 % 360) + 360) % 360,
      dec: wcs.crval2,
    };
  }

  const c = Math.atan(rho);
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const sinDec0 = Math.sin(dec0);
  const cosDec0 = Math.cos(dec0);

  const decRad = Math.asin(cosC * sinDec0 + (eta * sinC * cosDec0) / rho);
  const raRad = ra0 + Math.atan2(xi * sinC, rho * cosDec0 * cosC - eta * sinDec0 * sinC);

  const raDeg = ((raRad * rad2deg) % 360 + 360) % 360;
  const decDeg = decRad * rad2deg;

  return { ra: raDeg, dec: decDeg };
}

function generateNiceTicks(
  startVal: number,
  endVal: number,
  targetCount: number,
  wrap360: boolean
): AxisTick[] {
  const minVal = Math.min(startVal, endVal);
  const maxVal = Math.max(startVal, endVal);
  const range = maxVal - minVal;

  if (range <= 0 || !Number.isFinite(range)) return [];

  const rawStep = range / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;

  const niceFactors = [1, 2, 2.5, 4, 5, 10];
  const niceFactor = niceFactors.find((f) => f >= normalized * 0.85) ?? 10;
  const step = niceFactor * magnitude;

  const decimals = Math.max(
    2,
    -Math.floor(Math.log10(step)) + (niceFactor === 2.5 ? 1 : 0)
  );

  const kStart = Math.ceil(minVal / step);
  const kEnd = Math.floor(maxVal / step);
  const ticks: AxisTick[] = [];

  for (let k = kStart; k <= kEnd; k++) {
    const val = k * step;
    const fraction = (val - startVal) / (endVal - startVal);
    if (fraction < 0.03 || fraction > 0.97) continue;

    const displayVal = wrap360 ? ((val % 360) + 360) % 360 : val;
    const cleanVal = Math.abs(displayVal) < 1e-12 ? 0 : displayVal;

    ticks.push({
      fraction,
      value: cleanVal,
      label: `${cleanVal.toFixed(decimals)}°`,
    });
  }

  return ticks;
}

/**
 * Calcula los ticks cartesianos de RA (eje X inferior) y Dec (eje Y izquierdo)
 * alrededor de la imagen FITS, ajustados al WCS real o al FOV actual.
 */
export function computeAxisTicks(
  width: number,
  height: number,
  wcs: FitsWcs | null,
  fallbackCenter: { ra: number; dec: number; size: number }
): { xTicks: AxisTick[]; yTicks: AxisTick[] } {
  let raStart: number;
  let raEnd: number;
  let decTop: number;
  let decBottom: number;

  if (wcs && width > 0 && height > 0) {
    const bottomLeft = pixelToWorld(0.5, 0.5, wcs);
    const bottomRight = pixelToWorld(width + 0.5, 0.5, wcs);
    const topLeft = pixelToWorld(0.5, height + 0.5, wcs);

    raStart = bottomLeft.ra;
    raEnd = bottomRight.ra;
    if (raEnd - raStart > 180) raEnd -= 360;
    if (raEnd - raStart < -180) raEnd += 360;

    decTop = topLeft.dec;
    decBottom = bottomLeft.dec;
  } else {
    const cosDec = Math.max(0.05, Math.cos((fallbackCenter.dec * Math.PI) / 180));
    const halfRa = fallbackCenter.size / 2 / cosDec;
    raStart = fallbackCenter.ra + halfRa;
    raEnd = fallbackCenter.ra - halfRa;
    decTop = fallbackCenter.dec + fallbackCenter.size / 2;
    decBottom = fallbackCenter.dec - fallbackCenter.size / 2;
  }

  return {
    xTicks: generateNiceTicks(raStart, raEnd, 5, true),
    yTicks: generateNiceTicks(decTop, decBottom, 5, false),
  };
}
