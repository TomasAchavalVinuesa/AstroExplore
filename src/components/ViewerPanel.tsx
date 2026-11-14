import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  FileDown,
  Grid,
  Image as ImageIcon,
  Info,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
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
import { getRenderedCutout } from "../lib/irsa";
import { useLanguage } from "../i18n/LanguageContext";
import { HipsSkyMapPanel } from "./HipsSkyMapPanel";
import { MultiVersionGallery } from "./MultiVersionGallery";

interface ViewerPanelProps {
  selectedObs: SpherexObservation | null;
  cutout: RenderedCutout | null;
  cutoutLoading: boolean;
  lastCoords: { ra: number; dec: number; size: number } | null;
  targetName?: string;
  showCrosshair: boolean;
  status: { text: string; isError: boolean } | null;
  siaUrl: string;
  resolvedObject: ResolvedCelestialObject | null;
  versions: Record<SpherexCollectionId, CollectionVersionData> | null;
  activeCollection: SpherexCollectionId;
  stretch: StretchMode;
  colormap: ColormapName;
  subtractZodi: boolean;
  secondMapOpen: boolean;
  onToggleSecondMap: (open: boolean) => void;
  externalChannelIdx?: number | null;
  onChangeFov: (newSize: number) => void;
  onSelectVersionObservation: (collection: SpherexCollectionId, obs: SpherexObservation) => void;
  onQueryAtCoords?: (raDeg: number, decDeg: number) => void;
}

const FALLBACK_EPOCHS = ["2025.5 (t₁)", "2026.0 (t₂)", "2026.5 (t₃)", "2027.0 (t₄)"];

export const ViewerPanel: React.FC<ViewerPanelProps> = ({
  selectedObs,
  cutout,
  cutoutLoading,
  lastCoords,
  targetName = "WISE 0855",
  showCrosshair,
  status,
  resolvedObject,
  versions,
  activeCollection,
  stretch,
  colormap,
  subtractZodi,
  secondMapOpen,
  onToggleSecondMap,
  externalChannelIdx,
  onChangeFov,
  onSelectVersionObservation,
  onQueryAtCoords,
}) => {
  const { t } = useLanguage();
  const [cutoutZoom, setCutoutZoom] = useState<number>(1);
  const [secondMapTab, setSecondMapTab] = useState<"cutout" | "bands">("cutout");
  const [showGalleryModal, setShowGalleryModal] = useState<boolean>(false);

  // Floating Epoch Playback Bar state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [fallbackEpochIdx, setFallbackEpochIdx] = useState<number>(0);
  const [prevCutoutUrl, setPrevCutoutUrl] = useState<string | null>(null);
  const lastCutoutUrlRef = useRef<string | null>(null);

  // 6-band representatives for Map 2 "Bands" tab
  const [bandCutouts, setBandCutouts] = useState<
    Record<string, { status: "loading" | "ready" | "error"; cutout?: RenderedCutout }>
  >({});

  const cutoutViewportRef = useRef<HTMLDivElement | null>(null);

  const observations = useMemo(
    () => versions?.[activeCollection]?.observations ?? [],
    [versions, activeCollection]
  );

  // Build chronological epoch list from current observations (or fallback)
  const epochFrames = useMemo(() => {
    if (observations.length === 0) return [];
    const targetBand = selectedObs?.bandpass;
    const sameBand = targetBand
      ? observations.filter((o) => o.bandpass === targetBand)
      : observations;
    const pool = sameBand.length > 1 ? sameBand : observations;

    const byDate = new Map<string, SpherexObservation>();
    for (const obs of pool) {
      const key = obs.epoch_date ?? obs.obs_id;
      if (!byDate.has(key)) {
        byDate.set(key, obs);
      }
    }
    const list = Array.from(byDate.values());
    return list.length > 1 ? list.slice(0, 16) : pool.slice(0, 12);
  }, [observations, selectedObs?.bandpass]);

  const activeEpochIdx = useMemo(() => {
    if (epochFrames.length === 0) return fallbackEpochIdx;
    if (!selectedObs) return 0;
    const idx = epochFrames.findIndex(
      (o) => o.obs_id === selectedObs.obs_id && o.bandpass === selectedObs.bandpass
    );
    return idx >= 0 ? idx : 0;
  }, [epochFrames, selectedObs, fallbackEpochIdx]);

  // Smooth crossfade tracking for Map 2
  useEffect(() => {
    if (
      cutout?.dataUrl &&
      lastCutoutUrlRef.current &&
      lastCutoutUrlRef.current !== cutout.dataUrl
    ) {
      setPrevCutoutUrl(lastCutoutUrlRef.current);
    }
    if (cutout?.dataUrl) {
      lastCutoutUrlRef.current = cutout.dataUrl;
    }
  }, [cutout?.dataUrl]);

  // Automatic epoch playback interval
  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = Math.max(250, Math.round(950 / speedMultiplier));
    const timer = window.setInterval(() => {
      if (epochFrames.length > 1) {
        const nextIdx = (activeEpochIdx + 1) % epochFrames.length;
        onSelectVersionObservation(activeCollection, epochFrames[nextIdx]);
      } else {
        setFallbackEpochIdx((prev) => (prev + 1) % FALLBACK_EPOCHS.length);
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, speedMultiplier, epochFrames, activeEpochIdx, activeCollection, onSelectVersionObservation]);

  // Mouse wheel zoom inside Map 2 (FITS Cutout viewport)
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
  }, [secondMapOpen, secondMapTab, cutout]);

  // Representative D1..D6 observations for Map 2 "Bands" mode
  const bandRepresentatives = useMemo(() => {
    const map = new Map<string, SpherexObservation>();
    for (const obs of observations) {
      const b = obs.bandpass || "IR";
      if (!map.has(b)) map.set(b, obs);
    }
    return Array.from(map.values()).sort((a, b) => a.bandpass.localeCompare(b.bandpass));
  }, [observations]);

  useEffect(() => {
    if (!secondMapOpen || secondMapTab !== "bands" || !lastCoords || bandRepresentatives.length === 0) {
      return;
    }
    const controller = new AbortController();

    for (const obs of bandRepresentatives) {
      const key = `${obs.bandpass}|${obs.obs_id}`;
      setBandCutouts((prev) =>
        prev[key]?.status === "ready" ? prev : { ...prev, [key]: { status: "loading" } }
      );

      void getRenderedCutout({
        accessUrl: obs.access_url,
        ra: lastCoords.ra,
        dec: lastCoords.dec,
        size: lastCoords.size,
        stretch,
        colormap,
        subtractZodi,
        priority: "low",
        signal: controller.signal,
      })
        .then((rendered) => {
          if (controller.signal.aborted) return;
          setBandCutouts((prev) => ({
            ...prev,
            [key]: { status: "ready", cutout: rendered },
          }));
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setBandCutouts((prev) => ({
            ...prev,
            [key]: { status: "error" },
          }));
        });
    }

    return () => controller.abort();
  }, [
    secondMapOpen,
    secondMapTab,
    bandRepresentatives,
    lastCoords,
    stretch,
    colormap,
    subtractZodi,
  ]);

  const axisTicks = useMemo(() => {
    if (!cutout || !lastCoords) return null;
    return computeAxisTicks(cutout.width, cutout.height, cutout.wcs, lastCoords);
  }, [cutout, lastCoords]);

  const currentFov = lastCoords?.size ?? 0.12;

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

  const epochReadoutText = useMemo(() => {
    if (epochFrames.length > 0) {
      const current = epochFrames[activeEpochIdx] ?? epochFrames[0];
      const dateStr = current.epoch_date ?? current.bandpass ?? "SPHEREx";
      return `${dateStr} (t${activeEpochIdx + 1}/${epochFrames.length})`;
    }
    return FALLBACK_EPOCHS[fallbackEpochIdx] ?? FALLBACK_EPOCHS[0];
  }, [epochFrames, activeEpochIdx, fallbackEpochIdx]);

  const maxEpochSlider = Math.max(1, (epochFrames.length > 0 ? epochFrames.length : FALLBACK_EPOCHS.length) - 1);

  return (
    <main className="flex-1 flex flex-col gap-4 min-h-0 min-w-0">
      {/* Status Banner (only when error or active download message) */}
      {status && status.isError && (
        <div className="glass-panel px-4 py-2 rounded-2xl text-xs flex items-center gap-2 border-rose-500/40 text-rose-200 shrink-0">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="truncate">{status.text}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEWPORT AREA: 1 Map (Full Width) or Divided in 2 Maps (50% / 50%)    */}
      {/* ===================================================================== */}
      <div
        className={`flex-1 min-h-0 grid gap-4 transition-all duration-300 ${
          secondMapOpen ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {/* MAP 1: Interactive HiPS / MOC Sky Viewport */}
        <HipsSkyMapPanel
          targetCoords={lastCoords}
          targetName={resolvedObject?.canonicalName ?? targetName}
          observations={observations}
          selectedObs={selectedObs}
          cutout={cutout}
          cutoutLoading={cutoutLoading}
          stretch={stretch}
          colormap={colormap}
          subtractZodi={subtractZodi}
          secondMapOpen={secondMapOpen}
          onToggleSecondMap={onToggleSecondMap}
          externalChannelIdx={externalChannelIdx}
          secondMapZoom={cutoutZoom}
          onChangeFov={onChangeFov}
          onSelectObservation={(obs) => onSelectVersionObservation(activeCollection, obs)}
          onQueryAtCoords={onQueryAtCoords}
        />

        {/* MAP 2: Emerges Alongside Map 1 Dividing the Viewport Space in 2 */}
        {secondMapOpen && (
          <div
            ref={cutoutViewportRef}
            className="relative w-full h-full min-h-[280px] rounded-[22px] overflow-hidden border border-[#00D2FF]/45 bg-black shadow-2xl flex flex-col select-none overscroll-none"
          >
            {/* Top-Left Map 2 Badge Pill */}
            <div className="glass-panel absolute top-4 left-4 z-20 rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs font-mono text-slate-100 max-w-[58%] truncate">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] shrink-0" />
              <span className="font-sans font-medium text-slate-200 truncate">
                {t.chrono.map2Title}
              </span>
              {selectedObs && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#00D2FF]/20 text-[#00D2FF] text-[10px] font-bold shrink-0">
                  {selectedObs.bandpass}
                </span>
              )}
              {cutoutLoading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00D2FF] shrink-0" />
              )}
            </div>

            {/* Top-Right Map 2 Controls & Close Button */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 flex-wrap justify-end">
              {/* Switch between Cutout+WCS and 6-Bands Grid inside Map 2 */}
              <div className="glass-panel rounded-full p-1 flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSecondMapTab("cutout")}
                  className={`btn-press px-2.5 py-1 rounded-full cursor-pointer flex items-center gap-1 transition-colors ${
                    secondMapTab === "cutout"
                      ? "bg-[#00D2FF] text-slate-950 font-semibold"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">FITS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSecondMapTab("bands")}
                  className={`btn-press px-2.5 py-1 rounded-full cursor-pointer flex items-center gap-1 transition-colors ${
                    secondMapTab === "bands"
                      ? "bg-[#00D2FF] text-slate-950 font-semibold"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Grid className="w-3 h-3" />
                  <span className="hidden sm:inline">D1–D6</span>
                </button>
              </div>

              {/* Close 2nd Map (Restores Map 1 to 100% Width) */}
              <button
                type="button"
                onClick={() => onToggleSecondMap(false)}
                className="btn-press glass-panel w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                title={t.chrono.closeSecondMapButton}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Map 2 Content Body */}
            {secondMapTab === "cutout" ? (
              <div className="flex-1 w-full h-full flex items-center justify-center pl-14 pr-5 pt-16 pb-16 relative">
                {cutout ? (
                  <div
                    className="relative border border-white/30 shadow-2xl"
                    style={{
                      aspectRatio: `${cutout.width} / ${cutout.height}`,
                      ...(cutout.width >= cutout.height
                        ? { width: "100%", maxHeight: "100%" }
                        : { height: "100%", maxWidth: "100%" }),
                    }}
                  >
                    <div className="w-full h-full overflow-hidden relative bg-black">
                      {prevCutoutUrl && (
                        <img
                          src={prevCutoutUrl}
                          alt=""
                          aria-hidden="true"
                          style={{
                            transform: `scale(${cutoutZoom})`,
                            transformOrigin: "center center",
                          }}
                          className="absolute inset-0 w-full h-full object-fill block [image-rendering:pixelated] pointer-events-none"
                        />
                      )}
                      <img
                        key={cutout.dataUrl}
                        src={cutout.dataUrl}
                        alt={t.viewer.altCutout}
                        style={{
                          transform: `scale(${cutoutZoom})`,
                          transformOrigin: "center center",
                        }}
                        className="relative w-full h-full object-fill block [image-rendering:pixelated] transition-transform duration-150"
                      />
                    </div>

                    {/* Central Reticle */}
                    {showCrosshair && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full border border-[#00D2FF]/80 shadow-[0_0_10px_rgba(0,210,255,0.6)]" />
                        <div className="absolute w-14 h-[1px] bg-[#00D2FF]/80" />
                        <div className="absolute h-14 w-[1px] bg-[#00D2FF]/80" />
                      </div>
                    )}

                    {/* Left Y-Axis (Declination) */}
                    {axisTicks && (
                      <div
                        className="absolute inset-y-0 -left-12 w-12 pointer-events-none"
                        aria-label={t.viewer.decAxisLabel}
                      >
                        {axisTicks.yTicks.map((tick, idx) => (
                          <div
                            key={`y-${idx}-${tick.label}`}
                            className="absolute right-0 flex items-center justify-end -translate-y-1/2"
                            style={{ top: `${tick.fraction * 100}%` }}
                          >
                            <span className="text-[10px] font-mono text-slate-300 whitespace-nowrap -rotate-90 origin-center mr-1">
                              {tick.label}
                            </span>
                            <div className="w-1.5 h-[1px] bg-slate-400 shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bottom X-Axis (Right Ascension) */}
                    {axisTicks && (
                      <div
                        className="absolute inset-x-0 -bottom-10 h-10 pointer-events-none"
                        aria-label={t.viewer.raAxisLabel}
                      >
                        {axisTicks.xTicks.map((tick, idx) => (
                          <div
                            key={`x-${idx}-${tick.label}`}
                            className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                            style={{ left: `${tick.fraction * 100}%` }}
                          >
                            <div className="w-[1px] h-1.5 bg-slate-400 shrink-0" />
                            <span className="text-[10px] font-mono text-slate-300 whitespace-nowrap mt-1">
                              {tick.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : cutoutLoading ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                    <Loader2 className="w-7 h-7 animate-spin text-[#00D2FF]" />
                    <span className="text-xs">{status?.text ?? t.epochPlayer.loadingFrame}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                      <Info className="w-5 h-5 text-[#00D2FF]" />
                    </div>
                    <p className="text-xs font-medium text-slate-300">{t.viewer.emptyTitle}</p>
                    <p className="text-[11px] text-slate-500 max-w-xs">{t.viewer.emptySubtitle}</p>
                  </div>
                )}

                {/* Bottom Floating Controls inside Map 2 */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 flex-wrap pointer-events-none">
                  {/* Metadata / Wavelength Pill */}
                  <div className="glass-panel rounded-full px-3 py-1.5 text-[11px] font-mono text-slate-200 flex items-center gap-2 pointer-events-auto">
                    {selectedObs ? (
                      <>
                        <span className="text-[#00D2FF] font-semibold">
                          {selectedObs.bandpass}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span>
                          {selectedObs.em_min_um !== null && selectedObs.em_max_um !== null
                            ? `${selectedObs.em_min_um}–${selectedObs.em_max_um} µm`
                            : t.viewer.infrared}
                        </span>
                        {selectedObs.epoch_date && (
                          <>
                            <span className="text-slate-500">·</span>
                            <span className="text-amber-300">{selectedObs.epoch_date}</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span>FOV {currentFov.toFixed(2)}°</span>
                    )}
                  </div>

                  {/* Zoom & Download Actions */}
                  <div className="flex items-center gap-1.5 pointer-events-auto">
                    {cutout && (
                      <>
                        <button
                          type="button"
                          onClick={handleDownloadPng}
                          className="btn-press glass-panel rounded-full px-2.5 py-1 text-[11px] text-slate-200 hover:text-white flex items-center gap-1 cursor-pointer"
                          title={t.viewer.savePngTitle}
                        >
                          <Download className="w-3 h-3 text-[#00D2FF]" />
                          <span className="hidden sm:inline">PNG</span>
                        </button>
                        <a
                          href={cutout.fits_cutout_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-press glass-panel rounded-full px-2.5 py-1 text-[11px] text-[#00D2FF] hover:text-white flex items-center gap-1"
                          title={t.viewer.originalFitsTitle}
                        >
                          <FileDown className="w-3 h-3" />
                          <span className="hidden sm:inline">FITS</span>
                        </a>
                      </>
                    )}

                    <div className="glass-panel rounded-full px-2.5 py-1 flex items-center gap-1 text-xs text-slate-300">
                      <button
                        type="button"
                        onClick={() =>
                          setCutoutZoom((z) => Math.min(6, Number((z * 1.25).toFixed(2))))
                        }
                        className="p-0.5 hover:text-white cursor-pointer"
                        title={t.viewer.zoomInTitle}
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-[10px] text-[#00D2FF] px-1">
                        {cutoutZoom.toFixed(1)}×
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCutoutZoom((z) => Math.max(1, Number((z / 1.25).toFixed(2))))
                        }
                        className="p-0.5 hover:text-white cursor-pointer"
                        title={t.viewer.zoomOutTitle}
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      {cutoutZoom !== 1 && (
                        <button
                          type="button"
                          onClick={() => setCutoutZoom(1)}
                          className="p-0.5 hover:text-white border-l border-white/10 pl-1 cursor-pointer"
                          title={t.viewer.visualZoomReset}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Map 2 Tab: 6 Spectral Bands (D1 - D6) Grid */
              <div className="flex-1 w-full h-full pt-16 pb-4 px-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-start">
                {bandRepresentatives.map((obs) => {
                  const key = `${obs.bandpass}|${obs.obs_id}`;
                  const entry = bandCutouts[key];
                  const isCurrent =
                    selectedObs?.obs_id === obs.obs_id && selectedObs?.bandpass === obs.bandpass;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        onSelectVersionObservation(activeCollection, obs);
                        setSecondMapTab("cutout");
                      }}
                      className={`btn-press rounded-2xl overflow-hidden border text-left transition-all flex flex-col cursor-pointer ${
                        isCurrent
                          ? "border-[#00D2FF] bg-[#00D2FF]/10 shadow-[0_0_16px_rgba(0,210,255,0.2)]"
                          : "border-white/10 bg-white/[0.03] hover:border-[#00D2FF]/50"
                      }`}
                    >
                      <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
                        {entry?.status === "ready" && entry.cutout ? (
                          <img
                            src={entry.cutout.dataUrl}
                            alt={obs.bandpass}
                            className="w-full h-full object-contain [image-rendering:pixelated]"
                          />
                        ) : entry?.status === "error" ? (
                          <span className="text-[10px] text-rose-400 px-2 text-center">
                            {t.epochPlayer.errorFrame}
                          </span>
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-[#00D2FF]" />
                        )}
                        <span className="glass-panel absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-[#00D2FF]">
                          {obs.bandpass}
                        </span>
                      </div>
                      <div className="px-2.5 py-1.5 flex items-center justify-between text-[10px] font-mono text-slate-300">
                        <span className="truncate">{obs.epoch_date ?? obs.obs_id}</span>
                        {obs.em_min_um !== null && obs.em_max_um !== null && (
                          <span className="text-[#00D2FF] shrink-0">
                            {obs.em_min_um}–{obs.em_max_um}µm
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

      {/* ===================================================================== */}
      {/* FLOATING TRANSLUCENT PLAYBACK BAR (Exact CHRONO-SPHEREx design)       */}
      {/* ===================================================================== */}
      <div className="flex justify-center shrink-0">
        <div className="glass-panel rounded-2xl px-5 py-3 flex flex-wrap items-center gap-5 w-full max-w-[740px]">
          {/* Play / Pause */}
          <button
            type="button"
            onClick={() => {
              if (!secondMapOpen) {
                onToggleSecondMap(true);
              }
              setIsPlaying((p) => !p);
            }}
            className="btn-press w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white shrink-0 cursor-pointer"
            aria-label={t.chrono.playPauseAria}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Epoch Scrubber */}
          <div className="flex-1 min-w-[180px] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">{t.chrono.epochLabel}</span>
              <span className="font-mono text-[#00D2FF]">{epochReadoutText}</span>
            </div>
            <input
              type="range"
              min={0}
              max={maxEpochSlider}
              step={1}
              value={Math.min(activeEpochIdx, maxEpochSlider)}
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                setIsPlaying(false);
                if (!secondMapOpen) {
                  onToggleSecondMap(true);
                }
                if (epochFrames.length > 0 && epochFrames[idx]) {
                  onSelectVersionObservation(activeCollection, epochFrames[idx]);
                } else {
                  setFallbackEpochIdx(idx);
                }
              }}
              className="apple-slider w-full"
            />
          </div>

          {/* Video Speed */}
          <div className="w-32 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">{t.chrono.speedLabel}</span>
              <span className="font-mono text-slate-200">{speedMultiplier.toFixed(1)}×</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.5}
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
              className="apple-slider w-full"
            />
          </div>

          {/* Multi-Version & Spectral Gallery Modal Trigger */}
          {versions && (
            <button
              type="button"
              onClick={() => setShowGalleryModal(true)}
              className="btn-press px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-[#00D2FF]/20 border border-white/10 hover:border-[#00D2FF]/50 text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer shrink-0"
              title={t.viewer.galleryTitle}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00D2FF]" />
              <span className="hidden sm:inline">D1–D6</span>
            </button>
          )}
        </div>
      </div>

      {/* Optional Multi-Version & Multi-Band Gallery Modal */}
      {showGalleryModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel rounded-[24px] w-full max-w-4xl max-h-[85vh] overflow-y-auto p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00D2FF]" />
                <span>{t.viewer.galleryTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowGalleryModal(false)}
                className="btn-press p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <MultiVersionGallery
              versions={versions}
              lastCoords={lastCoords}
              stretch={stretch}
              colormap={colormap}
              subtractZodi={subtractZodi}
              activeCollection={activeCollection}
              selectedObs={selectedObs}
              onSelectVersionObservation={(col, obs) => {
                onSelectVersionObservation(col, obs);
                onToggleSecondMap(true);
                setShowGalleryModal(false);
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
};
