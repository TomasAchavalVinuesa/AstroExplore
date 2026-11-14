import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Columns2,
  Compass,
  Crosshair,
  Grid,
  Layers,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { formatDectoDMS, formatRAtoHMS } from "../lib/coordinates";
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
import type {
  ColormapName,
  RenderedCutout,
  SpherexObservation,
  StretchMode,
} from "../lib/types";

interface HipsSkyMapPanelProps {
  targetCoords: { ra: number; dec: number; size: number } | null;
  targetName?: string;
  observations: SpherexObservation[];
  selectedObs: SpherexObservation | null;
  cutout?: RenderedCutout | null;
  cutoutLoading?: boolean;
  stretch?: StretchMode;
  colormap?: ColormapName;
  subtractZodi?: boolean;
  secondMapOpen?: boolean;
  onToggleSecondMap?: (open: boolean) => void;
  externalChannelIdx?: number | null;
  secondMapZoom?: number;
  onChangeFov?: (newSize: number) => void;
  onSelectObservation?: (obs: SpherexObservation) => void;
  onQueryAtCoords?: (raDeg: number, decDeg: number) => void;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

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

  const decRad = Math.asin(
    Math.max(-1, Math.min(1, cosC * sinDec0 + (dy * sinC * cosDec0) / rho))
  );
  const dRa = Math.atan2(dx * sinC, rho * cosDec0 * cosC - dy * sinDec0 * sinC);

  const raDeg = (((ra0 + dRa * RAD2DEG) % 360) + 360) % 360;
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
  targetName = "WISE 0855",
  observations,
  selectedObs,
  secondMapOpen = false,
  onToggleSecondMap,
  externalChannelIdx,
  secondMapZoom = 1,
  onQueryAtCoords,
}) => {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);

  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 760,
    height: 480,
  });

  const [viewCenter, setViewCenter] = useState<{ ra: number; dec: number }>(() => ({
    ra: targetCoords?.ra ?? 133.79513,
    dec: targetCoords?.dec ?? -7.24515,
  }));
  const [fovDeg, setFovDeg] = useState<number>(35);
  const [channelIdx, setChannelIdx] = useState<number>(0);
  const [showChannelBar, setShowChannelBar] = useState<boolean>(false);

  const [showMocWide, setShowMocWide] = useState<boolean>(false);
  const [showMocDeep, setShowMocDeep] = useState<boolean>(true);
  const [showFootprints, setShowFootprints] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  const [mocWideCells, setMocWideCells] = useState<MocCell[] | null>(null);
  const [mocDeepCells, setMocDeepCells] = useState<MocCell[] | null>(null);
  const [loadingMoc, setLoadingMoc] = useState<boolean>(false);

  const [cursorCoords, setCursorCoords] = useState<{ ra: number; dec: number } | null>(null);
  const [renderTick, setRenderTick] = useState<number>(0);
  const [markedPoint, setMarkedPoint] = useState<{ ra: number; dec: number } | null>(null);

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

  useEffect(() => {
    if (typeof externalChannelIdx === "number" && externalChannelIdx >= 0) {
      setChannelIdx(externalChannelIdx);
    }
  }, [externalChannelIdx]);

  // Observe container resize (especially when splitting into 2 maps side by side)
  useEffect(() => {
    const el = mapViewportRef.current;
    if (!el) return;

    const updateDimensions = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.max(240, Math.floor(rect.height));
      setCanvasSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(el);
    return () => observer.disconnect();
  }, [secondMapOpen]);

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

  const activeOrder = fovDeg > 85 ? 0 : fovDeg > 38 ? 1 : fovDeg > 16 ? 2 : fovDeg > 7 ? 3 : 4;

  const triggerRepaint = useCallback(() => {
    setRenderTick((n) => n + 1);
  }, []);

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

    ctx.fillStyle = "#04060A";
    ctx.fillRect(0, 0, width, height);

    const ra0 = viewCenter.ra;
    const dec0 = viewCenter.dec;

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
      ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
      ctx.fillStyle = "rgba(148, 163, 184, 0.65)";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.lineWidth = 1;

      const stepRa = fovDeg > 60 ? 30 : fovDeg > 20 ? 10 : fovDeg > 6 ? 2 : 1;
      const stepDec = fovDeg > 60 ? 20 : fovDeg > 20 ? 10 : fovDeg > 6 ? 2 : 1;

      for (let dec = -80; dec <= 80; dec += stepDec) {
        ctx.beginPath();
        let started = false;
        for (let ra = 0; ra <= 360; ra += 2) {
          const p = projectRaDecToCanvas(ra, dec, ra0, dec0, scalePxPerRad, cx, cy);
          if (
            p.cosC > 0.1 &&
            p.x >= -50 &&
            p.x <= width + 50 &&
            p.y >= -50 &&
            p.y <= height + 50
          ) {
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
          if (
            p.cosC > 0.1 &&
            p.x >= -50 &&
            p.x <= width + 50 &&
            p.y >= -50 &&
            p.y <= height + 50
          ) {
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
          labelPt.y > 54 &&
          labelPt.y < height - 54
        ) {
          ctx.fillText(`${ra}°`, labelPt.x + 3, labelPt.y - 3);
        }
      }
      ctx.restore();
    }

    // 4. Huellas poligonales (`s_region`) de las exposiciones encontradas
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
          ctx.strokeStyle = "rgba(0, 210, 255, 0.95)";
          ctx.fillStyle = "rgba(0, 210, 255, 0.14)";
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.strokeStyle = "rgba(251, 191, 36, 0.30)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 4b. Resaltar en el Mapa 1 el recuadro exacto de lo que muestra el Mapa 2 cuando está abierto
    if (secondMapOpen) {
      const boxCenter = markedPoint ?? targetCoords ?? viewCenter;
      const baseSizeDeg = targetCoords?.size ?? 0.15;
      const effectiveSizeDeg = baseSizeDeg / Math.max(1, secondMapZoom);
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
        ctx.strokeStyle = "#00D2FF";
        ctx.fillStyle = "rgba(0, 210, 255, 0.16)";
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

    // 5. Marcador de la coordenada objetivo actual (estilo CHRONO-SPHEREx)
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
        const glow = ctx.createRadialGradient(tProj.x, tProj.y, 2, tProj.x, tProj.y, 26);
        glow.addColorStop(0, "rgba(0, 210, 255, 0.85)");
        glow.addColorStop(0.35, "rgba(0, 210, 255, 0.22)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(tProj.x, tProj.y, 26, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 210, 255, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tProj.x, tProj.y, 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tProj.x - 20, tProj.y);
        ctx.lineTo(tProj.x - 6, tProj.y);
        ctx.moveTo(tProj.x + 6, tProj.y);
        ctx.lineTo(tProj.x + 20, tProj.y);
        ctx.moveTo(tProj.x, tProj.y - 20);
        ctx.lineTo(tProj.x, tProj.y - 6);
        ctx.moveTo(tProj.x, tProj.y + 6);
        ctx.lineTo(tProj.x, tProj.y + 20);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. Marcador destacado del punto seleccionado con doble clic (`markedPoint`)
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
        ctx.strokeStyle = "#FFB703";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(mProj.x, mProj.y, 13, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#FFB703";
        ctx.beginPath();
        ctx.arc(mProj.x, mProj.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [
    canvasSize,
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
    secondMapOpen,
    secondMapZoom,
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

  // Zoom con rueda del mouse en el mapa celeste
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

  // Al hacer doble clic sobre un punto en el mapa, marca el punto y hace surgir el segundo mapa dividiendo el espacio en 2
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
    onToggleSecondMap?.(true);
    onQueryAtCoords?.(picked.ra, picked.dec);
  };

  const currentWavelengthUm = SPHEREX_HIPS_WAVELENGTHS_UM[channelIdx] ?? 0.753;
  const currentBandLabel = getBandLabelForChannel(channelIdx);

  const readoutRa = targetCoords?.ra ?? viewCenter.ra;
  const readoutDec = targetCoords?.dec ?? viewCenter.dec;

  return (
    <div
      ref={mapViewportRef}
      className="relative w-full h-full min-h-[280px] rounded-[22px] overflow-hidden border border-white/15 bg-black shadow-2xl select-none overscroll-none"
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Top-Left Coordinates Pill (Exact CHRONO-SPHEREx style) */}
      <div className="glass-panel absolute top-4 left-4 rounded-full px-4 py-1.5 flex items-center gap-2.5 text-xs font-mono text-slate-100 pointer-events-none max-w-[65%] truncate">
        <span className="w-2 h-2 rounded-full bg-[#00D2FF] shadow-[0_0_8px_#00D2FF] shrink-0" />
        <span className="truncate">
          RA {formatRAtoHMS(readoutRa)} · Dec {formatDectoDMS(readoutDec)}
        </span>
      </div>

      {/* Top-Right Target Badge + Map Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 flex-wrap justify-end max-w-[65%]">
        <div className="glass-panel rounded-full px-3.5 py-1.5 text-xs text-slate-200 font-medium flex items-center gap-2">
          {loadingMoc && <Loader2 className="w-3 h-3 animate-spin text-[#00D2FF]" />}
          <span className="truncate max-w-[160px]">{targetName}</span>
          <span className="text-[10px] font-mono text-[#00D2FF]">
            FOV {fovDeg.toFixed(0)}°
          </span>
        </div>

        {/* Toggle 2nd Map Split Button */}
        {onToggleSecondMap && (
          <button
            type="button"
            onClick={() => onToggleSecondMap(!secondMapOpen)}
            className={`btn-press glass-panel rounded-full px-3.5 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              secondMapOpen
                ? "border-[#00D2FF]/70 text-[#00D2FF] bg-[#00D2FF]/15"
                : "text-slate-200 hover:text-white"
            }`}
            title={
              secondMapOpen ? t.chrono.closeSecondMapButton : t.chrono.splitSecondMapButton
            }
          >
            <Columns2 className="w-3.5 h-3.5 text-[#00D2FF]" />
            <span className="hidden sm:inline">
              {secondMapOpen ? t.chrono.closeSecondMapButton : t.chrono.splitSecondMapButton}
            </span>
          </button>
        )}
      </div>

      {/* Bottom-Left Layer & Zoom Pill Controls */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="glass-panel rounded-full px-3 py-1.5 flex items-center gap-1.5 text-[11px] pointer-events-auto flex-wrap">
          <button
            type="button"
            onClick={() => setShowMocDeep((v) => !v)}
            className={`btn-press px-2 py-0.5 rounded-full transition-colors cursor-pointer flex items-center gap-1 ${
              showMocDeep ? "bg-purple-500/30 text-purple-200" : "text-slate-400 hover:text-white"
            }`}
            title={t.skyMap.mocDeepLabel}
          >
            <Layers className="w-3 h-3" />
            <span>Deep</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMocWide((v) => !v)}
            className={`btn-press px-2 py-0.5 rounded-full transition-colors cursor-pointer flex items-center gap-1 ${
              showMocWide ? "bg-sky-500/30 text-sky-200" : "text-slate-400 hover:text-white"
            }`}
            title={t.skyMap.mocWideLabel}
          >
            <Layers className="w-3 h-3" />
            <span>Wide</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFootprints((v) => !v)}
            className={`btn-press px-2 py-0.5 rounded-full transition-colors cursor-pointer flex items-center gap-1 ${
              showFootprints
                ? "bg-amber-500/30 text-amber-200"
                : "text-slate-400 hover:text-white"
            }`}
            title={t.skyMap.footprintsLabel}
          >
            <Compass className="w-3 h-3" />
            <span>FITS</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            className={`btn-press px-2 py-0.5 rounded-full transition-colors cursor-pointer flex items-center gap-1 ${
              showGrid ? "bg-[#00D2FF]/25 text-[#00D2FF]" : "text-slate-400 hover:text-white"
            }`}
            title={t.skyMap.gridLabel}
          >
            <Grid className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => setShowChannelBar((v) => !v)}
            className={`btn-press px-2 py-0.5 rounded-full transition-colors cursor-pointer flex items-center gap-1 font-mono ${
              showChannelBar
                ? "bg-[#00D2FF]/25 text-[#00D2FF]"
                : "text-slate-300 hover:text-white"
            }`}
            title={t.skyMap.channelLabel}
          >
            <SlidersHorizontal className="w-3 h-3 text-[#00D2FF]" />
            <span>{currentWavelengthUm.toFixed(2)}µm</span>
          </button>
        </div>

        {/* Right Floating Zoom & Pin Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {markedPoint && (
            <div className="glass-panel rounded-full px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-mono text-amber-200">
              <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="hidden md:inline">
                {markedPoint.ra.toFixed(2)}°, {markedPoint.dec.toFixed(2)}°
              </span>
              <button
                type="button"
                onClick={() => setMarkedPoint(null)}
                className="hover:text-white cursor-pointer"
                title={t.skyMap.clearPinAction}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {onQueryAtCoords && (
            <button
              type="button"
              onClick={() => {
                onToggleSecondMap?.(true);
                onQueryAtCoords(viewCenter.ra, viewCenter.dec);
              }}
              className="btn-press glass-panel rounded-full px-3 py-1.5 text-[11px] font-medium text-[#00D2FF] hover:text-white flex items-center gap-1.5 cursor-pointer"
              title={t.skyMap.searchHereButton}
            >
              <Search className="w-3 h-3" />
              <span className="hidden sm:inline">{t.skyMap.searchHereButton}</span>
            </button>
          )}

          <div className="glass-panel rounded-full px-2.5 py-1 flex items-center gap-1 text-xs text-slate-300">
            <button
              type="button"
              onClick={() => setFovDeg((f) => Math.max(2, Number((f * 0.7).toFixed(2))))}
              className="p-1 hover:text-white cursor-pointer"
              title={t.viewer.zoomInTitle}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setFovDeg((f) => Math.min(150, Number((f / 0.7).toFixed(2))))}
              className="p-1 hover:text-white cursor-pointer"
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
                className="p-1 hover:text-[#00D2FF] border-l border-white/10 pl-1.5 cursor-pointer"
                title={t.skyMap.centerOnTarget}
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setFovDeg(35)}
              className="p-1 hover:text-white border-l border-white/10 pl-1.5 cursor-pointer"
              title={t.viewer.resetZoomTitle}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Popover HiPS 102-Channel Spectral Slider */}
      {showChannelBar && (
        <div className="glass-panel absolute bottom-16 left-4 right-4 max-w-md rounded-2xl px-4 py-2.5 flex items-center gap-3 text-xs z-20">
          <span className="font-mono text-[11px] text-[#00D2FF] shrink-0">
            Ch {channelIdx + 1}/102 · {currentWavelengthUm.toFixed(3)} µm ({currentBandLabel})
          </span>
          <input
            type="range"
            min={0}
            max={SPHEREX_HIPS_WAVELENGTHS_UM.length - 1}
            step={1}
            value={channelIdx}
            onChange={(e) => setChannelIdx(Number(e.target.value))}
            className="apple-slider flex-1"
            aria-label={t.skyMap.channelLabel}
          />
        </div>
      )}
    </div>
  );
};
