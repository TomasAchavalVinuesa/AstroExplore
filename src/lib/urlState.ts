import { clampCutoutFov, parseDec, parseRA } from "./coordinates";
import type { CollectionQueryMode, ColormapName, StretchMode } from "./types";

const VALID_COLLECTIONS = new Set<CollectionQueryMode>(["spherex_dr1"]);
const VALID_STRETCHES = new Set<StretchMode>(["asinh", "log", "sqrt", "linear"]);
const VALID_COLORMAPS = new Set<ColormapName>(["inferno", "viridis", "plasma", "magma", "gray"]);
const TARGET_PARAM_KEYS = ["target", "object", "name", "q"] as const;

export interface UrlDisplayOptions {
  collection?: CollectionQueryMode;
  band?: string;
  size?: string;
  stretch?: StretchMode;
  colormap?: ColormapName;
  subtractZodi?: boolean;
}

export type ParsedUrlState =
  | { kind: "none" }
  | { kind: "target"; target: string; options: UrlDisplayOptions }
  | { kind: "coords"; ra: string; dec: string; options: UrlDisplayOptions }
  | { kind: "invalidCoords"; rawCoords: string };

export interface UrlSyncPayload {
  ra: string;
  dec: string;
  collection: CollectionQueryMode;
  band: string;
  size: string;
  stretch: StretchMode;
  colormap: ColormapName;
  subtractZodi: boolean;
}

function parseDisplayOptions(params: URLSearchParams): UrlDisplayOptions {
  const options: UrlDisplayOptions = {};

  const col = params.get("collection") as CollectionQueryMode | null;
  if (col && VALID_COLLECTIONS.has(col)) {
    options.collection = col;
  }

  const band = params.get("band")?.trim();
  if (band) {
    options.band = band;
  }

  const rawSize = params.get("size")?.trim();
  if (rawSize) {
    const sizeNum = Number(rawSize);
    if (Number.isFinite(sizeNum) && sizeNum > 0) {
      options.size = String(clampCutoutFov(sizeNum));
    }
  }

  const stretch = params.get("stretch") as StretchMode | null;
  if (stretch && VALID_STRETCHES.has(stretch)) {
    options.stretch = stretch;
  }

  const colormap = params.get("colormap") as ColormapName | null;
  if (colormap && VALID_COLORMAPS.has(colormap)) {
    options.colormap = colormap;
  }

  const zodi = params.get("subtract_zodi");
  if (zodi === "true" || zodi === "false") {
    options.subtractZodi = zodi === "true";
  }

  return options;
}

/**
 * Parsea y valida los parámetros de búsqueda de la URL actual.
 * Prioriza búsqueda por cuerpo celeste (`target` / `object` / `name` / `q`)
 * o por coordenadas (`ra` + `dec`).
 */
export function parseUrlState(search: string): ParsedUrlState {
  const params = new URLSearchParams(search);
  const options = parseDisplayOptions(params);

  for (const key of TARGET_PARAM_KEYS) {
    if (params.has(key)) {
      const target = (params.get(key) ?? "").trim();
      return { kind: "target", target, options };
    }
  }

  const hasRa = params.has("ra");
  const hasDec = params.has("dec");

  if (!hasRa && !hasDec) {
    return { kind: "none" };
  }

  const rawRa = (params.get("ra") ?? "").trim();
  const rawDec = (params.get("dec") ?? "").trim();

  const raDeg = rawRa ? parseRA(rawRa) : null;
  const decDeg = rawDec ? parseDec(rawDec) : null;

  if (raDeg === null || decDeg === null) {
    const rawCoords = [rawRa, rawDec].filter(Boolean).join(", ");
    return { kind: "invalidCoords", rawCoords };
  }

  return { kind: "coords", ra: rawRa, dec: rawDec, options };
}

/**
 * Sincroniza el estado activo del explorador en la URL del navegador mediante replaceState,
 * reemplazando cualquier parámetro de nombre de objeto por sus coordenadas correspondientes.
 */
export function syncUrlState(payload: UrlSyncPayload): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("ra", payload.ra);
  url.searchParams.set("dec", payload.dec);
  url.searchParams.set("collection", payload.collection);
  url.searchParams.set("band", payload.band);
  url.searchParams.set("size", payload.size);
  url.searchParams.set("stretch", payload.stretch);
  url.searchParams.set("colormap", payload.colormap);
  url.searchParams.set("subtract_zodi", String(payload.subtractZodi));

  window.history.replaceState(null, "", url.toString());
}

/**
 * Limpia los parámetros de consulta de la URL sin recargar la página.
 */
export function clearUrlState(): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", window.location.pathname);
}
