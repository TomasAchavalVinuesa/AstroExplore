import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Columns2,
  Compass,
  Crosshair,
  Film,
  Globe,
  Grid,
  Image as ImageIcon,
  Layers,
  Loader2,
  MapPin,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import {
  getBandLabelForChannel,
  getHealpixCellCenter,
  getHealpixCellCorners,
  getOrLoadHipsTile,
  healpixFaceXYToRaDec,
  loadSpherexMoc,
  nest2xyInFace,
  parseSRegionPolygon,
  SPHEREX_HIPS_WAVELENGTHS_UM,
  type MocCell,
} from "../lib/hips";
import { getRenderedCutout } from "../lib/irsa";
import type {
  ColormapName,
  RenderedCutout,
  SpherexObservation,
  StretchMode,
} from "../lib/types";

interface HipsSkyMapPanelProps {
  targetCoords: { ra: number; dec: number; size: number } | null;
  observations: SpherexObservation[];
  selectedObs: SpherexObservation | null;
  cutout?: RenderedCutout | null;
  cutoutLoading?: boolean;
  stretch?: StretchMode;
  colormap?: ColormapName;
  subtractZodi?: boolean;
  onChangeFov?: (newSize: number) => void;
  onSelectObservation?: (obs: SpherexObservation) => void;
  onQueryAtCoords?: (raDeg: number, decDeg: number) => void;
}

interface SideVideoFrame {
  number: number;
  key: string;
  obs: SpherexObservation;
  dateLabel: string;
  dateTimeLabel: string;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const SIDE_VIDEO_MAX_FRAMES = 8;

/**
 * Proyección estereográfica suave centrada en (ra0, dec0).
 * Convención astronómica: Norte arriba (+Y pantalla es -Y canvas), Este a la izquierda (RA crece hacia la izquierda).
 */
function projectRaDecToCanvas(
  ra: number,
  dec: number,
  ra0: number,
  dec0: number,
  scalePxPerRad: number,
  cx: number,
  cy: number
): { x: number; y: number; cosC: number } {
  const dRa = (ra - ra0) * DEG2RAD;
  const decRad = dec * DEG2RAD;
  const dec0Rad = dec0 * DEG2RAD;

  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const sinDec0 = Math.sin(dec0Rad);
  const cosDec0 = Math.cos(dec0Rad);
  const cosDra = Math.cos(dRa);
  const sinDra = Math.sin(dRa);

  const cosC = sinDec0 * sinDec + cosDec0 * cosDec * cosDra;

  const k = cosC <= -0.95 ? 0 : 2 / (1 + cosC);
  const x = cx - scalePxPerRad * k * (cosDec * sinDra);
  const y = cy - scalePxPerRad * k * (cosDec0 * sinDec - sinDec0 * cosDec * cosDra);

  return { x, y, cosC };
}

/**
 * Inversa de la proyección estereográfica desde píxeles del canvas (x, y) a (RA, Dec) en grados.
 */
function unprojectCanvasToRaDec(
  x: number,
  y: number,
  ra0: number,
  dec0: number,
  scalePxPerRad: number,
  cx: number,
  cy: number
): { ra: number; dec: number } | null {
  const dx = -(x - cx) / scalePxPerRad;
  const dy = -(y - cy) / scalePxPerRad;
  const rho = Math.hypot(dx, dy);

  if (rho > 2.2) return null;
  if (rho < 1e-9) {
    return { ra: ((ra0 % 360) + 360) % 360, dec: dec0 };
  }

  const c = 2 * Math.atan(rho / 2);
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const dec0Rad = dec0 * DEG2RAD;
  const sinDec0 = Math.sin(dec0Rad);
  const cosDec0 = Math.cos(dec0Rad);

  const decRad = Math.asin(Math.max(-1, Math.min(1, cosC * sinDec0 + (dy * sinC * cosDec0) / rho)));
  const dRa = Math.atan2(dx * sinC, rho * cosDec0 * cosC - dy * sinDec0 * sinC);

  const raDeg = ((ra0 + dRa * RAD2DEG) % 360 + 360) % 360;
  const decDeg = decRad * RAD2DEG;
  return { ra: raDeg, dec: decDeg };
}

/**
 * Dibuja una imagen fuente o sub-rectángulo en un cuadrilátero arbitrario (p00, p10, p11, p01)
 * dividiéndolo en 2 triángulos afines sobre el contexto 2D del Canvas.
 */
function drawTexturedQuad(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx0: number,
  sy0: number,
  sw: number,
  sh: number,
  p00: { x: number; y: number },
  p10: { x: number; y: number },
  p11: { x: number; y: number },
  p01: { x: number; y: number }
): void {
  const maxSpan = Math.max(
    Math.hypot(p10.x - p00.x, p10.y - p00.y),
    Math.hypot(p11.x - p10.x, p11.y - p10.y),
    Math.hypot(p01.x - p11.x, p01.y - p11.y),
    Math.hypot(p00.x - p01.x, p00.y - p01.y)
  );
  if (maxSpan > 900 || maxSpan < 0.5) return;

  // Triángulo 1: p00 -> p10 -> p01
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p00.x, p00.y);
  ctx.lineTo(p10.x, p10.y);
  ctx.lineTo(p01.x, p01.y);
  ctx.closePath();
  ctx.clip();

  const ax1 = (p10.x - p00.x) / sw;
  const ay1 = (p10.y - p00.y) / sw;
  const bx1 = (p01.x - p00.x) / sh;
  const by1 = (p01.y - p00.y) / sh;
  const tx1 = p00.x - ax1 * sx0 - bx1 * sy0;
  const ty1 = p00.y - ay1 * sx0 - by1 * sy0;

  ctx.transform(ax1, ay1, bx1, by1, tx1, ty1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();

  // Triángulo 2: p11 -> p10 -> p01
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p11.x, p11.y);
  ctx.lineTo(p10.x, p10.y);
  ctx.lineTo(p01.x, p01.y);
  ctx.closePath();
  ctx.clip();

  const sx1 = sx0 + sw;
  const sy1 = sy0 + sh;
  const ax2 = (p11.x - p01.x) / sw;
  const ay2 = (p11.y - p01.y) / sw;
  const bx2 = (p11.x - p10.x) / sh;
  const by2 = (p11.y - p10.y) / sh;
  const tx2 = p11.x - ax2 * sx1 - bx2 * sy1;
  const ty2 = p11.y - ay2 * sx1 - by2 * sy1;

  ctx.transform(ax2, ay2, bx2, by2, tx2, ty2);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

export const HipsSkyMapPanel: React.FC<HipsSkyMapPanelProps> = ({
  targetCoords,
  observations,
  selectedObs,
  cutout = null,
  cutoutLoading = false,
  stretch = "asinh",
  colormap = "inferno",
  subtractZodi = true,
  onChangeFov,
  onSelectObservation,
  onQueryAtCoords,
}) => {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const sideViewportRef = useRef<HTMLDivElement | null>(null);

  const [viewCenter, setViewCenter] = useState<{ ra: number; dec: number }>(() => ({
    ra: targetCoords?.ra ?? 133.79513,
    dec: targetCoords?.dec ?? -7.24515,
  }));
  const [fovDeg, setFovDeg] = useState<number>(35);
  const [channelIdx, setChannelIdx] = useState<number>(0);

  const [showMocWide, setShowMocWide] = useState<boolean>(false);
  const [showMocDeep, setShowMocDeep] = useState<boolean>(true);
  const [showFootprints, setShowFootprints] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  const [mocWideCells, setMocWideCells] = useState<MocCell[] | null>(null);
  const [mocDeepCells, setMocDeepCells] = useState<MocCell[] | null>(null);
  const [loadingMoc, setLoadingMoc] = useState<boolean>(false);

  const [cursorCoords, setCursorCoords] = useState<{ ra: number; dec: number } | null>(null);
  const [renderTick, setRenderTick] = useState<number>(0);

  // Estado del punto marcado con doble clic y del panel lateral de imágenes de color / video
  const [markedPoint, setMarkedPoint] = useState<{ ra: number; dec: number } | null>(null);
  const [sideBySideOpen, setSideBySideOpen] = useState<boolean>(false);
  const [sideTab, setSideTab] = useState<"video" | "cutout" | "bands">("video");
  const [sideBandFilter, setSideBandFilter] = useState<string>("ALL");
  const [selectedSideDates, setSelectedSideDates] = useState<Set<string>>(new Set());
  const [sideZoom, setSideZoom] = useState<number>(1);
  const [sideIsPlaying, setSideIsPlaying] = useState<boolean>(true);
  const [sideLoop, setSideLoop] = useState<boolean>(true);
  const [sideSmoothFade, setSideSmoothFade] = useState<boolean>(true);
  const [sideSpeedMs, setSideSpeedMs] = useState<number>(850);
  const [sideActiveKey, setSideActiveKey] = useState<string | null>(null);
  const [sidePrevDataUrl, setSidePrevDataUrl] = useState<string | null>(null);
  const sidePrevUrlRef = useRef<string | null>(null);
  const sideStartedRef = useRef<Set<string>>(new Set());
  const [sideRenderedMap, setSideRenderedMap] = useState<
    Record<string, { status: "idle" | "loading" | "ready" | "error"; cutout?: RenderedCutout }>
  >({});

  const dragRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    startRa: number;
    startDec: number;
  }>({
    dragging: false,
    startX: 0,
    startY: 0,
    startRa: 0,
    startDec: 0,
  });

  // Sincronizar centro del mapa cuando el usuario busca nuevas coordenadas desde el panel izquierdo
  useEffect(() => {
    if (!targetCoords) return;
    setViewCenter({ ra: targetCoords.ra, dec: targetCoords.dec });
  }, [targetCoords?.ra, targetCoords?.dec]);

  // Cargar MOC de SPHEREx cuando se activa una capa MOC
  useEffect(() => {
    let active = true;
    const loadNeeded = async () => {
      if (showMocDeep && !mocDeepCells) {
        setLoadingMoc(true);
        try {
          const cells = await loadSpherexMoc("deepField");
          if (active) setMocDeepCells(cells);
        } catch {
          // Ignorar fallo silencioso de red
        } finally {
          if (active) setLoadingMoc(false);
        }
      }
      if (showMocWide && !mocWideCells) {
        setLoadingMoc(true);
        try {
          const cells = await loadSpherexMoc("obscore");
          if (active) setMocWideCells(cells);
        } catch {
          // Ignorar fallo silencioso de red
        } finally {
          if (active) setLoadingMoc(false);
        }
      }
    };
    void loadNeeded();
    return () => {
      active = false;
    };
  }, [showMocDeep, showMocWide, mocDeepCells, mocWideCells]);

  // Seleccionar el orden HEALPix (0..4) óptimo según el FOV actual
  const activeOrder = fovDeg > 85 ? 0 : fovDeg > 38 ? 1 : fovDeg > 16 ? 2 : fovDeg > 7 ? 3 : 4;

  const triggerRepaint = useCallback(() => {
    setRenderTick((n) => n + 1);
  }, []);

  // Bandas disponibles en las observaciones actuales
  const availableBands = useMemo(() => {
    const set = new Set<string>();
    for (const obs of observations) {
      if (obs.bandpass) set.add(obs.bandpass);
    }
    return Array.from(set).sort();
  }, [observations]);

  // Fechas únicas disponibles en las observaciones actuales (ordenadas cronológicamente)
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const obs of observations) {
      if (obs.epoch_date) set.add(obs.epoch_date);
    }
    return Array.from(set).sort();
  }, [observations]);

  // Seleccionar solo las primeras 2 fechas por defecto para acelerar la carga inicial
  useEffect(() => {
    if (availableDates.length === 0) {
      setSelectedSideDates(new Set());
      return;
    }
    setSelectedSideDates(new Set(availableDates.slice(0, 2)));
  }, [availableDates]);

  // Construir fotogramas para el reproductor de video lateral (solo de las fechas seleccionadas)
  const sideFrames = useMemo<SideVideoFrame[]>(() => {
    if (observations.length === 0) return [];
    const byBand =
      sideBandFilter === "ALL"
        ? observations
        : observations.filter((o) => o.bandpass === sideBandFilter);

    const filtered =
      availableDates.length > 0
        ? byBand.filter((o) => o.epoch_date && selectedSideDates.has(o.epoch_date))
        : byBand;

    if (filtered.length === 0) return [];

    const byDate = new Map<string, SpherexObservation[]>();
    for (const obs of filtered) {
      const dateKey = obs.epoch_date ?? "unknown";
      const list = byDate.get(dateKey) ?? [];
      list.push(obs);
      byDate.set(dateKey, list);
    }

    const distinctDates = Array.from(byDate.keys()).filter((k) => k !== "unknown");
    if (distinctDates.length >= 2) {
      return distinctDates
        .sort()
        .map((dateKey, idx) => {
          const rep = byDate.get(dateKey)![0];
          return {
            number: idx + 1,
            key: `side|${dateKey}|${rep.obs_id}|${rep.bandpass}`,
            obs: rep,
            dateLabel: dateKey,
            dateTimeLabel: rep.epoch_datetime ?? dateKey,
          };
        });
    }

    return filtered.slice(0, SIDE_VIDEO_MAX_FRAMES).map((obs, idx) => ({
      number: idx + 1,
      key: `side|${obs.obs_id}|${obs.bandpass}|${idx}`,
      obs,
      dateLabel: obs.epoch_date ?? obs.bandpass,
      dateTimeLabel: obs.epoch_datetime ?? obs.obs_id,
    }));
  }, [observations, sideBandFilter, availableDates, selectedSideDates]);

  // Representantes por banda D1–D6 para la pestaña "Bandas de Color (D1–D6)" filtrados por fechas seleccionadas
  const bandRepresentatives = useMemo<SideVideoFrame[]>(() => {
    const filtered =
      availableDates.length > 0
        ? observations.filter((o) => o.epoch_date && selectedSideDates.has(o.epoch_date))
        : observations;
    const seen = new Set<string>();
    const list: SideVideoFrame[] = [];
    for (const obs of filtered) {
      const b = obs.bandpass || "IR";
      if (!seen.has(b)) {
        seen.add(b);
        list.push({
          number: list.length + 1,
          key: `band|${b}|${obs.obs_id}`,
          obs,
          dateLabel: b,
          dateTimeLabel: obs.epoch_date ?? obs.obs_id,
        });
      }
    }
    return list.sort((a, b) => a.obs.bandpass.localeCompare(b.obs.bandpass));
  }, [observations, availableDates, selectedSideDates]);

  // Inicializar fotograma activo del reproductor lateral cuando cambian los fotogramas
  useEffect(() => {
    setSideActiveKey(sideFrames[0]?.key ?? null);
    sidePrevUrlRef.current = null;
    setSidePrevDataUrl(null);
  }, [sideFrames]);

  // Reiniciar caché de recortes del panel lateral cuando cambian las coordenadas o parámetros visuales
  useEffect(() => {
    sideStartedRef.current = new Set();
    setSideRenderedMap({});
  }, [targetCoords?.ra, targetCoords?.dec, targetCoords?.size, stretch, colormap, subtractZodi, observations]);

  // Cargar recortes FITS a color para el panel lateral cuando está abierto
  useEffect(() => {
    if (!sideBySideOpen || !targetCoords) return;

    const itemsToLoad = sideTab === "bands" ? bandRepresentatives : sideFrames;
    const candidates = itemsToLoad.filter((item) => !sideStartedRef.current.has(item.key));
    if (candidates.length === 0) return;

    const controller = new AbortController();
    for (const c of candidates) {
      sideStartedRef.current.add(c.key);
    }

    setSideRenderedMap((prev) => {
      const next = { ...prev };
      for (const c of candidates) {
        next[c.key] = { status: "loading" };
      }
      return next;
    });

    for (const current of candidates) {
      void getRenderedCutout({
        accessUrl: current.obs.access_url,
        ra: targetCoords.ra,
        dec: targetCoords.dec,
        size: targetCoords.size,
        stretch,
        colormap,
        subtractZodi,
        priority: "low",
        signal: controller.signal,
      })
        .then((rendered) => {
          if (controller.signal.aborted) return;
          setSideRenderedMap((prev) => ({
            ...prev,
            [current.key]: { status: "ready", cutout: rendered },
          }));
        })
        .catch((err) => {
          if (
            controller.signal.aborted ||
            (err instanceof DOMException && err.name === "AbortError")
          ) {
            sideStartedRef.current.delete(current.key);
            return;
          }
          setSideRenderedMap((prev) => ({
            ...prev,
            [current.key]: { status: "error" },
          }));
        });
    }

    return () => {
      controller.abort();
    };
  }, [
    sideBySideOpen,
    sideTab,
    sideFrames,
    bandRepresentatives,
    targetCoords,
    stretch,
    colormap,
    subtractZodi,
  ]);

  const activeSideFrame = useMemo(() => {
    return sideFrames.find((f) => f.key === sideActiveKey) ?? sideFrames[0] ?? null;
  }, [sideFrames, sideActiveKey]);

  const activeSideDataUrl = activeSideFrame
    ? sideRenderedMap[activeSideFrame.key]?.cutout?.dataUrl ?? null
    : null;

  useEffect(() => {
    if (
      activeSideDataUrl &&
      sidePrevUrlRef.current &&
      sidePrevUrlRef.current !== activeSideDataUrl
    ) {
      setSidePrevDataUrl(sidePrevUrlRef.current);
    }
    if (activeSideDataUrl) {
      sidePrevUrlRef.current = activeSideDataUrl;
    }
  }, [activeSideDataUrl]);

  // Ciclo de reproducción automática de transición (video) en el panel lateral
  useEffect(() => {
    if (!sideBySideOpen || sideTab !== "video" || !sideIsPlaying || sideFrames.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setSideActiveKey((current) => {
        const idx = sideFrames.findIndex((f) => f.key === current);
        if (idx === -1) return sideFrames[0].key;
        const nextIdx = idx + 1;
        if (nextIdx >= sideFrames.length) {
          if (sideLoop) return sideFrames[0].key;
          setSideIsPlaying(false);
          return current;
        }
        return sideFrames[nextIdx].key;
      });
    }, sideSpeedMs);

    return () => window.clearInterval(timer);
  }, [sideBySideOpen, sideTab, sideIsPlaying, sideFrames, sideSpeedMs, sideLoop]);

  // Renderizado principal del mapa celeste HiPS + MOC + Footprints + Punto Marcado en el Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    const fovRad = Math.max(1.5, Math.min(160, fovDeg)) * DEG2RAD;
    const scalePxPerRad = Math.min(width, height) / (2 * Math.tan(fovRad / 4) * 2);

    ctx.fillStyle = "#04070f";
    ctx.fillRect(0, 0, width, height);

    const ra0 = viewCenter.ra;
    const dec0 = viewCenter.dec;

    // Umbral de coseno angular para descartar teselas fuera del cono de visión
    const halfDiagRad = Math.min(Math.PI * 0.85, fovRad * 0.95 + 0.45 / (1 << activeOrder));
    const minCosVisibility = Math.cos(halfDiagRad);

    const nside = 1 << activeOrder;
    const npixTotal = 12 * nside * nside;
    const subDiv = activeOrder === 0 ? 6 : activeOrder === 1 ? 4 : 2;

    for (let npix = 0; npix < npixTotal; npix++) {
      const center = getHealpixCellCenter(activeOrder, npix);
      const cProj = projectRaDecToCanvas(
        center.ra,
        center.dec,
        ra0,
        dec0,
        scalePxPerRad,
        cx,
        cy
      );
      if (cProj.cosC < minCosVisibility) continue;

      let img = getOrLoadHipsTile(activeOrder, npix, channelIdx, triggerRepaint);
      let tileOrder = activeOrder;
      let tileNpix = npix;

      if (!img && activeOrder > 0) {
        const face0 = Math.floor(npix / (nside * nside));
        img = getOrLoadHipsTile(0, face0, channelIdx, triggerRepaint);
        tileOrder = 0;
        tileNpix = face0;
      }

      if (!img) continue;

      const tileNside = 1 << tileOrder;
      const tileNpface = tileNside * tileNside;
      const face = Math.floor(tileNpix / tileNpface);
      const local = tileNpix - face * tileNpface;
      const { ix: tileIx, iy: tileIy } = nest2xyInFace(local);

      const cellFace = Math.floor(npix / (nside * nside));
      const cellLocal = npix - cellFace * (nside * nside);
      const { ix: cellIx, iy: cellIy } = nest2xyInFace(cellLocal);

      const fxBase0 = cellIx / nside;
      const fyBase0 = cellIy / nside;
      const fStep = 1 / nside / subDiv;

      const imgW = img.naturalWidth || 512;
      const imgH = img.naturalHeight || 512;

      for (let sx = 0; sx < subDiv; sx++) {
        for (let sy = 0; sy < subDiv; sy++) {
          const fx0 = fxBase0 + sx * fStep;
          const fy0 = fyBase0 + sy * fStep;
          const fx1 = fx0 + fStep;
          const fy1 = fy0 + fStep;

          const w00 = healpixFaceXYToRaDec(cellFace, fx0, fy0);
          const w10 = healpixFaceXYToRaDec(cellFace, fx1, fy0);
          const w11 = healpixFaceXYToRaDec(cellFace, fx1, fy1);
          const w01 = healpixFaceXYToRaDec(cellFace, fx0, fy1);

          const p00 = projectRaDecToCanvas(w00.ra, w00.dec, ra0, dec0, scalePxPerRad, cx, cy);
          const p10 = projectRaDecToCanvas(w10.ra, w10.dec, ra0, dec0, scalePxPerRad, cx, cy);
          const p11 = projectRaDecToCanvas(w11.ra, w11.dec, ra0, dec0, scalePxPerRad, cx, cy);
          const p01 = projectRaDecToCanvas(w01.ra, w01.dec, ra0, dec0, scalePxPerRad, cx, cy);

          if (p00.cosC < -0.2 || p10.cosC < -0.2 || p11.cosC < -0.2 || p01.cosC < -0.2) {
            continue;
          }

          const u0 = fx0 * tileNside - tileIx;
          const v0 = fy0 * tileNside - tileIy;
          const uSpan = fStep * tileNside;
          const vSpan = fStep * tileNside;

          const srcX = u0 * imgW;
          const srcY = (1 - (v0 + vSpan)) * imgH;
          const srcW = uSpan * imgW;
          const srcH = vSpan * imgH;

          drawTexturedQuad(ctx, img, srcX, srcY, srcW, srcH, p01, p11, p10, p00);
        }
      }
    }

    // 2. Superposición de Cobertura MOC (Multi-Order Coverage) de SPHEREx
    const drawMocCells = (cells: MocCell[] | null, fillStyle: string, strokeStyle: string) => {
      if (!cells || cells.length === 0) return;
      ctx.save();
      ctx.fillStyle = fillStyle;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 0.75;

      for (const cell of cells) {
        const center = getHealpixCellCenter(cell.order, cell.npix);
        const cProj = projectRaDecToCanvas(
          center.ra,
          center.dec,
          ra0,
          dec0,
          scalePxPerRad,
          cx,
          cy
        );
        if (cProj.cosC < minCosVisibility) continue;

        const corners = getHealpixCellCorners(cell.order, cell.npix);
        const pts = corners.map((c) =>
          projectRaDecToCanvas(c.ra, c.dec, ra0, dec0, scalePxPerRad, cx, cy)
        );
        if (pts.some((p) => p.cosC <= 0)) continue;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.lineTo(pts[3].x, pts[3].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    };

    if (showMocWide) {
      drawMocCells(mocWideCells, "rgba(14, 165, 233, 0.10)", "rgba(56, 189, 248, 0.28)");
    }
    if (showMocDeep) {
      drawMocCells(mocDeepCells, "rgba(168, 85, 247, 0.22)", "rgba(216, 180, 254, 0.65)");
    }

    // 3. Malla Celeste Ecuatorial (RA / Dec Graticule)
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
      ctx.fillStyle = "rgba(148, 163, 184, 0.75)";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.lineWidth = 1;

      const stepRa = fovDeg > 60 ? 30 : fovDeg > 20 ? 10 : fovDeg > 6 ? 2 : 1;
      const stepDec = fovDeg > 60 ? 20 : fovDeg > 20 ? 10 : fovDeg > 6 ? 2 : 1;

      for (let dec = -80; dec <= 80; dec += stepDec) {
        ctx.beginPath();
        let started = false;
        for (let ra = 0; ra <= 360; ra += 2) {
          const p = projectRaDecToCanvas(ra, dec, ra0, dec0, scalePxPerRad, cx, cy);
          if (p.cosC > 0.1 && p.x >= -50 && p.x <= width + 50 && p.y >= -50 && p.y <= height + 50) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      for (let ra = 0; ra < 360; ra += stepRa) {
        ctx.beginPath();
        let started = false;
        for (let dec = -85; dec <= 85; dec += 2) {
          const p = projectRaDecToCanvas(ra, dec, ra0, dec0, scalePxPerRad, cx, cy);
          if (p.cosC > 0.1 && p.x >= -50 && p.x <= width + 50 && p.y >= -50 && p.y <= height + 50) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();

        const labelPt = projectRaDecToCanvas(ra, dec0, ra0, dec0, scalePxPerRad, cx, cy);
        if (
          labelPt.cosC > 0.2 &&
          labelPt.x > 24 &&
          labelPt.x < width - 40 &&
          labelPt.y > 16 &&
          labelPt.y < height - 16
        ) {
          ctx.fillText(`${ra}°`, labelPt.x + 3, labelPt.y - 3);
        }
      }
      ctx.restore();
    }

    // 4. Huellas poligonales (`s_region`) de las exposiciones encontradas en la consulta actual
    if (showFootprints && observations.length > 0) {
      ctx.save();
      const maxFootprints = Math.min(observations.length, 60);

      for (let i = 0; i < maxFootprints; i++) {
        const obs = observations[i];
        const poly = parseSRegionPolygon(obs.s_region);
        if (poly.length < 3) continue;

        const isSelected =
          selectedObs?.obs_id === obs.obs_id && selectedObs?.bandpass === obs.bandpass;

        const pts = poly.map((v) =>
          projectRaDecToCanvas(v.ra, v.dec, ra0, dec0, scalePxPerRad, cx, cy)
        );
        if (pts.some((p) => p.cosC <= 0.05)) continue;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(pts[k].x, pts[k].y);
        }
        ctx.closePath();

        if (isSelected) {
          ctx.strokeStyle = "rgba(34, 211, 238, 0.95)";
          ctx.fillStyle = "rgba(6, 182, 212, 0.16)";
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.strokeStyle = "rgba(251, 191, 36, 0.32)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 4b. Resaltar en el mapa general la sección exacta que se está viendo actualmente en el video / panel lateral
    if (sideBySideOpen) {
      const activeVideoObs = sideTab === "video" ? activeSideFrame?.obs : selectedObs;

      // Huella `s_region` de la exposición del fotograma actual del video
      if (activeVideoObs) {
        const videoPoly = parseSRegionPolygon(activeVideoObs.s_region);
        if (videoPoly.length >= 3) {
          const vPts = videoPoly.map((v) =>
            projectRaDecToCanvas(v.ra, v.dec, ra0, dec0, scalePxPerRad, cx, cy)
          );
          if (!vPts.some((p) => p.cosC <= 0.05)) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(vPts[0].x, vPts[0].y);
            for (let k = 1; k < vPts.length; k++) {
              ctx.lineTo(vPts[k].x, vPts[k].y);
            }
            ctx.closePath();

            ctx.fillStyle = "rgba(16, 185, 129, 0.18)";
            ctx.strokeStyle = "#34d399";
            ctx.lineWidth = 2.6;
            ctx.fill();
            ctx.stroke();

            // Etiqueta del fotograma activo sobre la huella en el mapa general
            if (sideTab === "video" && activeSideFrame) {
              const topPt = vPts.reduce((best, p) => (p.y < best.y ? p : best), vPts[0]);
              const tag = `#${activeSideFrame.number} ${activeSideFrame.obs.bandpass} · ${activeSideFrame.dateLabel}`;
              ctx.font = "bold 10px ui-monospace, SFMono-Regular, Menlo, monospace";
              const tw = ctx.measureText(tag).width;
              const tx = Math.min(width - tw - 16, Math.max(8, topPt.x - tw / 2));
              const ty = Math.max(20, topPt.y - 8);
              ctx.fillStyle = "rgba(6, 78, 59, 0.92)";
              ctx.strokeStyle = "#34d399";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(tx - 5, ty - 11, tw + 10, 16, 4);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = "#a7f3d0";
              ctx.fillText(tag, tx, ty);
            }
            ctx.restore();
          }
        }
      }

      // Recuadro exacto del recorte FOV que se está viendo en el video (ajustado al zoom actual)
      const boxCenter = markedPoint ?? targetCoords ?? viewCenter;
      const baseSizeDeg = targetCoords?.size ?? 0.15;
      const effectiveSizeDeg = baseSizeDeg / Math.max(1, sideZoom);
      const halfDec = effectiveSizeDeg / 2;
      const halfRa = halfDec / Math.max(0.15, Math.cos(boxCenter.dec * DEG2RAD));

      const boxCorners = [
        { ra: boxCenter.ra - halfRa, dec: boxCenter.dec - halfDec },
        { ra: boxCenter.ra + halfRa, dec: boxCenter.dec - halfDec },
        { ra: boxCenter.ra + halfRa, dec: boxCenter.dec + halfDec },
        { ra: boxCenter.ra - halfRa, dec: boxCenter.dec + halfDec },
      ].map((c) => projectRaDecToCanvas(c.ra, c.dec, ra0, dec0, scalePxPerRad, cx, cy));

      if (!boxCorners.some((p) => p.cosC <= 0.05)) {
        ctx.save();
        ctx.strokeStyle = "#f472b6";
        ctx.fillStyle = "rgba(244, 114, 182, 0.14)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(boxCorners[0].x, boxCorners[0].y);
        ctx.lineTo(boxCorners[1].x, boxCorners[1].y);
        ctx.lineTo(boxCorners[2].x, boxCorners[2].y);
        ctx.lineTo(boxCorners[3].x, boxCorners[3].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Marcador de la coordenada objetivo actual
    if (targetCoords) {
      const tProj = projectRaDecToCanvas(
        targetCoords.ra,
        targetCoords.dec,
        ra0,
        dec0,
        scalePxPerRad,
        cx,
        cy
      );
      if (tProj.cosC > 0.05) {
        ctx.save();
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 1.75;

        ctx.beginPath();
        ctx.arc(tProj.x, tProj.y, 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tProj.x - 16, tProj.y);
        ctx.lineTo(tProj.x - 4, tProj.y);
        ctx.moveTo(tProj.x + 4, tProj.y);
        ctx.lineTo(tProj.x + 16, tProj.y);
        ctx.moveTo(tProj.x, tProj.y - 16);
        ctx.lineTo(tProj.x, tProj.y - 4);
        ctx.moveTo(tProj.x, tProj.y + 4);
        ctx.lineTo(tProj.x, tProj.y + 16);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. Marcador destacado del punto seleccionado con doble clic en el mapa (`markedPoint`)
    if (markedPoint) {
      const mProj = projectRaDecToCanvas(
        markedPoint.ra,
        markedPoint.dec,
        ra0,
        dec0,
        scalePxPerRad,
        cx,
        cy
      );
      if (mProj.cosC > 0.05) {
        ctx.save();
        // Anillo exterior ámbar/dorado brillante
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(mProj.x, mProj.y, 13, 0, Math.PI * 2);
        ctx.stroke();

        // Punto central sólido
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(mProj.x, mProj.y, 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Mira extendida del punto marcado
        ctx.beginPath();
        ctx.moveTo(mProj.x - 21, mProj.y);
        ctx.lineTo(mProj.x - 8, mProj.y);
        ctx.moveTo(mProj.x + 8, mProj.y);
        ctx.lineTo(mProj.x + 21, mProj.y);
        ctx.moveTo(mProj.x, mProj.y - 21);
        ctx.lineTo(mProj.x, mProj.y - 8);
        ctx.moveTo(mProj.x, mProj.y + 8);
        ctx.lineTo(mProj.x, mProj.y + 21);
        ctx.stroke();

        // Etiqueta flotante junto al punto marcado en el lienzo
        const label = `RA ${markedPoint.ra.toFixed(3)}°, Dec ${markedPoint.dec.toFixed(3)}°`;
        ctx.font = "bold 10px ui-monospace, SFMono-Regular, Menlo, monospace";
        const textWidth = ctx.measureText(label).width;
        const boxX = Math.min(width - textWidth - 18, Math.max(8, mProj.x + 14));
        const boxY = Math.max(22, mProj.y - 12);

        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(boxX - 5, boxY - 11, textWidth + 10, 16, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fde68a";
        ctx.fillText(label, boxX, boxY);
        ctx.restore();
      }
    }
  }, [
    viewCenter,
    fovDeg,
    channelIdx,
    activeOrder,
    showMocWide,
    showMocDeep,
    showFootprints,
    showGrid,
    mocWideCells,
    mocDeepCells,
    observations,
    selectedObs,
    targetCoords,
    markedPoint,
    sideBySideOpen,
    sideTab,
    activeSideFrame,
    sideZoom,
    renderTick,
    triggerRepaint,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startRa: viewCenter.ra,
      startDec: viewCenter.dec,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const fovRad = Math.max(1.5, Math.min(160, fovDeg)) * DEG2RAD;
    const scalePxPerRad = Math.min(canvas.width, canvas.height) / (2 * Math.tan(fovRad / 4) * 2);
    const hovered = unprojectCanvasToRaDec(
      canvasX,
      canvasY,
      viewCenter.ra,
      viewCenter.dec,
      scalePxPerRad,
      canvas.width / 2,
      canvas.height / 2
    );
    setCursorCoords(hovered);

    if (!dragRef.current.dragging) return;

    const dxPx = e.clientX - dragRef.current.startX;
    const dyPx = e.clientY - dragRef.current.startY;
    const degPerPx = fovDeg / Math.min(rect.width, rect.height);

    const cosDec = Math.max(0.15, Math.cos(dragRef.current.startDec * DEG2RAD));
    const newRa = (((dragRef.current.startRa + (dxPx * degPerPx) / cosDec) % 360) + 360) % 360;
    const newDec = Math.max(-88, Math.min(88, dragRef.current.startDec + dyPx * degPerPx));

    setViewCenter({ ra: newRa, dec: newDec });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.dragging) {
      dragRef.current.dragging = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Interceptar el evento wheel nativo con { passive: false } para que la rueda del mouse
  // controle exclusivamente el zoom del mapa y nunca desplace (scroll) la página
  useEffect(() => {
    const el = mapViewportRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY === 0) return;
      const factor = e.deltaY > 0 ? 1.18 : 1 / 1.18;
      setFovDeg((prev) => Number(Math.max(2, Math.min(150, prev * factor)).toFixed(2)));
    };

    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onNativeWheel);
    };
  }, []);

  // Zoom con rueda del mouse en el segundo mapa (panel lateral FITS / video) sin desplazar la página
  useEffect(() => {
    const el = sideViewportRef.current;
    if (!el) return;

    const onSideWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY === 0) return;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setSideZoom((prev) => Number(Math.max(1, Math.min(6, prev * factor)).toFixed(2)));
    };

    el.addEventListener("wheel", onSideWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onSideWheel);
    };
  }, [sideBySideOpen, sideTab]);

  // Al hacer doble clic sobre un punto en el mapa, se marca ese punto (`markedPoint`).
  // Si el panel lateral ya estaba abierto, actualiza automáticamente las imágenes de ese nuevo punto.
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    let picked = cursorCoords;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
      const fovRad = Math.max(1.5, Math.min(160, fovDeg)) * DEG2RAD;
      const scalePxPerRad = Math.min(canvas.width, canvas.height) / (2 * Math.tan(fovRad / 4) * 2);
      picked =
        unprojectCanvasToRaDec(
          canvasX,
          canvasY,
          viewCenter.ra,
          viewCenter.dec,
          scalePxPerRad,
          canvas.width / 2,
          canvas.height / 2
        ) ?? cursorCoords;
    }

    if (!picked) return;
    setMarkedPoint({ ra: picked.ra, dec: picked.dec });

    if (sideBySideOpen && onQueryAtCoords) {
      onQueryAtCoords(picked.ra, picked.dec);
    }
  };

  // Abre el panel lateral con las imágenes FITS a color y transición tipo video del punto marcado
  const handleOpenSideBySide = () => {
    const pt = markedPoint ?? viewCenter;
    if (!markedPoint) {
      setMarkedPoint({ ra: pt.ra, dec: pt.dec });
    }
    setSideBySideOpen(true);
    setSideTab("video");
    setSideIsPlaying(true);

    const alreadyQueriedSamePoint =
      targetCoords &&
      Math.abs(targetCoords.ra - pt.ra) < 1e-4 &&
      Math.abs(targetCoords.dec - pt.dec) < 1e-4;

    if (!alreadyQueriedSamePoint && onQueryAtCoords) {
      onQueryAtCoords(pt.ra, pt.dec);
    }
  };

  const handleStepSideFrame = (delta: number) => {
    if (sideFrames.length === 0) return;
    setSideIsPlaying(false);
    const idx = sideFrames.findIndex((f) => f.key === activeSideFrame?.key);
    const baseIdx = idx === -1 ? 0 : idx;
    const nextIdx = (baseIdx + delta + sideFrames.length) % sideFrames.length;
    setSideActiveKey(sideFrames[nextIdx].key);
  };

  const currentWavelengthUm = SPHEREX_HIPS_WAVELENGTHS_UM[channelIdx] ?? 0.753;
  const currentBandLabel = getBandLabelForChannel(channelIdx);
  const activeSideEntry = activeSideFrame ? sideRenderedMap[activeSideFrame.key] : undefined;
  const activeSideIdx = sideFrames.findIndex((f) => f.key === activeSideFrame?.key);
  const fadeDurationMs = sideSmoothFade ? Math.min(450, Math.floor(sideSpeedMs * 0.45)) : 0;
  const displayPinCoords = markedPoint ?? (targetCoords ? { ra: targetCoords.ra, dec: targetCoords.dec } : viewCenter);

  return (
    <div className="bg-space-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3.5">
      {/* Encabezado del Mapa Espacial HiPS / MOC */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/70 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 flex-wrap">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>{t.skyMap.title}</span>
            {loadingMoc && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />}
            {sideBySideOpen && (
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-950/90 text-amber-300 border border-amber-600/60 rounded-full flex items-center gap-1">
                <Columns2 className="w-3 h-3" />
                {t.skyMap.sideBySideActiveBadge}
              </span>
            )}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{t.skyMap.subtitle}</p>
        </div>

        {/* Botones de Capas MOC, Huellas FITS y Malla */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowMocDeep((v) => !v)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              showMocDeep
                ? "bg-purple-950/80 border-purple-500 text-purple-200"
                : "bg-space-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>{t.skyMap.mocDeepLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMocWide((v) => !v)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              showMocWide
                ? "bg-sky-950/80 border-sky-500 text-sky-200"
                : "bg-space-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>{t.skyMap.mocWideLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFootprints((v) => !v)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              showFootprints
                ? "bg-amber-950/80 border-amber-500 text-amber-200"
                : "bg-space-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>{t.skyMap.footprintsLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              showGrid
                ? "bg-cyan-950/80 border-cyan-500 text-cyan-200"
                : "bg-space-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Grid className="w-3 h-3" />
            <span>{t.skyMap.gridLabel}</span>
          </button>
        </div>
      </div>

      {/* Contenedor Principal: Mapa a pantalla completa o Vista Lado a Lado (Mapa + Imágenes/Video del punto marcado) */}
      <div
        className={`grid gap-4 items-stretch ${
          sideBySideOpen ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {/* Columna Izquierda: Lienzo Interactivo del Cielo (HiPS All-Sky Cube) */}
        <div
          ref={mapViewportRef}
          className="relative w-full aspect-[16/10] max-h-[480px] bg-[#04070f] rounded-xl overflow-hidden border border-slate-800 select-none overscroll-none"
        >
          <canvas
            ref={canvasRef}
            width={760}
            height={475}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
          />

          {/* HUD Superior Izquierdo: Estado HEALPix y Coordenadas */}
          <div className="absolute top-3 left-3 flex flex-col gap-1 bg-space-950/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">
                {t.skyMap.fovLabel(fovDeg.toFixed(1))}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-400">{t.skyMap.orderLabel(activeOrder)}</span>
            </div>
            <div>
              RA {viewCenter.ra.toFixed(4)}° · Dec {viewCenter.dec.toFixed(4)}°
            </div>
            {cursorCoords && (
              <div className="text-[10px] text-slate-400">
                {t.skyMap.cursorCoords({
                  ra: cursorCoords.ra.toFixed(4),
                  dec: cursorCoords.dec.toFixed(4),
                })}
              </div>
            )}
          </div>

          {/* Controles Flotantes de Zoom y Centrado */}
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-space-950/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-300 shadow-lg">
            <button
              type="button"
              onClick={() => setFovDeg((f) => Math.max(2, Number((f * 0.7).toFixed(2))))}
              className="p-1 hover:text-white transition-colors cursor-pointer"
              title={t.viewer.zoomInTitle}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setFovDeg((f) => Math.min(150, Number((f / 0.7).toFixed(2))))}
              className="p-1 hover:text-white transition-colors cursor-pointer"
              title={t.viewer.zoomOutTitle}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            {targetCoords && (
              <button
                type="button"
                onClick={() => {
                  setViewCenter({ ra: targetCoords.ra, dec: targetCoords.dec });
                  setFovDeg(25);
                }}
                className="p-1 hover:text-cyan-300 border-l border-slate-800 pl-1.5 transition-colors cursor-pointer"
                title={t.skyMap.centerOnTarget}
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setFovDeg(90)}
              className="p-1 hover:text-white border-l border-slate-800 pl-1.5 transition-colors cursor-pointer"
              title={t.viewer.resetZoomTitle}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Barra Inferior Flotante: Punto Marcado con Doble Clic + Opción de Abrir Imágenes de Color y Video al Lado */}
          <div className="absolute bottom-3 inset-x-3 flex flex-col gap-2 bg-space-950/95 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800/90 text-[11px] shadow-xl">
            {markedPoint ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/60 text-amber-200 font-mono font-semibold text-xs">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {t.skyMap.markedPointBadge({
                      ra: markedPoint.ra.toFixed(4),
                      dec: markedPoint.dec.toFixed(4),
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMarkedPoint(null);
                      setSideBySideOpen(false);
                    }}
                    className="px-2 py-1 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>{t.skyMap.clearPinAction}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleOpenSideBySide}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-cyan-500 hover:from-amber-400 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>{t.skyMap.openSideBySideAction}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-slate-400">{t.skyMap.doubleClickHint}</span>
                {onQueryAtCoords && (
                  <button
                    type="button"
                    onClick={() => onQueryAtCoords(viewCenter.ra, viewCenter.dec)}
                    className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>{t.skyMap.searchHereButton}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha (Lado a Lado): Imágenes FITS a Color y Reproductor Tipo "Video" de la Zona Marcada */}
        {sideBySideOpen && (
          <div className="bg-space-900/85 border border-amber-500/40 rounded-xl p-3.5 flex flex-col gap-3 shadow-2xl">
            {/* Encabezado del Panel Lateral */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t.skyMap.sidePanelTitle}</span>
                </h4>
                <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                  {t.skyMap.sidePanelSubtitle({
                    ra: displayPinCoords.ra.toFixed(4),
                    dec: displayPinCoords.dec.toFixed(4),
                    count: observations.length,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSideBySideOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title={t.skyMap.closeSideBySideAction}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector de Pestaña del Panel Lateral: Video/Transición | Imagen FITS Activa | Bandas D1–D6 */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-space-950/90 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSideTab("video")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    sideTab === "video"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>{t.skyMap.sidePanelTabVideo}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSideTab("cutout")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    sideTab === "cutout"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{t.skyMap.sidePanelTabCutout}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSideTab("bands")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    sideTab === "bands"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>{t.skyMap.sidePanelTabBands}</span>
                </button>
              </div>

              {/* Filtro rápido de banda para el modo Video */}
              {sideTab === "video" && availableBands.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSideBandFilter("ALL")}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                      sideBandFilter === "ALL"
                        ? "bg-cyan-950 border-cyan-500 text-cyan-200"
                        : "bg-space-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t.epochPlayer.allBands}
                  </button>
                  {availableBands.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSideBandFilter(b)}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                        sideBandFilter === b
                          ? "bg-cyan-950 border-cyan-500 text-cyan-200"
                          : "bg-space-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selector de Fechas para cargar únicamente las imágenes de las fechas elegidas */}
            {availableDates.length > 0 && (
              <div className="bg-space-950/70 border border-slate-800/80 rounded-lg p-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.skyMap.sideDatesLabel}</span>
                    <span className="font-mono text-[10px] text-amber-300">
                      ({selectedSideDates.size}/{availableDates.length})
                    </span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSideDates(new Set(availableDates))}
                      className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                    >
                      {t.skyMap.sideDatesSelectAll}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSideIsPlaying(false);
                        setSelectedSideDates(new Set());
                      }}
                      className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-800/70 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    >
                      {t.skyMap.sideDatesClear}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap max-h-20 overflow-y-auto">
                  {availableDates.map((dateStr) => {
                    const active = selectedSideDates.has(dateStr);
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => {
                          setSelectedSideDates((prev) => {
                            const next = new Set(prev);
                            if (next.has(dateStr)) {
                              next.delete(dateStr);
                            } else {
                              next.add(dateStr);
                            }
                            return next;
                          });
                        }}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                          active
                            ? "bg-amber-500/25 border-amber-400 text-amber-200 font-semibold"
                            : "bg-space-900/70 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {dateStr}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Contenido según pestaña seleccionada */}
            {sideTab === "video" && (
              <div className="flex flex-col gap-2.5">
                {/* Lienzo de Video / Transición de Imágenes FITS a Color con el Punto Central Marcado y Zoom */}
                <div
                  ref={sideViewportRef}
                  className="relative w-full aspect-square max-h-[300px] bg-black/95 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center overscroll-none"
                >
                  {availableDates.length > 0 && selectedSideDates.size === 0 ? (
                    <span className="text-xs text-slate-400 px-4 text-center">
                      {t.skyMap.sideNoDatesSelected}
                    </span>
                  ) : (
                    <>
                      {sideSmoothFade && sidePrevDataUrl && (
                        <img
                          src={sidePrevDataUrl}
                          alt=""
                          aria-hidden="true"
                          style={{
                            transform: `scale(${sideZoom})`,
                            transformOrigin: "center center",
                          }}
                          className="absolute inset-0 w-full h-full object-contain [image-rendering:pixelated] pointer-events-none transition-transform duration-150"
                        />
                      )}

                      {activeSideEntry?.status === "ready" && activeSideEntry.cutout ? (
                        <img
                          key={activeSideFrame?.key}
                          src={activeSideEntry.cutout.dataUrl}
                          alt={activeSideFrame ? `#${activeSideFrame.number}` : ""}
                          style={{
                            transitionDuration: `${fadeDurationMs}ms`,
                            transform: `scale(${sideZoom})`,
                            transformOrigin: "center center",
                          }}
                          className="relative w-full h-full object-contain [image-rendering:pixelated] transition-all ease-in-out"
                        />
                      ) : cutout && sideFrames.length > 0 ? (
                        <img
                          src={cutout.dataUrl}
                          alt={t.viewer.altCutout}
                          style={{
                            transform: `scale(${sideZoom})`,
                            transformOrigin: "center center",
                          }}
                          className="relative w-full h-full object-contain [image-rendering:pixelated] opacity-85 transition-transform duration-150"
                        />
                      ) : observations.length === 0 && !cutoutLoading ? (
                        <span className="text-xs text-slate-400 px-4 text-center">
                          {t.skyMap.sidePanelNoCoverage}
                        </span>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-300 px-4 text-center">
                          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                          <span className="text-xs">{t.skyMap.sidePanelLoading}</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Marcador prominente del Punto Central Seleccionado sobre las imágenes en transición */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full border-2 border-amber-400/90 shadow-[0_0_12px_rgba(251,191,36,0.75)]" />
                    <div className="w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,1)]" />
                    <div className="absolute w-16 h-[1.5px] bg-amber-400/85" />
                    <div className="absolute h-16 w-[1.5px] bg-amber-400/85" />
                  </div>

                  {/* Insignia del Fotograma Activo */}
                  {activeSideFrame && (
                    <div className="absolute top-2.5 left-2.5 max-w-[52%] flex items-center gap-2 bg-space-950/90 backdrop-blur-md px-2 py-1 rounded-lg border border-amber-500/60 shadow-lg">
                      <span className="w-5 h-5 rounded bg-amber-400 text-slate-950 font-extrabold text-[11px] flex items-center justify-center font-mono shrink-0">
                        {activeSideFrame.number}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-white font-mono truncate">
                          {activeSideFrame.dateTimeLabel}
                        </span>
                        <span className="text-[9px] text-amber-300 font-mono truncate">
                          {activeSideFrame.obs.bandpass} · {activeSideFrame.obs.obs_id}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Controles de Zoom + Contador de secuencia */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5 bg-space-950/90 border border-slate-700 rounded-lg px-1.5 py-0.5 text-[10px] text-slate-200">
                      <button
                        type="button"
                        onClick={() => setSideZoom((z) => Math.min(6, Number((z * 1.25).toFixed(2))))}
                        disabled={sideZoom >= 6}
                        className="p-0.5 hover:text-white disabled:opacity-40 cursor-pointer"
                        title={t.viewer.zoomInTitle}
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-amber-300 px-1">
                        {t.skyMap.sideZoomLabel(sideZoom.toFixed(1))}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSideZoom((z) => Math.max(1, Number((z / 1.25).toFixed(2))))}
                        disabled={sideZoom <= 1}
                        className="p-0.5 hover:text-white disabled:opacity-40 cursor-pointer"
                        title={t.viewer.zoomOutTitle}
                      >
                        <ZoomOut className="w-3 h-3" />
                      </button>
                      {sideZoom !== 1 && (
                        <button
                          type="button"
                          onClick={() => setSideZoom(1)}
                          className="p-0.5 hover:text-white border-l border-slate-700 pl-1 cursor-pointer"
                          title={t.viewer.visualZoomReset}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {activeSideIdx >= 0 && (
                      <div className="px-2 py-0.5 rounded bg-space-950/90 border border-slate-700 text-[10px] font-mono text-slate-200">
                        {t.epochPlayer.frameCounter({
                          current: activeSideIdx + 1,
                          total: sideFrames.length,
                        })}
                      </div>
                    )}
                  </div>

                  {/* Etiqueta inferior que identifica la marca de la coordenada central seleccionada */}
                  <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between gap-2 bg-space-950/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-amber-500/50 text-[10px] font-mono text-amber-200 pointer-events-none">
                    <span className="flex items-center gap-1 truncate">
                      <Crosshair className="w-3 h-3 text-amber-400 shrink-0" />
                      {t.skyMap.sidePanelCenterMarkerLabel}
                    </span>
                    <span className="text-white font-semibold shrink-0">
                      RA {displayPinCoords.ra.toFixed(4)}°, Dec {displayPinCoords.dec.toFixed(4)}°
                    </span>
                  </div>
                </div>

                {/* Controles de Reproducción del Video de la Zona */}
                <div className="bg-space-950/80 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStepSideFrame(-1)}
                        className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                        title={t.epochPlayer.prevFrame}
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSideIsPlaying((p) => !p)}
                        disabled={sideFrames.length <= 1}
                        className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                          sideIsPlaying
                            ? "bg-amber-400 hover:bg-amber-300 text-slate-950"
                            : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                        }`}
                      >
                        {sideIsPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>{t.epochPlayer.pause}</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>{t.epochPlayer.play}</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepSideFrame(1)}
                        className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                        title={t.epochPlayer.nextFrame}
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSideLoop((v) => !v)}
                        className={`px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1 cursor-pointer ${
                          sideLoop
                            ? "bg-cyan-950/80 border-cyan-600 text-cyan-200"
                            : "bg-space-900 border-slate-800 text-slate-400"
                        }`}
                      >
                        <Repeat className="w-3 h-3" />
                        <span>{t.epochPlayer.loopLabel}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSideSmoothFade((v) => !v)}
                        className={`px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1 cursor-pointer ${
                          sideSmoothFade
                            ? "bg-cyan-950/80 border-cyan-600 text-cyan-200"
                            : "bg-space-900 border-slate-800 text-slate-400"
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{t.epochPlayer.crossfadeLabel}</span>
                      </button>
                      <input
                        type="range"
                        min={200}
                        max={2200}
                        step={50}
                        value={sideSpeedMs}
                        onChange={(e) => setSideSpeedMs(Number(e.target.value))}
                        className="w-20 accent-amber-400 cursor-pointer"
                        title={t.epochPlayer.speedUnit(sideSpeedMs)}
                      />
                    </div>
                  </div>

                  {/* Tira de miniaturas / números de fotograma para saltar directamente a una imagen */}
                  {sideFrames.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                      {sideFrames.map((f) => {
                        const isCurrent = activeSideFrame?.key === f.key;
                        const ready = sideRenderedMap[f.key]?.status === "ready";
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => {
                              setSideIsPlaying(false);
                              setSideActiveKey(f.key);
                              onSelectObservation?.(f.obs);
                            }}
                            className={`px-2 py-1 rounded-md text-[10px] font-mono border flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                              isCurrent
                                ? "bg-amber-400 text-slate-950 border-amber-300 font-bold"
                                : ready
                                ? "bg-space-900 text-cyan-200 border-slate-700 hover:border-amber-400/60"
                                : "bg-space-950 text-slate-500 border-slate-800"
                            }`}
                          >
                            <span>#{f.number}</span>
                            <span>{f.obs.bandpass}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {sideTab === "cutout" && (
              <div
                ref={sideViewportRef}
                className="relative w-full aspect-square max-h-[340px] bg-black/95 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center overscroll-none"
              >
                {cutout ? (
                  <>
                    <img
                      src={cutout.dataUrl}
                      alt={t.viewer.altCutout}
                      style={{
                        transform: `scale(${sideZoom})`,
                        transformOrigin: "center center",
                      }}
                      className="w-full h-full object-contain [image-rendering:pixelated] transition-transform duration-150"
                    />
                    {/* Retícula del punto central seleccionado */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-9 h-9 rounded-full border-2 border-amber-400/90 shadow-[0_0_12px_rgba(251,191,36,0.75)]" />
                      <div className="w-2 h-2 rounded-full bg-amber-300" />
                      <div className="absolute w-16 h-[1.5px] bg-amber-400/85" />
                      <div className="absolute h-16 w-[1.5px] bg-amber-400/85" />
                    </div>
                    {selectedObs && (
                      <div className="absolute top-2.5 left-2.5 bg-space-950/90 px-2.5 py-1 rounded-lg border border-cyan-700/60 text-[11px] font-mono text-cyan-200">
                        {selectedObs.bandpass} · {selectedObs.obs_id}
                      </div>
                    )}
                    {/* Controles de Zoom Visual y FOV */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-space-950/90 border border-slate-700 rounded-lg px-1.5 py-0.5 text-[10px] text-slate-200">
                      <button
                        type="button"
                        onClick={() => setSideZoom((z) => Math.min(6, Number((z * 1.25).toFixed(2))))}
                        disabled={sideZoom >= 6}
                        className="p-0.5 hover:text-white disabled:opacity-40 cursor-pointer"
                        title={t.viewer.zoomInTitle}
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-amber-300 px-1">
                        {t.skyMap.sideZoomLabel(sideZoom.toFixed(1))}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSideZoom((z) => Math.max(1, Number((z / 1.25).toFixed(2))))}
                        disabled={sideZoom <= 1}
                        className="p-0.5 hover:text-white disabled:opacity-40 cursor-pointer"
                        title={t.viewer.zoomOutTitle}
                      >
                        <ZoomOut className="w-3 h-3" />
                      </button>
                      {sideZoom !== 1 && (
                        <button
                          type="button"
                          onClick={() => setSideZoom(1)}
                          className="p-0.5 hover:text-white border-l border-slate-700 pl-1 cursor-pointer"
                          title={t.viewer.visualZoomReset}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                      {onChangeFov && targetCoords && (
                        <div className="flex items-center gap-0.5 border-l border-slate-700 pl-1 ml-0.5">
                          <button
                            type="button"
                            onClick={() => onChangeFov(targetCoords.size * 0.7)}
                            disabled={targetCoords.size <= 0.02}
                            className="px-1 hover:text-cyan-300 disabled:opacity-40 cursor-pointer font-mono"
                            title={t.viewer.fovInTitle}
                          >
                            FOV-
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeFov(targetCoords.size / 0.7)}
                            disabled={targetCoords.size >= 1.0}
                            className="px-1 hover:text-cyan-300 disabled:opacity-40 cursor-pointer font-mono"
                            title={t.viewer.fovOutTitle}
                          >
                            FOV+
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between gap-2 bg-space-950/90 px-2.5 py-1 rounded-md border border-amber-500/50 text-[10px] font-mono text-amber-200">
                      <span>{t.skyMap.sidePanelCenterMarkerLabel}</span>
                      <span className="text-white font-semibold">
                        RA {displayPinCoords.ra.toFixed(4)}°, Dec {displayPinCoords.dec.toFixed(4)}°
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-300 px-4 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    <span className="text-xs">{t.skyMap.sidePanelLoading}</span>
                  </div>
                )}
              </div>
            )}

            {sideTab === "bands" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                {bandRepresentatives.map((item) => {
                  const entry = sideRenderedMap[item.key];
                  const isSelected =
                    selectedObs?.obs_id === item.obs.obs_id &&
                    selectedObs?.bandpass === item.obs.bandpass;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onSelectObservation?.(item.obs)}
                      className={`group rounded-xl overflow-hidden border text-left transition-all flex flex-col cursor-pointer ${
                        isSelected
                          ? "bg-amber-950/40 border-amber-400 ring-1 ring-amber-400/40"
                          : "bg-space-950/80 border-slate-800 hover:border-amber-500/60"
                      }`}
                    >
                      <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
                        {entry?.status === "ready" && entry.cutout ? (
                          <img
                            src={entry.cutout.dataUrl}
                            alt={item.obs.bandpass}
                            className="w-full h-full object-contain [image-rendering:pixelated]"
                          />
                        ) : entry?.status === "error" ? (
                          <span className="text-[10px] text-rose-400 px-2 text-center">
                            {t.epochPlayer.errorFrame}
                          </span>
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        )}
                        {/* Marca del punto central en cada banda de color */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full border border-amber-400/85" />
                          <div className="absolute w-8 h-[1px] bg-amber-400/80" />
                          <div className="absolute h-8 w-[1px] bg-amber-400/80" />
                        </div>
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-space-950/90 border border-amber-500/50 text-[10px] font-mono font-bold text-amber-300">
                          {item.obs.bandpass}
                        </span>
                      </div>
                      <div className="p-1.5 flex items-center justify-between text-[10px] font-mono text-slate-300">
                        <span className="truncate">{item.dateTimeLabel}</span>
                        {item.obs.em_min_um !== null && item.obs.em_max_um !== null && (
                          <span className="text-cyan-300 shrink-0">
                            {item.obs.em_min_um}–{item.obs.em_max_um}µm
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selector de los 102 Canales Espectrales del Cubo HiPS de SPHEREx */}
      <div className="bg-space-900/70 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-medium">{t.skyMap.channelLabel}</span>
          <span className="font-mono text-cyan-300 text-[11px] bg-space-950 px-2 py-0.5 rounded border border-slate-800">
            {t.skyMap.channelInfo({
              idx: channelIdx + 1,
              total: SPHEREX_HIPS_WAVELENGTHS_UM.length,
              um: currentWavelengthUm.toFixed(3),
              band: currentBandLabel,
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="range"
            min={0}
            max={SPHEREX_HIPS_WAVELENGTHS_UM.length - 1}
            step={1}
            value={channelIdx}
            onChange={(e) => setChannelIdx(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
            aria-label={t.skyMap.channelLabel}
          />
        </div>
      </div>
    </div>
  );
};
