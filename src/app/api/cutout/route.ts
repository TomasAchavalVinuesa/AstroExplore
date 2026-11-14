import { NextRequest, NextResponse } from "next/server";
import { renderFitsCutout } from "@/lib/fits";
import type { ColormapName, StretchMode } from "@/lib/types";

const ALLOWED_IRSA_PREFIX = "https://irsa.ipac.caltech.edu/";
const VALID_STRETCHES = new Set<StretchMode>(["asinh", "log", "sqrt", "linear"]);
const VALID_COLORMAPS = new Set<ColormapName>(["inferno", "viridis", "plasma", "magma", "gray"]);

const fitsCache = new Map<string, Buffer>();
const MAX_CACHE_ITEMS = 24;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const accessUrl = sp.get("access_url") ?? "";
  const ra = Number(sp.get("ra"));
  const dec = Number(sp.get("dec"));
  const size = Number(sp.get("size") ?? "0.15");
  const stretch = (sp.get("stretch") ?? "asinh") as StretchMode;
  const colormap = (sp.get("colormap") ?? "inferno") as ColormapName;
  const subtractZodi = sp.get("subtract_zodi") === "true";

  if (!accessUrl.startsWith(ALLOWED_IRSA_PREFIX)) {
    return NextResponse.json(
      { detail: "access_url debe pertenecer a irsa.ipac.caltech.edu" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(ra) || ra < 0 || ra > 360 || !Number.isFinite(dec) || dec < -90 || dec > 90) {
    return NextResponse.json({ detail: "Coordenadas inválidas." }, { status: 400 });
  }
  if (!Number.isFinite(size) || size < 0.02 || size > 1.0) {
    return NextResponse.json({ detail: "size debe estar entre 0.02° y 1.0°." }, { status: 400 });
  }
  if (!VALID_STRETCHES.has(stretch) || !VALID_COLORMAPS.has(colormap)) {
    return NextResponse.json({ detail: "Parámetros de visualización inválidos." }, { status: 400 });
  }

  const cutoutUrl = `${accessUrl}?center=${ra},${dec}d&size=${size}`;
  const cacheKey = `${accessUrl}|${ra.toFixed(6)}|${dec.toFixed(6)}|${size.toFixed(4)}`;

  let fitsBuf = fitsCache.get(cacheKey);
  if (!fitsBuf) {
    try {
      const res = await fetch(cutoutUrl, { signal: AbortSignal.timeout(35000) });
      if (!res.ok) {
        return NextResponse.json(
          { detail: `IRSA IBE devolvió HTTP ${res.status}` },
          { status: 502 }
        );
      }
      fitsBuf = Buffer.from(await res.arrayBuffer());
      fitsCache.set(cacheKey, fitsBuf);
      if (fitsCache.size > MAX_CACHE_ITEMS) {
        const oldestKey = fitsCache.keys().next().value;
        if (oldestKey) fitsCache.delete(oldestKey);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { detail: `Error descargando recorte FITS: ${msg}` },
        { status: 502 }
      );
    }
  } else {
    fitsCache.delete(cacheKey);
    fitsCache.set(cacheKey, fitsBuf);
  }

  try {
    const rendered = renderFitsCutout(fitsBuf, { stretch, colormap, subtractZodi });
    return NextResponse.json({
      image_base64: rendered.pngBase64,
      width: rendered.width,
      height: rendered.height,
      stats: rendered.stats,
      fits_cutout_url: cutoutUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `Error procesando FITS: ${msg}` }, { status: 422 });
  }
}
