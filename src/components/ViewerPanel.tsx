import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Columns2,
  Copy,
  Download,
  FileDown,
  Globe,
  Image as ImageIcon,
  Info,
  Loader2,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type {
  CollectionVersionData,
  ColormapName,
  RenderedCutout,
  ResolvedCelestialObject,
  SpherexCollectionId,
  SpherexObservation,
  StretchMode,
} from "../lib/types";
import { computeAxisTicks } from "../lib/coordinates";
import { useLanguage } from "../i18n/LanguageContext";
import { MultiVersionGallery } from "./MultiVersionGallery";
import { EpochTimeLapsePanel } from "./EpochTimeLapsePanel";
import { HipsSkyMapPanel } from "./HipsSkyMapPanel";

interface ViewerPanelProps {
  selectedObs: SpherexObservation | null;
  cutout: RenderedCutout | null;
  cutoutLoading: boolean;
  lastCoords: { ra: number; dec: number; size: number } | null;
  showCrosshair: boolean;
  status: { text: string; isError: boolean } | null;
  siaUrl: string;
  resolvedObject: ResolvedCelestialObject | null;
  versions: Record<SpherexCollectionId, CollectionVersionData> | null;
  activeCollection: SpherexCollectionId;
  stretch: StretchMode;
  colormap: ColormapName;
  subtractZodi: boolean;
  onChangeFov: (newSize: number) => void;
  onSelectVersionObservation: (collection: SpherexCollectionId, obs: SpherexObservation) => void;
  onQueryAtCoords?: (raDeg: number, decDeg: number) => void;
}

export const ViewerPanel: React.FC<ViewerPanelProps> = ({
  selectedObs,
  cutout,
  cutoutLoading,
  lastCoords,
  showCrosshair,
  status,
  siaUrl,
  resolvedObject,
  versions,
  activeCollection,
  stretch,
  colormap,
  subtractZodi,
  onChangeFov,
  onSelectVersionObservation,
  onQueryAtCoords,
}) => {
  const { t } = useLanguage();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<"split" | "cutout" | "skymap">("split");
  const [cutoutZoom, setCutoutZoom] = useState<number>(1);
  const cutoutViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = cutoutViewportRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY === 0) return;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setCutoutZoom((prev) => Number(Math.max(1, Math.min(6, prev * factor)).toFixed(2)));
    };

    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onNativeWheel);
    };
  }, [viewerMode, cutout]);

  const axisTicks = useMemo(() => {
    if (!cutout || !lastCoords) return null;
    return computeAxisTicks(cutout.width, cutout.height, cutout.wcs, lastCoords);
  }, [cutout, lastCoords]);

  const currentFov = lastCoords?.size ?? 0.15;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleDownloadPng = () => {
    if (!cutout) return;
    const a = document.createElement("a");
    a.href = cutout.dataUrl;
    const name = selectedObs
      ? `spherex_${selectedObs.obs_collection}_${selectedObs.bandpass}_${selectedObs.obs_id}.png`
      : "spherex_cutout.png";
    a.download = name;
    a.click();
  };

  return (
    <section className="bg-space-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4 backdrop-blur-sm shadow-xl flex-1 min-w-0">
      {/* Encabezado del Visor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/70 pb-3.5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
            {resolvedObject && (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-950/90 text-indigo-200 border border-indigo-700/70 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                {resolvedObject.query}
              </span>
            )}
            {selectedObs ? (
              <>
                <span className="px-2 py-0.5 text-xs font-semibold bg-slate-800 text-cyan-300 border border-slate-700 rounded">
                  {t.controls.collectionShortLabels[activeCollection]}
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60 rounded">
                  {selectedObs.bandpass}
                </span>
                <span className="font-mono text-sm text-slate-300">{selectedObs.obs_id}</span>
              </>
            ) : (
              t.viewer.defaultTitle
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {lastCoords && selectedObs
              ? t.viewer.centerCoords({
                  ra: lastCoords.ra.toFixed(5),
                  dec: lastCoords.dec.toFixed(5),
                  size: String(lastCoords.size),
                })
              : t.viewer.enterCoordsPrompt}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de Modo del Visor: Vista Dividida | Recorte FITS | Mapa Espacial HiPS/MOC */}
          <div className="flex items-center gap-1 bg-space-950/90 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setViewerMode("split")}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                viewerMode === "split"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>{t.viewer.viewModeSplit}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewerMode("cutout")}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                viewerMode === "cutout"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{t.viewer.viewModeCutout}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewerMode("skymap")}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                viewerMode === "skymap"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{t.viewer.viewModeSkyMap}</span>
            </button>
          </div>

          {cutout && (
            <>
              <button
                type="button"
                onClick={handleDownloadPng}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700/80 transition-colors cursor-pointer"
                title={t.viewer.savePngTitle}
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t.viewer.savePng}</span>
              </button>
              <a
                href={cutout.fits_cutout_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-200 hover:text-white rounded-lg border border-cyan-800/80 transition-colors"
                title={t.viewer.originalFitsTitle}
              >
                <FileDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t.viewer.originalFits}</span>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Notificación de Estado */}
      {status && (
        <div
          className={`px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 border ${
            status.isError
              ? "bg-rose-950/50 border-rose-800/80 text-rose-200"
              : "bg-sky-950/50 border-sky-800/80 text-sky-200"
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{status.text}</span>
        </div>
      )}

      {/* Mapa Espacial Interactivo HiPS / MOC de SPHEREx */}
      {(viewerMode === "skymap" || viewerMode === "split") && (
        <HipsSkyMapPanel
          targetCoords={lastCoords}
          observations={versions?.[activeCollection]?.observations ?? []}
          selectedObs={selectedObs}
          cutout={cutout}
          cutoutLoading={cutoutLoading}
          stretch={stretch}
          colormap={colormap}
          subtractZodi={subtractZodi}
          onChangeFov={onChangeFov}
          onSelectObservation={(obs) => onSelectVersionObservation(activeCollection, obs)}
          onQueryAtCoords={onQueryAtCoords}
        />
      )}

      {/* Contenedor del Lienzo / Imagen FITS con Ejes Cartesianos */}
      {(viewerMode === "cutout" || viewerMode === "split") && (
      <div
        ref={cutoutViewportRef}
        className="relative w-full aspect-square max-h-[580px] bg-black/85 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center select-none group overscroll-none"
      >
        {cutout ? (
          <>
            <div className="w-full h-full flex items-center justify-center pl-14 pr-4 pt-6 pb-12">
              <div
                className="relative border border-slate-400/70 shadow-lg"
                style={{
                  aspectRatio: `${cutout.width} / ${cutout.height}`,
                  ...(cutout.width >= cutout.height
                    ? { width: "100%", maxHeight: "100%" }
                    : { height: "100%", maxWidth: "100%" }),
                }}
              >
                <div className="w-full h-full overflow-hidden relative">
                  <img
                    src={cutout.dataUrl}
                    alt={t.viewer.altCutout}
                    style={{
                      transform: `scale(${cutoutZoom})`,
                      transformOrigin: "center center",
                    }}
                    className="w-full h-full object-fill block [image-rendering:pixelated] transition-transform duration-150"
                  />
                </div>

                {showCrosshair && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {/* Mira de cruz astronómica con anillo central */}
                    <div className="w-8 h-8 rounded-full border border-cyan-400/70 shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
                    <div className="absolute w-14 h-[1px] bg-cyan-400/80" />
                    <div className="absolute h-14 w-[1px] bg-cyan-400/80" />
                  </div>
                )}

                {/* Eje Y izquierdo (Declinación) */}
                {axisTicks && (
                  <div
                    className="absolute inset-y-0 -left-14 w-14 pointer-events-none"
                    aria-label={t.viewer.decAxisLabel}
                  >
                    {axisTicks.yTicks.map((tick, idx) => (
                      <div
                        key={`y-${idx}-${tick.label}`}
                        className="absolute right-0 flex items-center justify-end -translate-y-1/2"
                        style={{ top: `${tick.fraction * 100}%` }}
                      >
                        <span className="text-[11px] font-mono text-slate-200 whitespace-nowrap -rotate-90 origin-center mr-1">
                          {tick.label}
                        </span>
                        <div className="w-1.5 h-[1px] bg-slate-300 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Eje X inferior (Ascensión Recta) */}
                {axisTicks && (
                  <div
                    className="absolute inset-x-0 -bottom-11 h-11 pointer-events-none"
                    aria-label={t.viewer.raAxisLabel}
                  >
                    {axisTicks.xTicks.map((tick, idx) => (
                      <div
                        key={`x-${idx}-${tick.label}`}
                        className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                        style={{ left: `${tick.fraction * 100}%` }}
                      >
                        <div className="w-[1px] h-1.5 bg-slate-300 shrink-0" />
                        <span className="text-[11px] font-mono text-slate-200 whitespace-nowrap mt-1">
                          {tick.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Barra flotante de Zoom Visual y Campo de Visión (FOV) usando DR1 Wide */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 flex-wrap justify-end">
              <div className="flex items-center gap-1 bg-space-950/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-300 shadow-lg">
                <button
                  type="button"
                  onClick={() => setCutoutZoom((z) => Math.min(6, Number((z * 1.25).toFixed(2))))}
                  disabled={cutoutZoom >= 6}
                  className="p-1 hover:text-white disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title={t.viewer.zoomInTitle}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="px-1 font-mono text-[11px] text-amber-300">
                  {t.viewer.visualZoomLabel(cutoutZoom.toFixed(1))}
                </span>
                <button
                  type="button"
                  onClick={() => setCutoutZoom((z) => Math.max(1, Number((z / 1.25).toFixed(2))))}
                  disabled={cutoutZoom <= 1}
                  className="p-1 hover:text-white disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title={t.viewer.zoomOutTitle}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                {cutoutZoom !== 1 && (
                  <button
                    type="button"
                    onClick={() => setCutoutZoom(1)}
                    className="p-1 hover:text-white border-l border-slate-800 pl-1.5 transition-colors cursor-pointer"
                    title={t.viewer.visualZoomReset}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 bg-space-950/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-300 opacity-95 group-hover:opacity-100 transition-opacity shadow-lg">
                <button
                  type="button"
                  onClick={() => onChangeFov(currentFov * 0.7)}
                  disabled={currentFov <= 0.02}
                  className="p-1 hover:text-white disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title={t.viewer.fovInTitle}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 font-mono text-[11px] text-cyan-300 flex items-center gap-1">
                  {cutoutLoading && <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />}
                  <span>FOV {currentFov.toFixed(2)}°</span>
                </span>
                <button
                  type="button"
                  onClick={() => onChangeFov(currentFov / 0.7)}
                  disabled={currentFov >= 1.0}
                  className="p-1 hover:text-white disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title={t.viewer.fovOutTitle}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onChangeFov(0.15)}
                  className="p-1 hover:text-white border-l border-slate-800 pl-1.5 transition-colors cursor-pointer"
                  title={t.viewer.fovResetTitle}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-slate-500">
            <div className="w-14 h-14 rounded-2xl bg-space-950 border border-slate-800 flex items-center justify-center text-slate-600">
              <Info className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-400">
              {t.viewer.emptyTitle}
            </p>
            <p className="text-xs text-slate-600 max-w-sm">
              {t.viewer.emptySubtitle}
            </p>
          </div>
        )}
      </div>
      )}

      {/* Métricas y Estadísticas de la imagen FITS */}
      {cutout && selectedObs && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-space-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <span className="text-[11px] text-slate-400 block">{t.viewer.detectorBand}</span>
            <strong className="text-xs font-semibold text-white">
              {selectedObs.bandpass || "—"}
            </strong>
          </div>
          <div className="bg-space-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <span className="text-[11px] text-slate-400 block">{t.viewer.wavelength}</span>
            <strong className="text-xs font-semibold text-white">
              {selectedObs.em_min_um !== null && selectedObs.em_max_um !== null
                ? `${selectedObs.em_min_um} – ${selectedObs.em_max_um} µm`
                : t.viewer.infrared}
            </strong>
          </div>
          <div className="bg-space-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <span className="text-[11px] text-slate-400 block">{t.viewer.dimensions}</span>
            <strong className="text-xs font-semibold text-white font-mono">
              {cutout.width} × {cutout.height} px
            </strong>
          </div>
          <div className="bg-space-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <span className="text-[11px] text-slate-400 block">{t.viewer.fluxMedianMax}</span>
            <strong className="text-xs font-semibold text-white font-mono">
              {cutout.stats.median} / {cutout.stats.max} {cutout.stats.unit}
            </strong>
          </div>
        </div>
      )}

      {/* Versiones por Época y Reproductor de Transición (Video) */}
      <EpochTimeLapsePanel
        observations={versions?.[activeCollection]?.observations ?? []}
        lastCoords={lastCoords}
        stretch={stretch}
        colormap={colormap}
        subtractZodi={subtractZodi}
        showCrosshair={showCrosshair}
        selectedObs={selectedObs}
        onSelectObservation={(obs) => onSelectVersionObservation(activeCollection, obs)}
      />

      {/* Galería Multiversión y Multibanda de Recortes FITS */}
      <MultiVersionGallery
        versions={versions}
        lastCoords={lastCoords}
        stretch={stretch}
        colormap={colormap}
        subtractZodi={subtractZodi}
        activeCollection={activeCollection}
        selectedObs={selectedObs}
        onSelectVersionObservation={onSelectVersionObservation}
      />

      {/* Trazabilidad de consultas y endpoints IRSA */}
      {cutout && siaUrl && (
        <div className="bg-space-950/40 border border-slate-800/60 rounded-xl p-3 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-slate-400 font-semibold shrink-0">SIA Query:</span>
              <code className="text-slate-300 font-mono text-[11px] truncate bg-black/30 px-1.5 py-0.5 rounded">
                {siaUrl}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(siaUrl, "sia")}
              className="text-slate-400 hover:text-white p-1 transition-colors shrink-0 cursor-pointer"
              title={t.viewer.copySiaTitle}
            >
              {copiedUrl === "sia" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-slate-400 font-semibold shrink-0">IBE Cutout:</span>
              <code className="text-slate-300 font-mono text-[11px] truncate bg-black/30 px-1.5 py-0.5 rounded">
                {cutout.fits_cutout_url}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(cutout.fits_cutout_url, "cutout")}
              className="text-slate-400 hover:text-white p-1 transition-colors shrink-0 cursor-pointer"
              title={t.viewer.copyCutoutTitle}
            >
              {copiedUrl === "cutout" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
