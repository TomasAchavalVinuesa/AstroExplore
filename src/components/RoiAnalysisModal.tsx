import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Check,
  CheckCircle2,
  FlaskConical,
  GitCompareArrows,
  Loader2,
  ScanSearch,
  Trash2,
  X,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { formatDectoDMS, formatRAtoHMS } from "../lib/coordinates";
import { compareRoiReadings } from "../lib/spectralAnalysis";
import type {
  ChemicalDetectionStatus,
  RoiChemicalAnalysisResult,
  SavedRoiReading,
  SkyRoiSelection,
} from "../lib/types";

interface RoiAnalysisModalProps {
  isOpen: boolean;
  initialTab?: "current" | "compare";
  roi: SkyRoiSelection | null;
  analysis: RoiChemicalAnalysisResult | null;
  targetName: string;
  totalAvailableObservations: number;
  isScanning: boolean;
  scanProgress: { current: number; total: number } | null;
  savedReadings: SavedRoiReading[];
  isCurrentSaved: boolean;
  onSaveReading: (name: string) => void;
  onDeleteSavedReading: (id: string) => void;
  onScanAllBands: () => void;
  onCancelScan: () => void;
  onClearRoi: () => void;
  onClose: () => void;
}

export const RoiAnalysisModal: React.FC<RoiAnalysisModalProps> = ({
  isOpen,
  initialTab = "current",
  roi,
  analysis,
  targetName,
  totalAvailableObservations,
  isScanning,
  scanProgress,
  savedReadings,
  isCurrentSaved,
  onSaveReading,
  onDeleteSavedReading,
  onScanAllBands,
  onCancelScan,
  onClearRoi,
  onClose,
}) => {
  const { language } = useLanguage();
  const isEn = language === "en";
  const [activeTab, setActiveTab] = useState<"current" | "compare">(initialTab);
  const [proportionMode, setProportionMode] = useState<"spectral" | "molar">("spectral");
  const [saveName, setSaveName] = useState<string>("");
  const [compareIdA, setCompareIdA] = useState<string>("");
  const [compareIdB, setCompareIdB] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Build pool of comparable readings (current unsaved ROI + saved readings)
  const comparablePool: SavedRoiReading[] = useMemo(() => {
    const list: SavedRoiReading[] = [];
    if (roi && analysis && !isCurrentSaved) {
      list.push({
        id: "__current__",
        name: isEn ? `Current area (${targetName})` : `Área actual (${targetName})`,
        savedAt: new Date().toISOString(),
        targetName,
        roi,
        analysis,
      });
    }
    return [...list, ...savedReadings];
  }, [roi, analysis, isCurrentSaved, targetName, savedReadings, isEn]);

  useEffect(() => {
    if (comparablePool.length === 0) return;
    const nextA = comparablePool.some((r) => r.id === compareIdA)
      ? compareIdA
      : comparablePool[0].id;
    if (nextA !== compareIdA) {
      setCompareIdA(nextA);
    }
    if (comparablePool.length >= 2) {
      const validB =
        Boolean(compareIdB) &&
        compareIdB !== nextA &&
        comparablePool.some((r) => r.id === compareIdB);
      if (!validB) {
        const other = comparablePool.find((r) => r.id !== nextA);
        if (other) setCompareIdB(other.id);
      }
    }
  }, [comparablePool, compareIdA, compareIdB]);

  const readingA = comparablePool.find((r) => r.id === compareIdA) ?? null;
  const readingB = comparablePool.find((r) => r.id === compareIdB) ?? null;

  const comparison = useMemo(() => {
    if (!readingA || !readingB || readingA.id === readingB.id) return null;
    return compareRoiReadings(readingA, readingB);
  }, [readingA, readingB]);

  const activeProportionMode =
    proportionMode === "molar" && analysis?.hasMolarProportions ? "molar" : "spectral";

  const rankedSpecies = useMemo(() => {
    if (!analysis) return [];
    return analysis.species
      .filter((s) =>
        activeProportionMode === "molar"
          ? s.molarSharePct !== null && s.molarSharePct > 0
          : s.spectralSharePct !== null && s.spectralSharePct > 0
      )
      .sort((a, b) => {
        const va =
          activeProportionMode === "molar" ? (a.molarSharePct ?? 0) : (a.spectralSharePct ?? 0);
        const vb =
          activeProportionMode === "molar" ? (b.molarSharePct ?? 0) : (b.spectralSharePct ?? 0);
        return vb - va;
      });
  }, [analysis, activeProportionMode]);

  const noCoverageCount = useMemo(
    () => (analysis ? analysis.species.filter((s) => s.status === "no_coverage").length : 0),
    [analysis]
  );

  const plotData = useMemo(() => {
    const pts = analysis?.spectrumPoints ?? [];
    if (pts.length === 0) return null;
    const minWave = 0.7;
    const maxWave = 5.05;
    const vals = pts.map((p) => p.flux);
    const minF = Math.min(...vals);
    const maxF = Math.max(...vals);
    const pad = Math.max(1e-4, (maxF - minF) * 0.15);
    const yMin = minF - pad;
    const yMax = maxF + pad;
    const spanY = yMax - yMin || 1;
    const w = 640;
    const h = 150;
    const pl = 48;
    const pr = 16;
    const pt = 14;
    const pb = 26;
    const pw = w - pl - pr;
    const ph = h - pt - pb;
    const toX = (wave: number) => pl + ((wave - minWave) / (maxWave - minWave)) * pw;
    const toY = (flux: number) => pt + ph - ((flux - yMin) / spanY) * ph;
    const pathD =
      pts.length >= 2
        ? pts
            .map(
              (p, idx) =>
                `${idx === 0 ? "M" : "L"} ${toX(p.waveUm).toFixed(1)} ${toY(p.flux).toFixed(1)}`
            )
            .join(" ")
        : "";
    return { pts, w, h, pl, pr, pt, pb, pw, ph, yMin, yMax, toX, toY, pathD };
  }, [analysis?.spectrumPoints]);

  if (!isOpen) return null;

  const statusLabel = (status: ChemicalDetectionStatus) => {
    switch (status) {
      case "detected":
        return isEn ? "Detected (≥3σ)" : "Detectado (≥3σ)";
      case "marginal":
        return isEn ? "Marginal (2–3σ)" : "Marginal (2–3σ)";
      case "not_detected":
        return isEn ? "Not detected (<2σ)" : "No detectado (<2σ)";
      case "no_coverage":
      default:
        return isEn ? "No coverage" : "Sin cobertura";
    }
  };

  const statusBadgeClass = (status: ChemicalDetectionStatus) => {
    switch (status) {
      case "detected":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-400/40";
      case "marginal":
        return "bg-amber-500/20 text-amber-300 border-amber-400/40";
      case "not_detected":
        return "bg-slate-700/40 text-slate-400 border-white/10";
      case "no_coverage":
      default:
        return "bg-white/[0.03] text-slate-500 border-white/10";
    }
  };

  const loadedObsCount = analysis?.totalObservationsAnalyzed ?? 0;
  const coveredChannels = analysis?.coveredChannelsCount ?? 0;

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = saveName.trim();
    if (!trimmed) return;
    onSaveReading(trimmed);
    setSaveName("");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-3xl border border-white/15 bg-[#070B19]/95 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                {isEn
                  ? "Infrared Composition & Area Comparison"
                  : "Composición Infrarroja y Comparación de Áreas"}
              </h3>
              {roi && (
                <p className="text-[11px] font-mono text-slate-400 truncate">
                  RA {formatRAtoHMS(roi.centerRa)} · Dec {formatDectoDMS(roi.centerDec)} ·{" "}
                  {roi.widthArcsec.toFixed(1)}″ × {roi.heightArcsec.toFixed(1)}″
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tabs */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-black/50 border border-white/10 text-[11px]">
              {roi && (
                <button
                  type="button"
                  onClick={() => setActiveTab("current")}
                  className={`px-2.5 py-1 rounded-[9px] cursor-pointer transition-colors ${
                    activeTab === "current"
                      ? "bg-[#00D2FF]/20 text-[#00D2FF] font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {isEn ? "Current Area" : "Área Actual"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab("compare")}
                className={`px-2.5 py-1 rounded-[9px] cursor-pointer flex items-center gap-1 transition-colors ${
                  activeTab === "compare"
                    ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <GitCompareArrows className="w-3 h-3" />
                <span>
                  {isEn
                    ? `Compare (${savedReadings.length})`
                    : `Comparar (${savedReadings.length})`}
                </span>
              </button>
            </div>

            {roi && (
              <button
                type="button"
                onClick={onClearRoi}
                disabled={isScanning}
                className="btn-press px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-rose-500/20 border border-white/10 hover:border-rose-400/40 text-[11px] text-slate-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                title={isEn ? "Clear selected area" : "Borrar área seleccionada"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-press p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
              aria-label={isEn ? "Close" : "Cerrar"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "current" && roi ? (
            <>
              {/* Real Coverage + Scan Trigger */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-200 font-medium">
                    <span>{isEn ? "Real FITS Coverage:" : "Cobertura FITS Real:"}</span>
                    <span className="font-mono text-[#00D2FF]">
                      {loadedObsCount} / {totalAvailableObservations}{" "}
                      {isEn ? "observations" : "observaciones"}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="font-mono text-emerald-300">
                      {coveredChannels} / 102 {isEn ? "IR channels" : "canales IR"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {isEn
                      ? "Computed strictly from real calibrated FITS pixels (IMAGE/VARIANCE/WCS-WAVE). Uncovered bands are never estimated."
                      : "Calculado estrictamente con píxeles FITS reales calibrados (IMAGE/VARIANCE/WCS-WAVE). Las bandas sin datos nunca se inventan."}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isScanning ? (
                    <button
                      type="button"
                      onClick={onCancelScan}
                      className="btn-press px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-xs font-medium text-rose-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        {isEn
                          ? `Cancel (${scanProgress?.current ?? 0}/${scanProgress?.total ?? 0})`
                          : `Cancelar (${scanProgress?.current ?? 0}/${scanProgress?.total ?? 0})`}
                      </span>
                    </button>
                  ) : (
                    loadedObsCount < totalAvailableObservations && (
                      <button
                        type="button"
                        onClick={onScanAllBands}
                        className="btn-press px-3.5 py-1.5 rounded-xl bg-[#00D2FF]/20 hover:bg-[#00D2FF]/30 border border-[#00D2FF]/60 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <ScanSearch className="w-3.5 h-3.5 text-[#00D2FF]" />
                        <span>
                          {isEn
                            ? `Scan all ${totalAvailableObservations} IRSA bands`
                            : `Escanear las ${totalAvailableObservations} bandas en IRSA`}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Save Reading Temporarily */}
              {!isScanning && analysis && (
                <form
                  onSubmit={handleSaveSubmit}
                  className="rounded-2xl bg-emerald-500/5 border border-emerald-400/25 p-3 flex flex-wrap items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2 text-xs text-emerald-200">
                    <Bookmark className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {isCurrentSaved
                        ? isEn
                          ? "Reading saved in browser for comparison."
                          : "Lectura guardada en el navegador para comparar."
                        : isEn
                          ? "Save this reading temporarily to compare with other regions:"
                          : "Guardá esta lectura temporalmente para compararla con otras regiones:"}
                    </span>
                  </div>
                  {isCurrentSaved ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-medium">
                      <Check className="w-3.5 h-3.5" />
                      {isEn ? "Saved" : "Guardada"}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder={isEn ? "Reading name..." : "Nombre de la lectura..."}
                        maxLength={48}
                        required
                        className="rounded-xl bg-black/50 border border-white/15 focus:border-emerald-400 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none w-48"
                      />
                      <button
                        type="submit"
                        disabled={!saveName.trim()}
                        className="btn-press px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer disabled:opacity-40"
                      >
                        {isEn ? "Save" : "Guardar"}
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* Mini Spectrum Plot */}
              {plotData && (
                <div className="rounded-2xl bg-black/50 border border-white/10 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      {isEn
                        ? "Extracted ROI Spectrum F_ν (MJy/sr) vs λ (µm)"
                        : "Espectro Real Extraído del Área F_ν (MJy/sr) vs λ (µm)"}
                    </span>
                    <span>
                      {plotData.pts.length} {isEn ? "samples" : "muestras"}
                    </span>
                  </div>
                  <svg
                    viewBox={`0 0 ${plotData.w} ${plotData.h}`}
                    className="w-full h-36 select-none"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <rect
                      x={plotData.pl}
                      y={plotData.pt}
                      width={plotData.pw}
                      height={plotData.ph}
                      fill="#030712"
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                    {analysis?.species
                      .filter((s) => s.status === "detected" || s.status === "marginal")
                      .map((s) => {
                        const x = plotData.toX(s.centerUm);
                        return (
                          <g key={s.id}>
                            <line
                              x1={x}
                              y1={plotData.pt}
                              x2={x}
                              y2={plotData.pt + plotData.ph}
                              stroke={s.status === "detected" ? "#34d399" : "#fbbf24"}
                              strokeWidth="1"
                              strokeDasharray="3,3"
                              opacity="0.7"
                            />
                            <text
                              x={x + 2}
                              y={plotData.pt + 11}
                              fill={s.status === "detected" ? "#6ee7b7" : "#fcd34d"}
                              fontSize="8.5"
                              fontFamily="monospace"
                            >
                              {s.formula}
                            </text>
                          </g>
                        );
                      })}
                    {plotData.pathD && (
                      <path d={plotData.pathD} fill="none" stroke="#00D2FF" strokeWidth="1.5" />
                    )}
                    {plotData.pts.map((p) => {
                      const cx = plotData.toX(p.waveUm);
                      const cy = plotData.toY(p.flux);
                      const yTop = plotData.toY(p.flux + p.sigma);
                      const yBot = plotData.toY(p.flux - p.sigma);
                      return (
                        <g key={p.obs_id}>
                          <line
                            x1={cx}
                            y1={yTop}
                            x2={cx}
                            y2={yBot}
                            stroke="#38bdf8"
                            strokeWidth="1"
                            opacity="0.45"
                          />
                          <circle cx={cx} cy={cy} r="2.3" fill="#38bdf8" />
                        </g>
                      );
                    })}
                    {[1.0, 2.0, 3.0, 4.0, 5.0].map((wTick) => {
                      const tx = plotData.toX(wTick);
                      return (
                        <text
                          key={wTick}
                          x={tx}
                          y={plotData.h - 6}
                          fill="#94a3b8"
                          fontSize="9"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {wTick.toFixed(1)} µm
                        </text>
                      );
                    })}
                  </svg>
                </div>
              )}

              {/* Relative Proportions Section */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#00D2FF]" />
                    <h4 className="text-xs sm:text-sm font-semibold text-white">
                      {isEn
                        ? "Relative Proportions of Detected Species"
                        : "Proporción Relativa de Compuestos Detectados"}
                    </h4>
                  </div>

                  {analysis?.hasMolarProportions && (
                    <div className="inline-flex items-center p-0.5 rounded-xl bg-black/50 border border-white/10 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setProportionMode("spectral")}
                        className={`px-2.5 py-1 rounded-[9px] cursor-pointer transition-colors ${
                          activeProportionMode === "spectral"
                            ? "bg-[#00D2FF]/20 text-[#00D2FF] font-semibold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {isEn ? "Spectral Weight (W_λ)" : "Peso Espectral (W_λ)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProportionMode("molar")}
                        className={`px-2.5 py-1 rounded-[9px] cursor-pointer transition-colors ${
                          activeProportionMode === "molar"
                            ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {isEn ? "Ice Molar Ratio (N_i)" : "Proporción Molar Hielos (N_i)"}
                      </button>
                    </div>
                  )}
                </div>

                {rankedSpecies.length > 0 ? (
                  <div className="space-y-2.5">
                    {rankedSpecies.map((s) => {
                      const pct =
                        activeProportionMode === "molar"
                          ? (s.molarSharePct ?? 0)
                          : (s.spectralSharePct ?? 0);
                      const err =
                        activeProportionMode === "molar"
                          ? (s.molarShareErrorPct ?? 0)
                          : (s.spectralShareErrorPct ?? 0);
                      return (
                        <div key={s.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-semibold text-white">{s.formula}</span>
                              <span className="text-slate-400 truncate">
                                {isEn ? s.nameEn : s.nameEs}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusBadgeClass(
                                  s.status
                                )}`}
                              >
                                {s.snr.toFixed(1)}σ
                              </span>
                            </div>
                            <span className="font-mono font-semibold text-emerald-300 shrink-0">
                              {pct.toFixed(1)}%{" "}
                              <span className="text-[10px] text-slate-400">
                                ± {err.toFixed(1)}%
                              </span>
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                s.status === "detected" ? "bg-emerald-400" : "bg-amber-400"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl bg-black/40 border border-white/10 p-3 flex items-start gap-2.5 text-xs text-slate-300">
                    <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <div>
                      {noCoverageCount === (analysis?.species.length ?? 0) ? (
                        <p>
                          {isEn
                            ? "There are not enough spectral bands loaded yet for this area to evaluate chemical signatures."
                            : "Todavía no hay suficientes bandas espectrales cargadas en esta área para evaluar firmas químicas."}
                        </p>
                      ) : (
                        <p>
                          {isEn
                            ? "No molecular or ice absorption/emission signatures exceeded the 2σ noise threshold in the currently covered bands (likely dominated by stellar or thermal continuum)."
                            : "Ninguna firma molecular o de hielo superó el umbral de ruido de 2σ en las bandas cubiertas actualmente (espectro dominado por continuo estelar o térmico)."}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Species Table */}
              {analysis && (
                <div className="rounded-2xl border border-white/10 overflow-hidden">
                  <div className="px-4 py-2.5 bg-white/[0.04] border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00D2FF]" />
                      {isEn ? "Evaluated Diagnostic Bands" : "Bandas Diagnósticas Evaluadas"}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {analysis.detectedCount} {isEn ? "detected" : "detectadas"} ·{" "}
                      {analysis.marginalCount} {isEn ? "marginal" : "marginales"}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-black/40 text-slate-400 font-mono border-b border-white/10">
                        <tr>
                          <th className="px-3 py-2">{isEn ? "Species" : "Especie"}</th>
                          <th className="px-3 py-2">λ (µm)</th>
                          <th className="px-3 py-2">{isEn ? "Type" : "Tipo"}</th>
                          <th className="px-3 py-2">SNR</th>
                          <th className="px-3 py-2">{isEn ? "Samples" : "Muestras"}</th>
                          <th className="px-3 py-2">{isEn ? "Status" : "Estado"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {analysis.species.map((s) => (
                          <tr key={s.id} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-2">
                              <span className="font-mono font-semibold text-white mr-1.5">
                                {s.formula}
                              </span>
                              <span className="text-slate-400">{isEn ? s.nameEn : s.nameEs}</span>
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-300">
                              {s.centerUm.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {s.kind === "absorption"
                                ? isEn
                                  ? "Absorption"
                                  : "Absorción"
                                : isEn
                                  ? "Emission"
                                  : "Emisión"}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-200">
                              {s.status === "no_coverage" ? "—" : `${s.snr.toFixed(2)}σ`}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-400">
                              {s.pointsInBand} ({s.pointsLeftContinuum}/{s.pointsRightContinuum})
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${statusBadgeClass(
                                  s.status
                                )}`}
                              >
                                {statusLabel(s.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* COMPARE READINGS TAB */
            <div className="space-y-4">
              {comparablePool.length < 2 ? (
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6 text-center space-y-2">
                  <GitCompareArrows className="w-7 h-7 text-[#00D2FF] mx-auto opacity-80" />
                  <p className="text-sm font-medium text-white">
                    {isEn
                      ? "Save at least 2 area readings to compare"
                      : "Guardá al menos 2 lecturas de áreas para comparar"}
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {isEn
                      ? "Select an area on Map 2, wait for processing to finish, save it with a name, then select another region on the same or another image."
                      : "Seleccioná un área en el Mapa 2, esperá a que termine el procesamiento, guardala con un nombre y luego analizá otra región de la misma o de otra imagen."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Selectors for Region A and Region B */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 space-y-1.5">
                      <label className="text-[11px] font-mono text-[#00D2FF] uppercase tracking-wider">
                        {isEn ? "Region A" : "Región A"}
                      </label>
                      <select
                        value={compareIdA}
                        onChange={(e) => setCompareIdA(e.target.value)}
                        className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00D2FF]"
                      >
                      {comparablePool.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                          {r.roi.epochDate ? ` · ${r.roi.epochDate}` : ""} (
                          {r.analysis.coveredChannelsCount}/102 ch)
                        </option>
                      ))}
                      </select>
                    </div>

                    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 space-y-1.5">
                      <label className="text-[11px] font-mono text-emerald-300 uppercase tracking-wider">
                        {isEn ? "Region B" : "Región B"}
                      </label>
                      <select
                        value={compareIdB}
                        onChange={(e) => setCompareIdB(e.target.value)}
                        className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                      >
                      {comparablePool.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                          {r.roi.epochDate ? ` · ${r.roi.epochDate}` : ""} (
                          {r.analysis.coveredChannelsCount}/102 ch)
                        </option>
                      ))}
                      </select>
                    </div>
                  </div>

                  {/* Similarity Result Card */}
                  {readingA?.id === readingB?.id ? (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-4 text-xs text-amber-200">
                      {isEn
                        ? "Select two different readings to compare."
                        : "Seleccioná dos lecturas distintas para comparar."}
                    </div>
                  ) : comparison ? (
                    <div className="rounded-2xl bg-white/[0.04] border border-white/12 p-4 space-y-3">
                      {comparison.insufficientOverlap || comparison.overallSimilarityPct === null ? (
                        <div className="flex items-start gap-2.5 text-xs text-amber-200">
                          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                          <p>
                            {isEn
                              ? `Insufficient overlapping real wavelength channels (${comparison.overlapChannels} found, minimum 4 required) to compute a reliable similarity percentage.`
                              : `Canales infrarrojos reales solapados insuficientes (${comparison.overlapChannels} en común, mínimo 4 requeridos) para calcular un porcentaje de similitud confiable.`}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                                {isEn ? "Overall Similarity" : "Similitud Global"}
                              </span>
                              <div className="text-3xl font-bold font-mono text-white">
                                {comparison.overallSimilarityPct.toFixed(1)}%
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs font-mono">
                              <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/10">
                                <span className="text-slate-400 mr-1.5">
                                  {isEn ? "Spectral:" : "Espectral:"}
                                </span>
                                <span className="text-[#00D2FF] font-semibold">
                                  {comparison.spectralSimilarityPct !== null
                                    ? `${comparison.spectralSimilarityPct.toFixed(1)}%`
                                    : "—"}
                                </span>
                              </div>
                              <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/10">
                                <span className="text-slate-400 mr-1.5">
                                  {isEn ? "Chemical:" : "Química:"}
                                </span>
                                <span className="text-emerald-300 font-semibold">
                                  {comparison.chemicalSimilarityPct !== null
                                    ? `${comparison.chemicalSimilarityPct.toFixed(1)}%`
                                    : "—"}
                                </span>
                              </div>
                              <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/10">
                                <span className="text-slate-400 mr-1.5">
                                  {isEn ? "Overlap:" : "Solapamiento:"}
                                </span>
                                <span className="text-slate-200 font-semibold">
                                  {comparison.overlapChannels} ch
                                </span>
                              </div>
                            </div>
                          </div>

                          <div
                            className={`rounded-xl p-3 text-xs border ${
                              comparison.overallSimilarityPct >= 85
                                ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                                : comparison.overallSimilarityPct >= 60
                                  ? "bg-amber-500/15 border-amber-400/40 text-amber-200"
                                  : "bg-rose-500/15 border-rose-400/40 text-rose-200"
                            }`}
                          >
                            {comparison.overallSimilarityPct >= 85
                              ? isEn
                                ? "High spectral & chemical similarity: compatible with the same celestial body or an analogous physical composition."
                                : "Alta similitud espectral y química: compatible con el mismo cuerpo celeste o una composición física análoga."
                              : comparison.overallSimilarityPct >= 60
                                ? isEn
                                  ? "Moderate similarity: shares partial infrared spectral features, but shows measurable differences."
                                  : "Similitud moderada: comparte rasgos infrarrojos parciales, pero presenta diferencias medibles."
                                : isEn
                                  ? "Low similarity: distinct infrared spectrum and/or chemical composition (unlikely to be the same body)."
                                  : "Baja similitud: espectro infrarrojo y/o composición química distinta (poco probable que sea el mismo cuerpo)."}
                          </div>

                          {comparison.sharedDetectedFormulas.length > 0 && (
                            <div className="text-[11px] text-slate-300 flex flex-wrap items-center gap-1.5">
                              <span className="text-slate-400">
                                {isEn ? "Shared detected species:" : "Especies detectadas en común:"}
                              </span>
                              {comparison.sharedDetectedFormulas.map((f) => (
                                <span
                                  key={f}
                                  className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 font-mono text-emerald-200"
                                >
                                  {f}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : null}
                </>
              )}

              {/* Saved Readings List */}
              {savedReadings.length > 0 && (
                <div className="rounded-2xl border border-white/10 overflow-hidden">
                  <div className="px-4 py-2.5 bg-white/[0.04] border-b border-white/10 text-xs font-semibold text-slate-200">
                    {isEn
                      ? `Saved Readings in Browser (${savedReadings.length})`
                      : `Lecturas Guardadas en el Navegador (${savedReadings.length})`}
                  </div>
                  <div className="divide-y divide-white/5">
                    {savedReadings.map((r) => (
                      <div
                        key={r.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-white/[0.02]"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">{r.name}</div>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            {r.targetName}
                            {r.roi.epochDate ? ` · ${r.roi.epochDate}` : ""} · RA{" "}
                            {formatRAtoHMS(r.roi.centerRa)} · Dec{" "}
                            {formatDectoDMS(r.roi.centerDec)} ·{" "}
                            {r.analysis.coveredChannelsCount}/102 ch
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteSavedReading(r.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 cursor-pointer shrink-0"
                          title={isEn ? "Delete saved reading" : "Eliminar lectura"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
