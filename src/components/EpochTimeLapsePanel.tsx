import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  Grid,
  Loader2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { getRenderedCutout } from "../lib/irsa";
import type {
  ColormapName,
  RenderedCutout,
  SpherexObservation,
  StretchMode,
} from "../lib/types";

interface EpochTimeLapsePanelProps {
  observations: SpherexObservation[];
  lastCoords: { ra: number; dec: number; size: number } | null;
  stretch: StretchMode;
  colormap: ColormapName;
  subtractZodi: boolean;
  showCrosshair: boolean;
  selectedObs: SpherexObservation | null;
  onSelectObservation: (obs: SpherexObservation) => void;
}

interface EpochVersion {
  number: number;
  key: string;
  obs: SpherexObservation;
  dateLabel: string;
  dateTimeLabel: string;
  exposuresInEpoch: number;
}

const SPEED_PRESETS_MS = [250, 500, 1000, 1500, 2500] as const;
const EPOCHS_PER_PAGE = 8;

export const EpochTimeLapsePanel: React.FC<EpochTimeLapsePanelProps> = ({
  observations,
  lastCoords,
  stretch,
  colormap,
  subtractZodi,
  showCrosshair,
  selectedObs,
  onSelectObservation,
}) => {
  const { t } = useLanguage();
  const [bandFilter, setBandFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"video" | "grid">("video");
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [smoothFade, setSmoothFade] = useState(true);
  const [speedMs, setSpeedMs] = useState<number>(800);
  const [epochPage, setEpochPage] = useState<number>(1);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [prevDataUrl, setPrevDataUrl] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);
  const startedKeysRef = useRef<Set<string>>(new Set());

  const [renderedMap, setRenderedMap] = useState<
    Record<string, { status: "idle" | "loading" | "ready" | "error"; cutout?: RenderedCutout }>
  >({});

  const availableBands = useMemo(() => {
    const set = new Set<string>();
    for (const obs of observations) {
      if (obs.bandpass) set.add(obs.bandpass);
    }
    return Array.from(set).sort();
  }, [observations]);

  // Reset band filter if the current filter no longer exists in observations
  useEffect(() => {
    if (bandFilter !== "ALL" && !availableBands.includes(bandFilter)) {
      setBandFilter("ALL");
    }
  }, [availableBands, bandFilter]);

  const epochVersions = useMemo<EpochVersion[]>(() => {
    if (observations.length === 0) return [];

    const filtered =
      bandFilter === "ALL"
        ? observations
        : observations.filter((o) => o.bandpass === bandFilter);

    if (filtered.length === 0) return [];

    // Group by epoch_date (YYYY-MM-DD) when multiple dates exist
    const byDate = new Map<string, SpherexObservation[]>();
    for (const obs of filtered) {
      const dateKey = obs.epoch_date ?? "unknown";
      const list = byDate.get(dateKey) ?? [];
      list.push(obs);
      byDate.set(dateKey, list);
    }

    const distinctDates = Array.from(byDate.keys()).filter((k) => k !== "unknown");

    if (distinctDates.length >= 2) {
      const sortedDates = distinctDates.sort();
      const versions: EpochVersion[] = sortedDates.map((dateKey, idx) => {
        const list = byDate.get(dateKey)!;
        const rep = list[0];
        return {
          number: idx + 1,
          key: `${dateKey}|${rep.obs_id}|${rep.bandpass}`,
          obs: rep,
          dateLabel: dateKey,
          dateTimeLabel: rep.epoch_datetime ?? dateKey,
          exposuresInEpoch: list.length,
        };
      });
      return versions;
    }

    // Fallback: if all observations are on a single date (or no t_min), list each exposure chronologically
    return filtered.map((obs, idx) => ({
      number: idx + 1,
      key: `${obs.epoch_date ?? "exp"}|${obs.obs_id}|${obs.bandpass}|${idx}`,
      obs,
      dateLabel: obs.epoch_date ?? obs.obs_id,
      dateTimeLabel: obs.epoch_datetime ?? obs.obs_id,
      exposuresInEpoch: 1,
    }));
  }, [observations, bandFilter]);

  const totalEpochPages = Math.max(1, Math.ceil(epochVersions.length / EPOCHS_PER_PAGE));
  const safeEpochPage = Math.min(epochPage, totalEpochPages);
  const pageStartIdx = (safeEpochPage - 1) * EPOCHS_PER_PAGE;
  const pageEndIdx = Math.min(pageStartIdx + EPOCHS_PER_PAGE, epochVersions.length);
  const paginatedEpochs = useMemo(
    () => epochVersions.slice(pageStartIdx, pageEndIdx),
    [epochVersions, pageStartIdx, pageEndIdx]
  );

  // Initialize selectedKeys (first 2 dates by default for fast initial loading) and activeKey whenever epochVersions changes
  useEffect(() => {
    setIsPlaying(false);
    setEpochPage(1);
    const firstDateKeys = new Set(epochVersions.slice(0, 2).map((v) => v.key));
    setSelectedKeys(firstDateKeys);
    setActiveKey(epochVersions[0]?.key ?? null);
    prevUrlRef.current = null;
    setPrevDataUrl(null);
  }, [epochVersions]);

  // Reset renderedMap when coordinates, epochs, or visual parameters change
  useEffect(() => {
    startedKeysRef.current = new Set();
    if (!lastCoords || epochVersions.length === 0) {
      setRenderedMap({});
      return;
    }

    const initial: Record<
      string,
      { status: "idle" | "loading" | "ready" | "error"; cutout?: RenderedCutout }
    > = {};
    for (const v of epochVersions) {
      initial[v.key] = { status: "idle" };
    }
    setRenderedMap(initial);
  }, [epochVersions, lastCoords, stretch, colormap, subtractZodi]);

  const selectedVersions = useMemo(
    () => epochVersions.filter((v) => selectedKeys.has(v.key)),
    [epochVersions, selectedKeys]
  );

  // Ensure activeKey stays valid when user toggles selections
  const activeVersion = useMemo(() => {
    const found = epochVersions.find((v) => v.key === activeKey);
    if (found) return found;
    return selectedVersions[0] ?? epochVersions[0] ?? null;
  }, [activeKey, epochVersions, selectedVersions]);

  // Lazy-load ONLY the selected dates/epochs or the active frame (never unselected dates)
  useEffect(() => {
    if (!lastCoords || epochVersions.length === 0) return;

    const controller = new AbortController();
    const candidates = epochVersions.filter((v) => {
      if (startedKeysRef.current.has(v.key)) return false;
      const isSelectedOrActive = selectedKeys.has(v.key) || activeVersion?.key === v.key;
      return isSelectedOrActive;
    });

    if (candidates.length === 0) return;

    for (const item of candidates) {
      startedKeysRef.current.add(item.key);
    }

    setRenderedMap((prev) => {
      const next = { ...prev };
      for (const item of candidates) {
        next[item.key] = { status: "loading" };
      }
      return next;
    });

    for (const current of candidates) {
      void getRenderedCutout({
        accessUrl: current.obs.access_url,
        ra: lastCoords.ra,
        dec: lastCoords.dec,
        size: lastCoords.size,
        stretch,
        colormap,
        subtractZodi,
        priority: "low",
        signal: controller.signal,
      })
        .then((cutout) => {
          if (controller.signal.aborted) return;
          setRenderedMap((prev) => ({
            ...prev,
            [current.key]: { status: "ready", cutout },
          }));
        })
        .catch((err) => {
          if (
            controller.signal.aborted ||
            (err instanceof DOMException && err.name === "AbortError")
          ) {
            startedKeysRef.current.delete(current.key);
            return;
          }
          setRenderedMap((prev) => ({
            ...prev,
            [current.key]: { status: "error" },
          }));
        });
    }

    return () => {
      controller.abort();
    };
  }, [
    epochVersions,
    pageStartIdx,
    pageEndIdx,
    selectedKeys,
    activeVersion,
    lastCoords,
    stretch,
    colormap,
    subtractZodi,
  ]);

  const activeDataUrl = activeVersion
    ? renderedMap[activeVersion.key]?.cutout?.dataUrl ?? null
    : null;

  // Track previous frame image for smooth crossfade
  useEffect(() => {
    if (activeDataUrl && prevUrlRef.current && prevUrlRef.current !== activeDataUrl) {
      setPrevDataUrl(prevUrlRef.current);
    }
    if (activeDataUrl) {
      prevUrlRef.current = activeDataUrl;
    }
  }, [activeDataUrl]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || selectedVersions.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveKey((current) => {
        const idx = selectedVersions.findIndex((v) => v.key === current);
        if (idx === -1) return selectedVersions[0].key;
        const nextIdx = idx + 1;
        if (nextIdx >= selectedVersions.length) {
          if (loop) return selectedVersions[0].key;
          setIsPlaying(false);
          return current;
        }
        return selectedVersions[nextIdx].key;
      });
    }, speedMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, selectedVersions, speedMs, loop]);

  if (!lastCoords || epochVersions.length === 0) {
    return null;
  }

  const readyCount = epochVersions.filter(
    (v) => renderedMap[v.key]?.status === "ready"
  ).length;

  const toggleIncludeVersion = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectIndividual = (v: EpochVersion) => {
    setIsPlaying(false);
    setActiveKey(v.key);
    onSelectObservation(v.obs);
  };

  const handleStep = (delta: number) => {
    const list = selectedVersions.length > 0 ? selectedVersions : epochVersions;
    if (list.length === 0) return;
    setIsPlaying(false);
    const idx = list.findIndex((v) => v.key === activeVersion?.key);
    const baseIdx = idx === -1 ? 0 : idx;
    const nextIdx = (baseIdx + delta + list.length) % list.length;
    setActiveKey(list[nextIdx].key);
  };

  const activeEntry = activeVersion ? renderedMap[activeVersion.key] : undefined;
  const activeSelectedIdx = selectedVersions.findIndex(
    (v) => v.key === activeVersion?.key
  );
  const fadeDurationMs = smoothFade ? Math.min(450, Math.floor(speedMs * 0.45)) : 0;

  return (
    <div className="bg-space-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/70 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Film className="w-4 h-4 text-cyan-400" />
            <span>{t.epochPlayer.title}</span>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
              {t.epochPlayer.readyProgress({ ready: readyCount, total: epochVersions.length })}
            </span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {t.epochPlayer.subtitle({
              total: epochVersions.length,
              selected: selectedVersions.length,
            })}
          </p>
        </div>

        {/* View Mode Switch: Video vs Conjunto Grid */}
        <div className="flex items-center gap-1.5 bg-space-900/90 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("video")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === "video"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>{t.epochPlayer.modeVideo}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setViewMode("grid");
            }}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === "grid"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>{t.epochPlayer.modeGrid}</span>
          </button>
        </div>
      </div>

      {/* Band filter pills */}
      {availableBands.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setBandFilter("ALL")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
              bandFilter === "ALL"
                ? "bg-cyan-950/80 border-cyan-500 text-cyan-200"
                : "bg-space-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.epochPlayer.allBands}
          </button>
          {availableBands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBandFilter(b)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                bandFilter === b
                  ? "bg-cyan-950/80 border-cyan-500 text-cyan-200"
                  : "bg-space-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {/* Main Display Area: Video Player or Conjunto Grid */}
      {viewMode === "video" ? (
        <div className="flex flex-col gap-3">
          {selectedVersions.length === 0 ? (
            <div className="bg-black/60 border border-slate-800 rounded-xl p-8 text-center">
              <p className="text-sm font-medium text-slate-300">
                {t.epochPlayer.noSelectionTitle}
              </p>
              <p className="text-xs text-slate-500 mt-1">{t.epochPlayer.noSelectionDesc}</p>
            </div>
          ) : (
            <>
              {/* Video Viewport */}
              <div className="relative w-full aspect-square max-h-[400px] bg-black/90 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                {smoothFade && prevDataUrl && (
                  <img
                    src={prevDataUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-contain [image-rendering:pixelated] pointer-events-none"
                  />
                )}

                {activeEntry?.status === "ready" && activeEntry.cutout ? (
                  <img
                    key={activeVersion?.key}
                    src={activeEntry.cutout.dataUrl}
                    alt={activeVersion ? `#${activeVersion.number} ${activeVersion.dateLabel}` : ""}
                    style={{
                      transitionDuration: `${fadeDurationMs}ms`,
                    }}
                    className="relative w-full h-full object-contain [image-rendering:pixelated] transition-opacity ease-in-out animate-[fadeIn_0.2s_ease-in]"
                  />
                ) : activeEntry?.status === "error" ? (
                  <span className="text-xs text-rose-400 px-4 text-center">
                    {t.epochPlayer.errorFrame}
                  </span>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    <span className="text-xs">{t.epochPlayer.loadingFrame}</span>
                  </div>
                )}

                {showCrosshair && activeEntry?.status === "ready" && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full border border-cyan-400/70" />
                    <div className="absolute w-12 h-[1px] bg-cyan-400/70" />
                    <div className="absolute h-12 w-[1px] bg-cyan-400/70" />
                  </div>
                )}

                {/* Prominent Version Number & Epoch Overlay */}
                {activeVersion && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-space-950/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-700/60 shadow-lg">
                    <span className="w-7 h-7 rounded-md bg-cyan-500 text-slate-950 font-extrabold text-sm flex items-center justify-center font-mono">
                      {activeVersion.number}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white font-mono">
                        {activeVersion.dateTimeLabel}
                      </span>
                      <span className="text-[10px] text-cyan-300 font-mono">
                        {activeVersion.obs.bandpass} · {activeVersion.obs.obs_id}
                      </span>
                    </div>
                  </div>
                )}

                {/* Sequence Counter */}
                {activeSelectedIdx >= 0 && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-space-950/90 border border-slate-700/80 text-[11px] font-mono text-slate-200">
                    {t.epochPlayer.frameCounter({
                      current: activeSelectedIdx + 1,
                      total: selectedVersions.length,
                    })}
                  </div>
                )}
              </div>

              {/* Playback & Speed Controls */}
              <div className="bg-space-900/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Transport Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStep(-1)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                      title={t.epochPlayer.prevFrame}
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (selectedVersions.length <= 1) return;
                        if (!activeVersion || !selectedKeys.has(activeVersion.key)) {
                          setActiveKey(selectedVersions[0].key);
                        }
                        setIsPlaying((p) => !p);
                      }}
                      disabled={selectedVersions.length <= 1}
                      className={`px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        isPlaying
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                          : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4" />
                          <span>{t.epochPlayer.pause}</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          <span>{t.epochPlayer.play}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStep(1)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                      title={t.epochPlayer.nextFrame}
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Loop & Crossfade Toggles */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLoop((v) => !v)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                        loop
                          ? "bg-cyan-950/80 border-cyan-600 text-cyan-200"
                          : "bg-space-950/60 border-slate-800 text-slate-400"
                      }`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>{t.epochPlayer.loopLabel}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSmoothFade((v) => !v)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                        smoothFade
                          ? "bg-cyan-950/80 border-cyan-600 text-cyan-200"
                          : "bg-space-950/60 border-slate-800 text-slate-400"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t.epochPlayer.crossfadeLabel}</span>
                    </button>
                  </div>
                </div>

                {/* Speed Control Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-medium">{t.epochPlayer.speedLabel}</span>
                    <span className="font-mono text-cyan-300 text-[11px] bg-space-950 px-2 py-0.5 rounded border border-slate-800">
                      {t.epochPlayer.speedUnit(speedMs)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="range"
                      min={150}
                      max={3000}
                      step={50}
                      value={speedMs}
                      onChange={(e) => setSpeedMs(Number(e.target.value))}
                      className="w-28 accent-cyan-400 cursor-pointer"
                      aria-label={t.epochPlayer.speedLabel}
                    />
                    <div className="flex items-center gap-1">
                      {SPEED_PRESETS_MS.map((ms) => (
                        <button
                          key={ms}
                          type="button"
                          onClick={() => setSpeedMs(ms)}
                          className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                            speedMs === ms
                              ? "bg-cyan-500 text-slate-950 border-cyan-400 font-bold"
                              : "bg-space-950/70 text-slate-400 border-slate-800 hover:text-slate-200"
                          }`}
                        >
                          {(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 2)}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Grid Mode: Ver en Conjunto */
        <div>
          {selectedVersions.length === 0 ? (
            <div className="bg-black/60 border border-slate-800 rounded-xl p-8 text-center">
              <p className="text-sm font-medium text-slate-300">
                {t.epochPlayer.noSelectionTitle}
              </p>
              <p className="text-xs text-slate-500 mt-1">{t.epochPlayer.noSelectionDesc}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {selectedVersions.map((v) => {
                const entry = renderedMap[v.key];
                const isMainSelected =
                  selectedObs?.obs_id === v.obs.obs_id &&
                  selectedObs?.bandpass === v.obs.bandpass;

                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handleSelectIndividual(v)}
                    title={t.epochPlayer.viewIndividual}
                    className={`group text-left rounded-xl overflow-hidden border transition-all flex flex-col cursor-pointer ${
                      isMainSelected
                        ? "bg-cyan-950/40 border-cyan-400 ring-1 ring-cyan-400/40"
                        : "bg-space-900/60 border-slate-800/80 hover:border-cyan-600/70"
                    }`}
                  >
                    <div className="relative w-full aspect-square bg-black/90 flex items-center justify-center overflow-hidden border-b border-slate-800/70">
                      {entry?.status === "ready" && entry.cutout ? (
                        <img
                          src={entry.cutout.dataUrl}
                          alt={`#${v.number} ${v.dateLabel}`}
                          className="w-full h-full object-contain [image-rendering:pixelated]"
                        />
                      ) : entry?.status === "error" ? (
                        <span className="text-[11px] text-rose-400 px-2 text-center">
                          {t.epochPlayer.errorFrame}
                        </span>
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      )}

                      <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md bg-cyan-500 text-slate-950 font-extrabold text-xs flex items-center justify-center font-mono shadow">
                        {v.number}
                      </span>
                    </div>
                    <div className="p-2 flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-white font-mono truncate">
                        {v.dateLabel}
                      </span>
                      <span className="text-[10px] text-cyan-300 font-mono truncate">
                        {v.obs.bandpass}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Numbered Epoch Selector Strip (Individual & Conjunto Selection) with Pagination */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/70">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] text-slate-400">
            {t.epochPlayer.paginationInfo({
              from: pageStartIdx + 1,
              to: pageEndIdx,
              total: epochVersions.length,
            })}{" "}
            · {t.epochPlayer.viewIndividual}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {totalEpochPages > 1 && (
              <div className="flex items-center gap-1 bg-space-950/80 border border-slate-800 rounded-lg px-1.5 py-0.5 mr-1">
                <button
                  type="button"
                  onClick={() => setEpochPage((p) => Math.max(1, p - 1))}
                  disabled={safeEpochPage <= 1}
                  title={t.epochPlayer.prevPage}
                  className="p-0.5 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-cyan-300 px-1">
                  {t.epochPlayer.pageIndicator({
                    page: safeEpochPage,
                    totalPages: totalEpochPages,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setEpochPage((p) => Math.min(totalEpochPages, p + 1))}
                  disabled={safeEpochPage >= totalEpochPages}
                  title={t.epochPlayer.nextPage}
                  className="p-0.5 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setSelectedKeys((prev) => {
                  const next = new Set(prev);
                  for (const v of paginatedEpochs) next.add(v.key);
                  return next;
                })
              }
              className="px-2 py-1 text-[11px] font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            >
              {t.epochPlayer.selectAll}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setSelectedKeys(new Set());
              }}
              className="px-2 py-1 text-[11px] font-medium rounded-md bg-slate-800/70 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              {t.epochPlayer.clearAll}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {paginatedEpochs.map((v) => {
            const isIncluded = selectedKeys.has(v.key);
            const isCurrentFrame = activeVersion?.key === v.key;
            const entry = renderedMap[v.key];

            return (
              <div
                key={v.key}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectIndividual(v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectIndividual(v);
                  }
                }}
                title={t.epochPlayer.viewIndividual}
                className={`relative rounded-xl p-2 border transition-all flex items-center gap-2 cursor-pointer select-none ${
                  isCurrentFrame
                    ? "bg-cyan-950/60 border-cyan-400 ring-1 ring-cyan-400/40 shadow"
                    : isIncluded
                    ? "bg-space-900/80 border-slate-700 hover:border-cyan-600/70"
                    : "bg-space-950/40 border-slate-800/60 opacity-55 hover:opacity-85"
                }`}
              >
                {/* Number Badge */}
                <span
                  className={`w-7 h-7 rounded-lg font-extrabold text-xs flex items-center justify-center font-mono shrink-0 ${
                    isCurrentFrame
                      ? "bg-cyan-400 text-slate-950"
                      : isIncluded
                      ? "bg-slate-800 text-cyan-300 border border-slate-700"
                      : "bg-slate-900 text-slate-500 border border-slate-800"
                  }`}
                >
                  {v.number}
                </span>

                {/* Mini Thumbnail + Metadata */}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-slate-100 font-mono truncate">
                    {v.dateLabel}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate flex items-center gap-1">
                    <span>{v.obs.bandpass}</span>
                    {v.exposuresInEpoch > 1 && (
                      <span className="text-slate-500">
                        · {t.epochPlayer.exposuresInEpoch(v.exposuresInEpoch)}
                      </span>
                    )}
                    {entry?.status === "loading" && (
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-400 inline" />
                    )}
                  </div>
                </div>

                {/* Conjunto Checkbox */}
                <button
                  type="button"
                  onClick={(e) => toggleIncludeVersion(v.key, e)}
                  title={t.epochPlayer.includeInSet}
                  aria-label={`${t.epochPlayer.includeInSet} #${v.number}`}
                  aria-pressed={isIncluded}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    isIncluded
                      ? "bg-cyan-500 border-cyan-400 text-slate-950"
                      : "bg-space-950 border-slate-700 text-transparent hover:border-slate-500"
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
