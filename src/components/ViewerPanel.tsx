import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  FileDown,
  Info,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { RenderedCutout, SpherexObservation } from "../lib/types";
import { useLanguage } from "../i18n/LanguageContext";

interface ViewerPanelProps {
  selectedObs: SpherexObservation | null;
  cutout: RenderedCutout | null;
  lastCoords: { ra: number; dec: number; size: number } | null;
  showCrosshair: boolean;
  status: { text: string; isError: boolean } | null;
  siaUrl: string;
}

export const ViewerPanel: React.FC<ViewerPanelProps> = ({
  selectedObs,
  cutout,
  lastCoords,
  showCrosshair,
  status,
  siaUrl,
}) => {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(1);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

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
      ? `spherex_${selectedObs.bandpass}_${selectedObs.obs_id}.png`
      : "spherex_cutout.png";
    a.download = name;
    a.click();
  };

  return (
    <section className="bg-space-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4 backdrop-blur-sm shadow-xl flex-1 min-w-0">
      {/* Encabezado del Visor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/70 pb-3.5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            {selectedObs ? (
              <>
                <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60 rounded">
                  {selectedObs.bandpass}
                </span>
                <span className="font-mono text-sm text-slate-300">{selectedObs.obs_id}</span>
              </>
            ) : (
              t.viewer.defaultTitle
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lastCoords && selectedObs
              ? t.viewer.centerCoords({
                  ra: lastCoords.ra.toFixed(5),
                  dec: lastCoords.dec.toFixed(5),
                  size: String(lastCoords.size),
                })
              : t.viewer.enterCoordsPrompt}
          </p>
        </div>

        {cutout && (
          <div className="flex items-center gap-2 flex-wrap">
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
          </div>
        )}
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

      {/* Contenedor del Lienzo / Imagen FITS */}
      <div className="relative w-full aspect-square max-h-[580px] bg-black/80 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center select-none group">
        {cutout ? (
          <>
            <div
              className="relative transition-transform duration-100 ease-out flex items-center justify-center w-full h-full"
              style={{ transform: `scale(${zoom})` }}
            >
              <img
                src={cutout.dataUrl}
                alt={t.viewer.altCutout}
                className="max-w-full max-h-full object-contain [image-rendering:pixelated]"
              />

              {showCrosshair && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Mira de cruz astronómica con anillo central */}
                  <div className="w-8 h-8 rounded-full border border-cyan-400/70 shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
                  <div className="absolute w-14 h-[1px] bg-cyan-400/80" />
                  <div className="absolute h-14 w-[1px] bg-cyan-400/80" />
                </div>
              )}
            </div>

            {/* Barra flotante de zoom y escala */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-space-950/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-300 opacity-90 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                className="p-1 hover:text-white transition-colors cursor-pointer"
                title={t.viewer.zoomInTitle}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 font-mono text-[11px] text-cyan-300">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="p-1 hover:text-white transition-colors cursor-pointer"
                title={t.viewer.zoomOutTitle}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="p-1 hover:text-white border-l border-slate-800 pl-1.5 transition-colors cursor-pointer"
                title={t.viewer.resetZoomTitle}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
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
