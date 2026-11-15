import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  Download,
  FileDown,
  Grid,
  Image as ImageIcon,
  Info,
  Loader2,
  Play,
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
import { DetectorGuide } from "./DetectorGuide";
import { SpectralProfile } from "./SpectralProfile";
import { BlinkComparator } from "./BlinkComparator";

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

const getEpochKey = (obs: SpherexObservation) => `${obs.obs_id}|${obs.bandpass}`;

const isSameObs = (a: SpherexObservation | null | undefined, b: SpherexObservation | null | undefined) => {
  if (!a || !b) return false;
  return (
    (Boolean(a.access_url) && Boolean(b.access_url) && a.access_url === b.access_url) ||
    (a.obs_id === b.obs_id && a.bandpass === b.bandpass)
  );
};

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
  const { t, language } = useLanguage();
  const isEn = language === "en";
  const [cutoutZoom, setCutoutZoom] = useState<number>(1);
  const [secondMapTab, setSecondMapTab] = useState<
    "cutout" | "bands" | "sed" | "blink" | "guide"
  >("cutout");
  const [showGalleryModal, setShowGalleryModal] = useState<boolean>(false);

  // Floating Epoch Playback Bar state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [fallbackEpochIdx, setFallbackEpochIdx] = useState<number>(0);
  const [prevCutoutUrl, setPrevCutoutUrl] = useState<string | null>(null);
  const lastCutoutUrlRef = useRef<string | null>(null);

  // Date selector dropdown & preloaded epoch cutouts cache
  const [dateMenuOpen, setDateMenuOpen] = useState<boolean>(false);
  const [selectedEpochKeys, setSelectedEpochKeys] = useState<Set<string>>(() => new Set());
  const dateMenuRef = useRef<HTMLDivElement | null>(null);
  const [epochCutouts, setEpochCutouts] = useState<
    Record<string, { status: "loading" | "ready" | "error"; cutout?: RenderedCutout }>
  >({});
  const epochCutoutsRef = useRef(epochCutouts);
  epochCutoutsRef.current = epochCutouts;

  // 6-band representatives for Map 2 "Bands" tab
  const [bandCutouts, setBandCutouts] = useState<
    Record<string, { status: "loading" | "ready" | "error"; cutout?: RenderedCutout }>
  >({});



  // Caching for Instant SED Spectra and Blink Comparator
  const [cachedCutoutsMap, setCachedCutoutsMap] = useState<Map<string, RenderedCutout>>(new Map());
  const [isScanningBands, setIsScanningBands] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (selectedObs && cutout) {
      setCachedCutoutsMap((prev) => new Map(prev).set(selectedObs.obs_id, cutout));
    }
  }, [selectedObs, cutout]);

  const cachedImages = useMemo(() => {
    const map = new Map<string, string>();
    cachedCutoutsMap.forEach((v, k) => map.set(k, v.dataUrl));
    return map;
  }, [cachedCutoutsMap]);

  const cachedFluxes = useMemo(() => {
    const map = new Map<string, { flux: number; unit: string; snr: number | null; mjd: number | null }>();
    cachedCutoutsMap.forEach((v, k) => {
      map.set(k, { flux: v.stats.median, unit: v.stats.unit, snr: null, mjd: null });
    });
    return map;
  }, [cachedCutoutsMap]);



  const cutoutViewportRef = useRef<HTMLDivElement | null>(null);

  const observations = useMemo(
    () => versions?.[activeCollection]?.observations ?? [],
    [versions, activeCollection]
  );

  const selectedIdx = observations.findIndex(
    (o) => o.obs_id === selectedObs?.obs_id && o.bandpass === selectedObs?.bandpass
  );

  const handleScanAllBands = async () => {
    if (!lastCoords || isScanningBands || observations.length === 0) return;
    setIsScanningBands(true);
    let done = 0;
    const total = observations.length;
    setScanProgress({ current: 0, total });

    for (const obs of observations) {
      if (!cachedCutoutsMap.has(obs.obs_id)) {
        try {
          const rendered = await getRenderedCutout({
            accessUrl: obs.access_url,
            ra: lastCoords.ra,
            dec: lastCoords.dec,
            size: lastCoords.size,
            stretch,
            colormap,
            subtractZodi,
            priority: "low",
          });
          setCachedCutoutsMap((prev) => new Map(prev).set(obs.obs_id, rendered));
        } catch {
          // ignore individual timeout
        }
      }
      done++;
      setScanProgress({ current: done, total });
    }
    setIsScanningBands(false);
  };

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

  const epochFramesSignature = useMemo(
    () => epochFrames.map(getEpochKey).join(","),
    [epochFrames]
  );

  // Select all available epoch dates by default when the epoch list changes
  useEffect(() => {
    setSelectedEpochKeys(new Set(epochFrames.map(getEpochKey)));
    setDateMenuOpen(false);
  }, [epochFramesSignature]);

  // Close date selector dropdown on outside click or Escape
  useEffect(() => {
    if (!dateMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) {
        setDateMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDateMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dateMenuOpen]);

  const playbackFrames = useMemo(
    () => epochFrames.filter((obs) => selectedEpochKeys.has(getEpochKey(obs))),
    [epochFrames, selectedEpochKeys]
  );

  // Pause playback if user deselects all dates
  useEffect(() => {
    if (epochFrames.length > 0 && playbackFrames.length === 0 && isPlaying) {
      setIsPlaying(false);
    }
  }, [epochFrames.length, playbackFrames.length, isPlaying]);

  const renderSignature = useMemo(() => {
    if (!lastCoords) return "";
    return `${lastCoords.ra.toFixed(6)}|${lastCoords.dec.toFixed(6)}|${lastCoords.size}|${stretch}|${colormap}|${subtractZodi}`;
  }, [lastCoords, stretch, colormap, subtractZodi]);

  // Clear rendered frame cache when coordinates or visual parameters change
  useEffect(() => {
    setEpochCutouts({});
  }, [renderSignature]);

  // Preload and cache all selected playback frames before showing the first image
  useEffect(() => {
    if (!secondMapOpen || secondMapTab !== "cutout" || !lastCoords || playbackFrames.length === 0) {
      return;
    }
    const controller = new AbortController();

    playbackFrames.forEach((obs, idx) => {
      const frameKey = `${renderSignature}|${getEpochKey(obs)}`;
      if (epochCutoutsRef.current[frameKey]?.status === "ready") {
        return;
      }

      setEpochCutouts((prev) =>
        prev[frameKey]?.status === "ready"
          ? prev
          : { ...prev, [frameKey]: { status: "loading" } }
      );

      void getRenderedCutout({
        accessUrl: obs.access_url,
        ra: lastCoords.ra,
        dec: lastCoords.dec,
        size: lastCoords.size,
        stretch,
        colormap,
        subtractZodi,
        priority: idx === 0 ? "high" : "low",
        signal: controller.signal,
      })
        .then((rendered) => {
          if (controller.signal.aborted) return;
          setEpochCutouts((prev) => ({
            ...prev,
            [frameKey]: { status: "ready", cutout: rendered },
          }));
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setEpochCutouts((prev) => ({
            ...prev,
            [frameKey]: { status: "error" },
          }));
        });
    });

    return () => controller.abort();
  }, [
    secondMapOpen,
    secondMapTab,
    playbackFrames,
    renderSignature,
    lastCoords,
    stretch,
    colormap,
    subtractZodi,
  ]);

  const settledPlaybackCount = useMemo(() => {
    if (playbackFrames.length === 0) return 0;
    return playbackFrames.filter((obs) => {
      const st = epochCutouts[`${renderSignature}|${getEpochKey(obs)}`]?.status;
      return st === "ready" || st === "error";
    }).length;
  }, [playbackFrames, epochCutouts, renderSignature]);

  const allPlaybackFramesSettled =
    playbackFrames.length > 0 && settledPlaybackCount === playbackFrames.length;

  // Exclude any frames that failed to load once all selected frames have settled
  const readyPlaybackFrames = useMemo(
    () =>
      playbackFrames.filter(
        (obs) => epochCutouts[`${renderSignature}|${getEpochKey(obs)}`]?.status === "ready"
      ),
    [playbackFrames, epochCutouts, renderSignature]
  );

  const effectivePlaybackFrames = allPlaybackFramesSettled ? readyPlaybackFrames : playbackFrames;

  // Keep selectedObs synced to an active (and valid) playback frame when selection or load state changes
  useEffect(() => {
    if (effectivePlaybackFrames.length === 0 || !selectedObs) return;
    const exists = effectivePlaybackFrames.some((o) => isSameObs(o, selectedObs));
    if (!exists) {
      onSelectVersionObservation(activeCollection, effectivePlaybackFrames[0]);
    }
  }, [effectivePlaybackFrames, selectedObs, activeCollection, onSelectVersionObservation]);

  const activeEpochIdx = useMemo(() => {
    if (epochFrames.length === 0) return fallbackEpochIdx;
    if (effectivePlaybackFrames.length === 0) return 0;
    if (!selectedObs) return 0;
    const idx = effectivePlaybackFrames.findIndex((o) => isSameObs(o, selectedObs));
    return idx >= 0 ? idx : 0;
  }, [epochFrames.length, effectivePlaybackFrames, selectedObs, fallbackEpochIdx]);

  const canAutoplayCutout =
    secondMapOpen &&
    secondMapTab === "cutout" &&
    allPlaybackFramesSettled &&
    readyPlaybackFrames.length > 1;

  const prevCanAutoplayRef = useRef<boolean>(false);

  // Autoplay Map 2 epoch video once all selected playback frames finish loading
  useEffect(() => {
    if (canAutoplayCutout && !prevCanAutoplayRef.current) {
      setIsPlaying(true);
    }
    prevCanAutoplayRef.current = canAutoplayCutout;
  }, [canAutoplayCutout]);

  const isPreloadingAll =
    epochFrames.length > 0 && playbackFrames.length > 0 && !allPlaybackFramesSettled;

  const isWaitingForSelectedDates = epochFrames.length > 0 && playbackFrames.length === 0;

  const activePlaybackObs =
    effectivePlaybackFrames[activeEpochIdx] ?? effectivePlaybackFrames[0] ?? null;
  const activePreloadedCutout = activePlaybackObs
    ? epochCutouts[`${renderSignature}|${getEpochKey(activePlaybackObs)}`]?.cutout ?? null
    : null;

  const displayCutout = useMemo(() => {
    if (epochFrames.length > 0) {
      if (!allPlaybackFramesSettled || readyPlaybackFrames.length === 0) return null;
      return activePreloadedCutout ?? cutout;
    }
    return cutout;
  }, [
    epochFrames.length,
    allPlaybackFramesSettled,
    readyPlaybackFrames.length,
    activePreloadedCutout,
    cutout,
  ]);

  // Smooth crossfade tracking for Map 2
  useEffect(() => {
    if (
      displayCutout?.dataUrl &&
      lastCutoutUrlRef.current &&
      lastCutoutUrlRef.current !== displayCutout.dataUrl
    ) {
      setPrevCutoutUrl(lastCutoutUrlRef.current);
    }
    if (displayCutout?.dataUrl) {
      lastCutoutUrlRef.current = displayCutout.dataUrl;
    }
  }, [displayCutout?.dataUrl]);

  // Automatic epoch playback interval (only advances once all selected frames are cached)
  useEffect(() => {
    if (!isPlaying) return;
    if (epochFrames.length > 0 && (!allPlaybackFramesSettled || readyPlaybackFrames.length <= 1)) {
      return;
    }
    const intervalMs = Math.max(250, Math.round(950 / speedMultiplier));
    const timer = window.setInterval(() => {
      if (readyPlaybackFrames.length > 1) {
        const nextIdx = (activeEpochIdx + 1) % readyPlaybackFrames.length;
        onSelectVersionObservation(activeCollection, readyPlaybackFrames[nextIdx]);
      } else if (epochFrames.length === 0) {
        setFallbackEpochIdx((prev) => (prev + 1) % FALLBACK_EPOCHS.length);
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    isPlaying,
    speedMultiplier,
    epochFrames.length,
    readyPlaybackFrames,
    allPlaybackFramesSettled,
    activeEpochIdx,
    activeCollection,
    onSelectVersionObservation,
  ]);

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
    if (!displayCutout || !lastCoords) return null;
    return computeAxisTicks(displayCutout.width, displayCutout.height, displayCutout.wcs, lastCoords);
  }, [displayCutout, lastCoords]);

  const currentFov = lastCoords?.size ?? 0.12;

  const handleDownloadPng = () => {
    if (!displayCutout) return;
    const a = document.createElement("a");
    a.href = displayCutout.dataUrl;
    const name = selectedObs
      ? `spherex_${selectedObs.obs_collection}_${selectedObs.bandpass}_${selectedObs.obs_id}.png`
      : "spherex_cutout.png";
    a.download = name;
    a.click();
  };

  const toggleEpochDate = (obs: SpherexObservation) => {
    const key = getEpochKey(obs);
    setSelectedEpochKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const allEpochDatesSelected =
    epochFrames.length > 0 && selectedEpochKeys.size === epochFrames.length;

  const handleToggleAllDates = () => {
    if (allEpochDatesSelected) {
      setSelectedEpochKeys(new Set());
    } else {
      setSelectedEpochKeys(new Set(epochFrames.map(getEpochKey)));
    }
  };

  const currentDatePillLabel = useMemo(() => {
    if (effectivePlaybackFrames.length > 0) {
      const current = effectivePlaybackFrames[activeEpochIdx] ?? effectivePlaybackFrames[0];
      return current.epoch_date ?? current.obs_id;
    }
    if (epochFrames.length > 0) {
      return `0/${epochFrames.length}`;
    }
    if (selectedObs?.epoch_date) {
      return selectedObs.epoch_date;
    }
    return FALLBACK_EPOCHS[fallbackEpochIdx] ?? t.chrono.noDateLabel;
  }, [effectivePlaybackFrames, activeEpochIdx, epochFrames.length, selectedObs?.epoch_date, fallbackEpochIdx, t.chrono.noDateLabel]);

  const epochReadoutText = useMemo(() => {
    if (effectivePlaybackFrames.length > 0) {
      const current = effectivePlaybackFrames[activeEpochIdx] ?? effectivePlaybackFrames[0];
      const dateStr = current.epoch_date ?? current.bandpass ?? "SPHEREx";
      return `${dateStr} (t${activeEpochIdx + 1}/${effectivePlaybackFrames.length})`;
    }
    if (epochFrames.length > 0) {
      return `0/${epochFrames.length}`;
    }
    return FALLBACK_EPOCHS[fallbackEpochIdx] ?? FALLBACK_EPOCHS[0];
  }, [effectivePlaybackFrames, epochFrames.length, activeEpochIdx, fallbackEpochIdx]);

  const maxEpochSlider = Math.max(
    1,
    (epochFrames.length > 0 ? Math.max(1, effectivePlaybackFrames.length) : FALLBACK_EPOCHS.length) - 1
  );

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
      {/* VIEWPORT AREA: 1 Map (Full Width) or Compact Map 1 + Dominant Map 2   */}
      {/* ===================================================================== */}
      <div
        className={`flex-1 min-h-0 grid gap-4 transition-all duration-300 ${
          secondMapOpen
            ? "grid-cols-1 grid-rows-[200px_1fr] lg:grid-rows-1 lg:grid-cols-[270px_1fr] xl:grid-cols-[300px_1fr]"
            : "grid-cols-1"
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
            {/* Top-Left Map 2 Current Date Pill + Playback Date Selector Dropdown */}
            <div ref={dateMenuRef} className="absolute top-4 left-4 z-30 max-w-[58%]">
              <button
                type="button"
                onClick={() => setDateMenuOpen((o) => !o)}
                title={t.chrono.selectDatesTooltip}
                className="glass-panel rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs font-mono text-slate-100 hover:border-[#00D2FF]/60 transition-colors cursor-pointer max-w-full"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] shrink-0" />
                <Calendar className="w-3.5 h-3.5 text-[#00D2FF] shrink-0" />
                <span className="font-mono font-medium text-amber-300 truncate">
                  {currentDatePillLabel}
                </span>
                {selectedObs && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#00D2FF]/20 text-[#00D2FF] text-[10px] font-bold shrink-0">
                    {selectedObs.bandpass}
                  </span>
                )}
                {(cutoutLoading || isPreloadingAll) && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00D2FF] shrink-0" />
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                    dateMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {dateMenuOpen && (
                <div className="mt-2 w-72 max-w-[calc(100vw-3rem)] glass-panel rounded-2xl border border-white/15 bg-slate-950/90 backdrop-blur-xl shadow-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-semibold text-slate-200 truncate">
                        {t.chrono.playbackDatesTitle}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-[#00D2FF]">
                        {selectedEpochKeys.size}/{epochFrames.length}
                      </span>
                    </div>
                    {epochFrames.length > 0 && (
                      <button
                        type="button"
                        onClick={handleToggleAllDates}
                        className="text-[11px] font-medium text-[#00D2FF] hover:text-white cursor-pointer shrink-0"
                      >
                        {allEpochDatesSelected ? t.chrono.selectNoDates : t.chrono.selectAllDates}
                      </button>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                    {epochFrames.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-2 text-center">
                        {t.chrono.noDatesAvailable}
                      </p>
                    ) : (
                      epochFrames.map((obs) => {
                        const key = getEpochKey(obs);
                        const isChecked = selectedEpochKeys.has(key);
                        const isCurrent = isSameObs(selectedObs, obs);
                        const frameStatus = epochCutouts[`${renderSignature}|${key}`]?.status;

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleEpochDate(obs)}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                              isCurrent
                                ? "bg-[#00D2FF]/15 border border-[#00D2FF]/40 text-white"
                                : "hover:bg-white/[0.06] border border-transparent text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                                  isChecked
                                    ? "bg-[#00D2FF] border-[#00D2FF] text-slate-950"
                                    : "border-slate-500 bg-transparent"
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </span>
                              <span className="font-mono text-[11px] truncate">
                                {obs.epoch_date ?? obs.obs_id}
                              </span>
                            </div>
                            <span className="shrink-0 flex items-center">
                              {frameStatus === "ready" ? (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                              ) : frameStatus === "loading" ? (
                                <Loader2 className="w-3 h-3 animate-spin text-[#00D2FF]" />
                              ) : frameStatus === "error" ? (
                                <span className="w-2 h-2 rounded-full bg-rose-400" />
                              ) : null}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {epochFrames.length > 0 && selectedEpochKeys.size === 0 && (
                    <p className="text-[10px] text-amber-300/90 pt-1 border-t border-white/10">
                      {t.chrono.selectAtLeastOneDate}
                    </p>
                  )}
                </div>
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
                {isWaitingForSelectedDates ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-amber-300" />
                    </div>
                    <p className="text-xs font-medium text-slate-300">
                      {t.chrono.selectAtLeastOneDate}
                    </p>
                  </div>
                ) : isPreloadingAll ? (
                  <div className="flex flex-col items-center justify-center gap-2.5 text-slate-300 px-4 text-center">
                    <Loader2 className="w-7 h-7 animate-spin text-[#00D2FF]" />
                    <span className="text-xs font-medium text-slate-200">
                      {t.chrono.preloadingFrames(settledPlaybackCount, playbackFrames.length)}
                    </span>
                  </div>
                ) : displayCutout ? (
                  <div
                    className="relative border border-white/30 shadow-2xl"
                    style={{
                      aspectRatio: `${displayCutout.width} / ${displayCutout.height}`,
                      ...(displayCutout.width >= displayCutout.height
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
                        key={displayCutout.dataUrl}
                        src={displayCutout.dataUrl}
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
                    {displayCutout && (
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
                          href={displayCutout.fits_cutout_url}
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
            ) : secondMapTab === "bands" ? (
              /* Map 2 Tab: 6 Spectral Bands (D1 - D6) Grid */
              <div className="flex-1 w-full h-full pt-16 pb-4 px-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-start">
                {bandRepresentatives.map((obs) => {
                  const key = `${obs.bandpass}|${obs.obs_id}`;
                  const entry = bandCutouts[key];
                  const isCurrent = isSameObs(selectedObs, obs);
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
            ) : secondMapTab === "sed" ? (
              <div className="flex-1 w-full h-full pt-16 pb-4 px-4 overflow-y-auto">
                <SpectralProfile
                  observations={observations}
                  cachedFluxes={cachedFluxes}
                  selectedObsId={selectedObs?.obs_id ?? ""}
                  onSelectObsId={(obsId) => {
                    const target = observations.find((o) => o.obs_id === obsId);
                    if (target) onSelectVersionObservation(activeCollection, target);
                  }}
                  onScanAllBands={handleScanAllBands}
                  isScanning={isScanningBands}
                  scanProgress={scanProgress}
                />
              </div>
            ) : secondMapTab === "blink" ? (
              <div className="flex-1 w-full h-full pt-16 pb-4 px-4 overflow-y-auto">
                <BlinkComparator
                  observations={observations}
                  selectedIdx={selectedIdx >= 0 ? selectedIdx : 0}
                  onSelectIndex={(idx) => {
                    const target = observations[idx];
                    if (target) onSelectVersionObservation(activeCollection, target);
                  }}
                  cachedImages={cachedImages}
                />
              </div>
            ) : (
              <div className="flex-1 w-full h-full pt-16 pb-4 px-4 overflow-y-auto">
                <DetectorGuide
                  currentBand="all"
                  onSelectBand={() => {}}
                  selectedObsBandpass={selectedObs?.bandpass}
                />
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
                if (effectivePlaybackFrames.length > 0 && effectivePlaybackFrames[idx]) {
                  onSelectVersionObservation(activeCollection, effectivePlaybackFrames[idx]);
                } else if (epochFrames.length === 0) {
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
