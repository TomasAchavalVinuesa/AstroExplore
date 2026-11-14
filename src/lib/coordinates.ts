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
