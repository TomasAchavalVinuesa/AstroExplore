import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Compass,
  Copy,
  Download,
  Eye,
  Flame,
  Gauge,
  HelpCircle,
  Layers,
  Lightbulb,
  Radar,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import type { RenderedCutout, SpherexObservation } from "../../lib/types";
import { useLanguage } from "../../i18n/LanguageContext";
import { OFFICIAL_TARGET_BENCHMARKS } from "./constants";
import { analyzeTemporalAstrophysics } from "./engine";
import type { TemporalAstrophysicsReport } from "./types";

export interface TemporalStatsLabProps {
  observations: SpherexObservation[];
  cachedCutouts?: Map<string, RenderedCutout>;
  selectedObs?: SpherexObservation | null;
  targetName?: string;
  coordinates?: { ra: number; dec: number };
  subtractZodi?: boolean;
  onSelectObservation?: (obs: SpherexObservation) => void;
}

export const TemporalStatsLab: React.FC<TemporalStatsLabProps> = ({
  observations,
  cachedCutouts = new Map(),
  targetName = "WISE 0855",
  coordinates = { ra: 133.79513, dec: -7.24515 },
  subtractZodi = true,
}) => {
  const { language } = useLanguage();
  const isEn = language === "en";

  const [epochAIdx, setEpochAIdx] = useState<number>(0);
  const [epochBIdx, setEpochBIdx] = useState<number>(observations.length > 1 ? 1 : 0);
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string | null>(null);
  const [forceBenchmark, setForceBenchmark] = useState<boolean>(false);
  const [showVectorOverlay, setShowVectorOverlay] = useState<boolean>(true);
  const [showSigmaContours, setShowSigmaContours] = useState<boolean>(true);
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number; z: number } | null>(null);
  const [showThesisModal, setShowThesisModal] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const [copiedTomySnippet, setCopiedTomySnippet] = useState<boolean>(false);

  const zCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (observations.length > 1 && epochBIdx === 0) {
      setEpochBIdx(1);
    }
  }, [observations.length, epochBIdx]);

  const obsA = observations[epochAIdx] ?? null;
  const obsB = observations[epochBIdx] ?? null;

  const cutoutA = useMemo(() => {
    if (!obsA) return null;
    return cachedCutouts.get(`${obsA.obs_id}|${obsA.bandpass}`) ?? cachedCutouts.get(obsA.obs_id) ?? null;
  }, [obsA, cachedCutouts]);

  const cutoutB = useMemo(() => {
    if (!obsB) return null;
    return cachedCutouts.get(`${obsB.obs_id}|${obsB.bandpass}`) ?? cachedCutouts.get(obsB.obs_id) ?? null;
  }, [obsB, cachedCutouts]);

  const activeBenchmark = useMemo(() => {
    if (!selectedBenchmarkId) return null;
    return OFFICIAL_TARGET_BENCHMARKS.find((b) => b.id === selectedBenchmarkId) ?? null;
  }, [selectedBenchmarkId]);

  const effectiveTargetName = activeBenchmark ? activeBenchmark.canonicalName : targetName;
  const effectiveCoords = activeBenchmark
    ? { ra: activeBenchmark.raDeg, dec: activeBenchmark.decDeg }
    : coordinates;

  // Call the single standalone engine function
  const report: TemporalAstrophysicsReport = useMemo(() => {
    return analyzeTemporalAstrophysics({
      observations,
      cachedCutouts,
      epochACutout: cutoutA,
      epochBCutout: cutoutB,
      epochAObs: obsA,
      epochBObs: obsB,
      targetName: effectiveTargetName,
      coordinates: effectiveCoords,
      subtractZodi,
      forceBenchmarkMode: forceBenchmark || Boolean(activeBenchmark),
    });
  }, [
    observations,
    cachedCutouts,
    cutoutA,
    cutoutB,
    obsA,
    obsB,
    effectiveTargetName,
    effectiveCoords,
    subtractZodi,
    forceBenchmark,
    activeBenchmark,
  ]);

  // Render the 2D Standardized Z-Score Matrix (Diverging Coolwarm Palette + Vector Overlay)
  useEffect(() => {
    const canvas = zCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height, zValues, peakPosCoord, peakNegCoord } = report.zScoreMatrix;
    const scale = 4; // Render at 256x256 for crisp vector overlay
    canvas.width = width * scale;
    canvas.height = height * scale;

    // Offscreen pixel buffer at native grid resolution
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    const imgData = offCtx.createImageData(width, height);
    const data = imgData.data;

    for (let i = 0; i < zValues.length; i++) {
      const z = zValues[i];
      // Normalize Z in [-6, +6] to [-1, +1]
      const norm = Math.max(-1, Math.min(1, z / 6.0));
      let r = 18;
      let g = 22;
      let b = 34;

      if (norm > 0.12) {
        // Positive Z (+3σ to +8σ): Warm Coral -> Gold -> White
        const t = (norm - 0.12) / 0.88;
        r = Math.round(30 + 225 * Math.min(1, t * 1.3));
        g = Math.round(25 + 185 * Math.pow(t, 1.5));
        b = Math.round(38 + 90 * Math.pow(t, 2.5));
      } else if (norm < -0.12) {
        // Negative Z (-3σ to -8σ): Deep Cyan -> Electric Blue
        const t = (-norm - 0.12) / 0.88;
        r = Math.round(18 + 30 * Math.pow(t, 2));
        g = Math.round(28 + 165 * Math.pow(t, 1.2));
        b = Math.round(45 + 210 * Math.min(1, t * 1.3));
      } else {
        // Static background (|Z| < 1σ): Neutral dark slate
        const v = Math.round(20 + norm * 25);
        r = v;
        g = v + 3;
        b = v + 10;
      }

      const p = i * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }

    offCtx.putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

    // Subtle WCS coordinate grid lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) {
      const pos = (canvas.width / 4) * g;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(canvas.width, pos);
      ctx.stroke();
    }

    const x1 = (peakNegCoord.x + 0.5) * scale;
    const y1 = (peakNegCoord.y + 0.5) * scale;
    const x2 = (peakPosCoord.x + 0.5) * scale;
    const y2 = (peakPosCoord.y + 0.5) * scale;

    if (showSigmaContours) {
      if (report.output2_hypothesisTest.topology === "DIPOLE_MOTION") {
        // Departure 3σ ring (Cyan)
        ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
        ctx.lineWidth = 1.75;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(x1, y1, 14, 0, Math.PI * 2);
        ctx.stroke();

        // Arrival 5σ ring (Amber/Gold)
        ctx.strokeStyle = "rgba(251, 191, 36, 0.95)";
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(x2, y2, 14, 0, Math.PI * 2);
        ctx.stroke();
      } else if (report.output2_hypothesisTest.topology === "MONOPOLE_VARIABLE") {
        // Single stationary ring
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.strokeStyle = "rgba(192, 132, 252, 0.95)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (showVectorOverlay && report.output2_hypothesisTest.topology === "DIPOLE_MOTION") {
      // Draw Proper Motion Vector Arrow from t1 (-Z) to t2 (+Z)
      ctx.strokeStyle = "#10B981";
      ctx.fillStyle = "#10B981";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = 8;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      // Labels t1 and t2
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#38BDF8";
      ctx.fillText("t₁ (−Z)", Math.max(6, x1 - 18), Math.max(12, y1 - 16));
      ctx.fillStyle = "#FBBF24";
      ctx.fillText("t₂ (+Z)", Math.min(canvas.width - 44, x2 - 14), Math.min(canvas.height - 6, y2 + 24));
    }
  }, [report, showVectorOverlay, showSigmaContours]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = zCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { width, height, zValues } = report.zScoreMatrix;
    const gx = Math.min(width - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * width)));
    const gy = Math.min(height - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * height)));
    const z = zValues[gy * width + gx] ?? 0;
    setHoverPixel({ x: gx, y: gy, z: Number(z.toFixed(2)) });
  };

  const humanConclusions = isEn ? report.humanConclusionsEn : report.humanConclusionsEs;
  const thesisMarkdown = isEn ? report.academicThesisMarkdownEn : report.academicThesisMarkdownEs;

  const handleCopyReport = () => {
    navigator.clipboard.writeText(thesisMarkdown);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  const handleCopyTomyFunction = () => {
    const snippet = `import { computeJoakoStatisticalThermodynamics, analyzeTemporalAstrophysics } from "../features/statistics";\n\nconst joako = computeJoakoStatisticalThermodynamics({ observations, cachedCutouts: cachedCutoutsMap, targetName, coordinates: lastCoords });`;
    navigator.clipboard.writeText(snippet);
    setCopiedTomySnippet(true);
    setTimeout(() => setCopiedTomySnippet(false), 2500);
  };

  const handleDownloadReport = () => {
    const blob = new Blob([thesisMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CHRONO_SPHEREx_PyE_Report_${report.targetName.replace(/[^a-zA-Z0-9]+/g, "_")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isDipole = report.output2_hypothesisTest.topology === "DIPOLE_MOTION";
  const isMonopole = report.output2_hypothesisTest.topology === "MONOPOLE_VARIABLE";

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 bg-slate-950/85 backdrop-blur-xl border border-slate-800/90 rounded-2xl text-slate-100 shadow-2xl">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Radar className="w-5 h-5" />
            </span>
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
              {isEn
                ? "Multi-Epoch Pattern & Statistical Inference Lab (PyE)"
                : "Laboratorio de Patrones Temporales e Inferencia Estadística (PyE)"}
            </h3>
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-semibold border ${
                report.dataSourceMode === "LIVE_IRSA_FITS_CUTOUTS"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
              }`}
            >
              {report.dataSourceMode === "LIVE_IRSA_FITS_CUTOUTS"
                ? isEn
                  ? "LIVE IRSA FITS MATRIX"
                  : "MATRIZ FITS IRSA EN VIVO"
                : isEn
                ? "[OFFLINE/CACHED] Verified IRSA & Gaia DR3 Mirror"
                : "[OFFLINE/CACHED] Espejo Verificado IRSA & Gaia DR3"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isEn
              ? "Detects temporal changes across SPHEREx epochs (Dipole motion vs. Monopole variability) using Jay Devore's hypothesis testing & translates conclusions into everyday analogies."
              : "Detecta patrones entre épocas de SPHEREx (Dipolo en movimiento vs. Monopolo variable) con pruebas de hipótesis de Jay Devore y traduce los datos a tierra."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setForceBenchmark((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
              forceBenchmark || !cutoutA || !cutoutB
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : "bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {forceBenchmark || !cutoutA || !cutoutB
                ? isEn
                  ? "Calibrated Benchmark"
                  : "Benchmark Calibrado"
                : isEn
                ? "Live Cutout Pair"
                : "Par FITS en Vivo"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleCopyTomyFunction}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5"
            title={
              isEn
                ? "Copy 1-line standalone function call for Tomy's main block"
                : "Copiar llamada a la función en 1 línea para el código principal de Tomy"
            }
          >
            <Copy className="w-3.5 h-3.5" />
            <span>
              {copiedTomySnippet
                ? isEn
                  ? "Copied for Tomy!"
                  : "¡Función Copiada!"
                : isEn
                ? "Copy Function (Tomy)"
                : "Copiar Función (Tomy)"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowThesisModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isEn ? "PyE Thesis Report (.md)" : "Informe PyE / Tesis (.md)"}</span>
          </button>
        </div>
      </div>

      {/* Benchmark Target Quick-Switcher (5 Mandatory NASA Targets + Planet X) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-slate-300">
            {isEn
              ? "Official NASA Challenge Targets (Compare Dipole vs. Monopole):"
              : "Objetivos Oficiales del Reto NASA (Comparar Dipolo vs. Monopolo):"}
          </span>
          {selectedBenchmarkId && (
            <button
              type="button"
              onClick={() => setSelectedBenchmarkId(null)}
              className="text-cyan-400 hover:underline cursor-pointer"
            >
              {isEn ? "Reset to Current Viewer Target" : "Volver al Astro Actual del Visor"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {OFFICIAL_TARGET_BENCHMARKS.map((b) => {
            const isActive = report.targetName === b.canonicalName;
            const isDip = b.topology === "DIPOLE_MOTION";
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBenchmarkId(b.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? isDip
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-sm"
                      : "bg-purple-500/20 border-purple-400 text-purple-200 shadow-sm"
                    : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isDip ? "bg-emerald-400" : "bg-purple-400"
                  }`}
                />
                <span>{b.canonicalName.split(" (")[0]}</span>
                <span className="text-[9px] font-mono opacity-75">
                  {isDip ? (isEn ? "[Dipole]" : "[Dipolo]") : isEn ? "[Monopole]" : "[Monopolo]"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Headline Verdict Banner */}
      <div
        className={`rounded-xl p-3.5 border flex flex-col gap-1.5 ${
          isDipole
            ? "bg-emerald-950/35 border-emerald-500/40 text-emerald-100"
            : isMonopole
            ? "bg-purple-950/35 border-purple-500/40 text-purple-100"
            : "bg-slate-900/70 border-slate-700 text-slate-200"
        }`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs sm:text-sm font-bold tracking-wide">
            {humanConclusions.headlineVerdict}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-black/40 border border-white/15">
            |Z|_max = {report.output2_hypothesisTest.maxAbsZScore}σ ·{" "}
            {isEn ? "Confidence" : "Confianza"}: {report.output2_hypothesisTest.confidencePercentage}%
          </span>
        </div>
        <p className="text-xs text-slate-200/90 leading-relaxed">
          {humanConclusions.whatChangedSummary}
        </p>
      </div>

      {/* Main Split Grid: Left = 2D Z-Score Difference Map, Right = PyE Hypothesis Test & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column (5 cols): 2D Standardized Z-Score Heatmap */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {isEn
                    ? "Standardized Z-Score Matrix Z(x,y)"
                    : "Mapa de Significancia Z-Score Z(x,y)"}
                </span>
              </h4>
              <p className="text-[10px] text-slate-400">
                Z(x,y) = [I(t₂) − I(t₁) − μ_D] / √(σ₁² + σ₂²)
              </p>
            </div>
            {hoverPixel && (
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-cyan-300">
                ({hoverPixel.x},{hoverPixel.y}) Z={hoverPixel.z > 0 ? `+${hoverPixel.z}` : hoverPixel.z}σ
              </span>
            )}
          </div>

          <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-xl overflow-hidden border border-slate-700/80 bg-black shadow-inner">
            <canvas
              ref={zCanvasRef}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => setHoverPixel(null)}
              className="w-full h-full object-contain cursor-crosshair"
            />
          </div>

          {/* Colorbar & Overlay Toggles */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="text-sky-400">−6σ ({isEn ? "Departed t₁" : "Salió en t₁"})</span>
              <span className="text-slate-400">0σ (H₀)</span>
              <span className="text-amber-300">+6σ ({isEn ? "Arrived t₂" : "Llegó en t₂"})</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gradient-to-r from-sky-400 via-slate-800 to-amber-400 border border-white/10" />

            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVectorOverlay}
                  onChange={(e) => setShowVectorOverlay(e.target.checked)}
                  className="accent-emerald-400"
                />
                <span>{isEn ? "Proper Motion Vector (μ)" : "Vector Movimiento (μ)"}</span>
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSigmaContours}
                  onChange={(e) => setShowSigmaContours(e.target.checked)}
                  className="accent-amber-400"
                />
                <span>{isEn ? "3σ / 5σ Contours" : "Anillos 3σ / 5σ"}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Formal PyE Hypothesis Test + Down-to-Earth Analogies */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Epoch Pickers if multiple observations exist */}
          {observations.length >= 2 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-400 font-medium">
                {isEn ? "Compare Live Epochs:" : "Comparar Épocas en Vivo:"}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={epochAIdx}
                  onChange={(e) => setEpochAIdx(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 font-mono"
                >
                  {observations.map((o, i) => (
                    <option key={`ea-${o.obs_id}-${i}`} value={i}>
                      t₁: #{i + 1} {o.epoch_date ?? o.obs_id.slice(-8)} ({o.bandpass})
                    </option>
                  ))}
                </select>
                <span className="text-slate-500">→</span>
                <select
                  value={epochBIdx}
                  onChange={(e) => setEpochBIdx(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 font-mono"
                >
                  {observations.map((o, i) => (
                    <option key={`eb-${o.obs_id}-${i}`} value={i}>
                      t₂: #{i + 1} {o.epoch_date ?? o.obs_id.slice(-8)} ({o.bandpass})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Card 1: Formal PyE Hypothesis Testing (Jay Devore Cap. 8) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? "1. Hypothesis Test & SNR Coaddition (Jay Devore, Ch. 5, 6 & 8)"
                    : "1. Prueba de Hipótesis y Co-adición SNR (Jay Devore, Caps. 5, 6 y 8)"}
                </span>
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                p = {report.output2_hypothesisTest.twoTailedPValue.toExponential(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-2">
                <div className="text-[10px] text-slate-400">
                  {isEn ? "Peak Arrival (+Z)" : "Pico Llegada (+Z)"}
                </div>
                <div className="text-sm font-mono font-bold text-amber-300">
                  +{report.output2_hypothesisTest.peakPositiveZ}σ
                </div>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-2">
                <div className="text-[10px] text-slate-400">
                  {isEn ? "Peak Departure (−Z)" : "Hueco Salida (−Z)"}
                </div>
                <div className="text-sm font-mono font-bold text-sky-400">
                  {report.output2_hypothesisTest.peakNegativeZ}σ
                </div>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-2">
                <div className="text-[10px] text-slate-400">
                  {isEn ? "17-Band SNR Coadd" : "SNR Co-adición (17b)"}
                </div>
                <div className="text-sm font-mono font-bold text-emerald-400">
                  {report.output1_coaddition.coaddedSnr}σ (×4.12)
                </div>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-2">
                <div className="text-[10px] text-slate-400">
                  {isEn ? "Pattern Topology" : "Topología Detectada"}
                </div>
                <div className="text-xs font-mono font-bold text-white truncate">
                  {isDipole
                    ? isEn
                      ? "DIPOLE (Motion)"
                      : "DIPOLO (Móvil)"
                    : isMonopole
                    ? isEn
                      ? "MONOPOLE (Variable)"
                      : "MONOPOLO (Variable)"
                    : "STATIC (H₀)"}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
              <strong className="text-cyan-300">
                {isEn ? "Plain-Language PyE (Coin-Flip Analogy): " : "En Criollo (Analogía de la Moneda): "}
              </strong>
              {humanConclusions.statisticalCertaintyPlain}
            </p>
          </div>

          {/* Card 2: Down-to-Earth Kinematics & "Electricity Bill" Thermodynamics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5">
              <h5 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? "2. Motion Across the Sky (Kinematics)"
                    : "2. Movimiento en el Cielo (Cinemática)"}
                </span>
              </h5>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 bg-slate-950/70 px-2.5 py-1 rounded border border-slate-800">
                <span>μ = {report.output3_properMotion.muTotalArcsecYr}&quot;/yr</span>
                <span>θ = {report.output3_properMotion.positionAngleDeg}°</span>
                <span>d = {report.output4_parallaxDistance.distanceLightYears ?? "?"} ly</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                {humanConclusions.motionPlainAnalogy}
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5">
              <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? '3. "Electricity Bill" Thermal Analogy'
                    : '3. Analogía de la "Factura de Luz"'}
                </span>
              </h5>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 bg-slate-950/70 px-2.5 py-1 rounded border border-slate-800">
                <span>T = {report.output5_thermodynamics.effectiveTempCelsius} °C</span>
                <span>E_b = {report.output5_thermodynamics.blackbodyEmittanceWm2} W/m²</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                {humanConclusions.thermalBillAnalogy}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECTOR A — JOAQUÍN: DEEP STATISTICAL INFERENCE & THERMODYNAMICS LAB   */}
      {/* (Jay Devore Caps. 5–8 + Yunus A. Çengel 7th Ed. Cap. 12)              */}
      {/* ===================================================================== */}
      <div className="bg-slate-900/55 border border-amber-500/25 rounded-xl p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Flame className="w-4 h-4" />
            </span>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">
                {isEn
                  ? "Sector A (Joaquín): Minimum-Variance Statistics (Devore) & Radiative Thermodynamics (Çengel)"
                  : "Sector A (Joaquín): Estadística de Varianza Mínima (Devore) y Termodinámica Radiativa (Çengel)"}
              </h4>
              <p className="text-[10px] text-slate-400 font-mono">
                computeJoakoStatisticalThermodynamics() · MVUE 95%/99% CI · Power (1 − β) · Planck E_b,λ(λ,T) · Wien &amp; Stefan-Boltzmann
              </p>
            </div>
          </div>

          {/* Semáforo Térmico Badge from Obsidian Vault */}
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
              report.output5_thermodynamics.thermalTrafficLight === "PLANET_X_COLD_WORLD_ALERT"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                : report.output5_thermodynamics.thermalTrafficLight === "COOL_SUBSET_BROWN_DWARF"
                ? "bg-amber-500/20 text-amber-300 border-amber-400/50"
                : "bg-sky-500/20 text-sky-300 border-sky-400/50"
            }`}
          >
            {isEn
              ? report.joakoModule.humanSummaryEn.trafficLightBadge
              : report.joakoModule.humanSummaryEs.trafficLightBadge}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Left Sub-Panel: 17-Band SNR Coaddition Progression & MVUE Intervals (Jay Devore) */}
          <div className="bg-slate-950/75 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? "MVUE 17-Band SNR Co-addition Curve (Devore Ch. 5–8)"
                    : "Curva de Co-adición SNR en N=17 Bandas (Devore Caps. 5–8)"}
                </span>
              </span>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                1 − β = {report.output1_coaddition.coaddedStatisticalPower}%
              </span>
            </div>

            {/* Interactive SVG Chart of SNR(n) = sqrt(n) * SNR_1 for n = 1..17 */}
            <div className="w-full h-32 bg-slate-900/70 rounded-lg border border-slate-800/80 p-2 relative">
              <svg viewBox="0 0 320 100" className="w-full h-full overflow-visible">
                {/* 5-sigma Gold Standard Discovery Threshold Line */}
                {(() => {
                  const maxSnr = Math.max(10, report.output1_coaddition.coaddedSnr * 1.1);
                  const y5Sigma = 88 - (5.0 / maxSnr) * 74;
                  const pointsStr = report.output1_coaddition.progressionCurve
                    .map((pt) => {
                      const x = 24 + ((pt.bandCount - 1) / 16) * 284;
                      const y = 88 - (pt.cumulativeSnr / maxSnr) * 74;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(" ");

                  return (
                    <>
                      {y5Sigma >= 10 && y5Sigma <= 88 && (
                        <g>
                          <line
                            x1="24"
                            y1={y5Sigma}
                            x2="308"
                            y2={y5Sigma}
                            stroke="#F59E0B"
                            strokeWidth="1"
                            strokeDasharray="3,3"
                          />
                          <text x="26" y={y5Sigma - 3} fill="#FBBF24" fontSize="7.5" fontFamily="monospace">
                            5.0σ {isEn ? "Discovery Threshold" : "Umbral Descubrimiento (5σ)"}
                          </text>
                        </g>
                      )}
                      <polyline
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.2"
                        points={pointsStr}
                      />
                      {report.output1_coaddition.progressionCurve.map((pt) => {
                        const x = 24 + ((pt.bandCount - 1) / 16) * 284;
                        const y = 88 - (pt.cumulativeSnr / maxSnr) * 74;
                        return (
                          <circle
                            key={pt.bandCount}
                            cx={x}
                            cy={y}
                            r={pt.bandCount === 1 || pt.bandCount === 17 ? 3.2 : 1.8}
                            fill={pt.detectionUnlocked ? "#10B981" : "#38BDF8"}
                          />
                        );
                      })}
                      <text x="24" y="97" fill="#94A3B8" fontSize="7.5" fontFamily="monospace">
                        n=1 ({report.output1_coaddition.singleBandMeanSnr}σ)
                      </text>
                      <text x="225" y="97" fill="#34D399" fontSize="7.5" fontFamily="monospace">
                        n=17 ({report.output1_coaddition.coaddedSnr}σ, ×4.12)
                      </text>
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* MVUE Confidence Intervals */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
              <div className="bg-slate-900/90 border border-slate-800 rounded p-1.5">
                <div className="text-slate-400">{isEn ? "MVUE Flux" : "Flujo MVUE"}</div>
                <div className="text-white font-bold">
                  {report.output1_coaddition.mvueCoaddedFluxMjySr}±{report.output1_coaddition.mvueStandardErrorMjySr}
                </div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded p-1.5">
                <div className="text-slate-400">IC 95% (Devore)</div>
                <div className="text-emerald-300 font-bold">
                  [{report.output1_coaddition.ci95LowerMjySr}, {report.output1_coaddition.ci95UpperMjySr}]
                </div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded p-1.5">
                <div className="text-slate-400">IC 99% (Devore)</div>
                <div className="text-cyan-300 font-bold">
                  [{report.output1_coaddition.ci99LowerMjySr}, {report.output1_coaddition.ci99UpperMjySr}]
                </div>
              </div>
            </div>
          </div>

          {/* Right Sub-Panel: Planck Curve & Çengel Band Radiation Fractions F_(D1..D6) */}
          <div className="bg-slate-950/75 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? "Planck Blackbody & Çengel Band Fractions (D1–D6)"
                    : "Curva de Planck y Fracción Radiativa por Detector (Çengel Cap. 12)"}
                </span>
              </span>
              <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                T_eff = {report.output5_thermodynamics.effectiveTempKelvin} K ({report.output5_thermodynamics.effectiveTempCelsius} °C)
              </span>
            </div>

            {/* Interactive SVG Planck Spectral Curve + Detector Fractional Bars */}
            <div className="w-full h-32 bg-slate-900/70 rounded-lg border border-slate-800/80 p-2 relative">
              <svg viewBox="0 0 320 100" className="w-full h-full overflow-visible">
                {(() => {
                  const samples = report.output5_thermodynamics.planckCurveSamples;
                  const pts = samples
                    .map((s) => {
                      const x = 20 + ((s.wavelengthUm - 0.75) / (5.0 - 0.75)) * 288;
                      const y = 84 - s.normalizedIntensity * 68;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(" ");

                  const peakWave = Math.max(0.75, Math.min(5.0, report.output5_thermodynamics.peakWavelengthUm));
                  const peakX = 20 + ((peakWave - 0.75) / (5.0 - 0.75)) * 288;

                  return (
                    <>
                      {/* Detector Passband Fractional Bars in Background */}
                      {report.output5_thermodynamics.detectorFractions.map((df, i) => {
                        const xStart = 20 + ((df.waveRangeUm[0] - 0.75) / (5.0 - 0.75)) * 288;
                        const xEnd = 20 + ((df.waveRangeUm[1] - 0.75) / (5.0 - 0.75)) * 288;
                        const barH = Math.max(3, (df.fractionOfSpherexTotalPct / 100) * 68);
                        const colors = ["#38BDF8", "#22D3EE", "#34D399", "#A855F7", "#F59E0B", "#FB7185"];
                        return (
                          <g key={df.detectorId}>
                            <rect
                              x={xStart}
                              y={84 - barH}
                              width={Math.max(4, xEnd - xStart - 2)}
                              height={barH}
                              fill={colors[i]}
                              fillOpacity="0.22"
                              stroke={colors[i]}
                              strokeOpacity="0.45"
                              strokeWidth="0.75"
                            />
                            <text
                              x={(xStart + xEnd) / 2 - 6}
                              y="96"
                              fill={colors[i]}
                              fontSize="7"
                              fontFamily="monospace"
                            >
                              {df.detectorId}:{df.fractionOfSpherexTotalPct}%
                            </text>
                          </g>
                        );
                      })}

                      {/* Planck Curve E_b,lambda */}
                      <polyline fill="none" stroke="#FBBF24" strokeWidth="2.2" points={pts} />

                      {/* Wien Peak Marker */}
                      <line
                        x1={peakX}
                        y1="14"
                        x2={peakX}
                        y2="84"
                        stroke="#FB7185"
                        strokeWidth="1.2"
                        strokeDasharray="3,2"
                      />
                      <text
                        x={Math.min(230, Math.max(22, peakX - 28))}
                        y="12"
                        fill="#FDA4AF"
                        fontSize="7.5"
                        fontFamily="monospace"
                      >
                        λ_max={report.output5_thermodynamics.peakWavelengthUm}µm (Wien)
                      </text>
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Thermodynamic Metrics Row */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
              <div className="bg-slate-900/90 border border-slate-800 rounded p-1.5">
                <div className="text-slate-400">Stefan-Boltzmann E_b</div>
                <div className="text-amber-300 font-bold">
                  {report.output5_thermodynamics.blackbodyEmittanceWm2} W/m²
                </div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded p-1.5">
                <div className="text-slate-400">Color_IR (D6/D1)</div>
                <div className="text-rose-300 font-bold">
                  {report.output5_thermodynamics.spherexColorIndexD6D1 > 0
                    ? `+${report.output5_thermodynamics.spherexColorIndexD6D1}`
                    : report.output5_thermodynamics.spherexColorIndexD6D1}{" "}
                  ({report.output5_thermodynamics.fluxRatioD6OverD1}×)
                </div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded p-1.5">
                <div className="text-slate-400">{isEn ? "Photon Energy" : "Energía Fotón"}</div>
                <div className="text-purple-300 font-bold">
                  {report.output5_thermodynamics.meanPhotonEnergyEv} eV
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Consolidated 6 Quantitative Outputs Matrix (From Obsidian 06_Biblioteca_Facultad_Conexiones.md) */}
      <div className="bg-slate-900/50 border border-slate-800/90 rounded-xl p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>
              {isEn
                ? "The 6 Quantitative System Outputs (University Textbook Formulations)"
                : "Matriz Consolidada de las 6 Salidas Físico-Matemáticas y Estadísticas (Libros de Facultad)"}
            </span>
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">
            Devore · Kreyszig · Sears-Zemansky · Çengel · Chang
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          {/* Output 1 */}
          <div className="bg-slate-950/75 border border-slate-800/80 rounded-lg p-2.5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400">
                {isEn ? "Output 1: SNR Coaddition" : "Salida 1: Ganancia SNR Co-add"}
              </span>
              <span className="text-[10px] font-mono text-slate-400">Joaquín · Devore</span>
            </div>
            <div className="font-mono text-sm text-white font-bold">
              SNR_coadd = {report.output1_coaddition.coaddedSnr}σ (+312.3%)
            </div>
            <div className="text-[10px] text-slate-400">
              {isEn
                ? `Combines N=17 bands per detector (√17 ≈ 4.123× single-band SNR of ${report.output1_coaddition.singleBandMeanSnr}σ).`
                : `Suma ponderada de varianza mínima en N=17 bandas (√17 ≈ 4.123× sobre SNR base de ${report.output1_coaddition.singleBandMeanSnr}σ).`}
            </div>
          </div>

          {/* Output 2 */}
          <div className="bg-slate-950/75 border border-slate-800/80 rounded-lg p-2.5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-400">
                {isEn ? "Output 2: Difference Z-Score" : "Salida 2: Z-Score y Topología"}
              </span>
              <span className="text-[10px] font-mono text-slate-400">Jonás · Devore/Kreyszig</span>
            </div>
            <div className="font-mono text-sm text-white font-bold">
              +{report.output2_hypothesisTest.peakPositiveZ}σ / {report.output2_hypothesisTest.peakNegativeZ}σ
            </div>
            <div className="text-[10px] text-slate-400">
              {isEn
                ? `Pattern: ${report.output2_hypothesisTest.topology} (Flags masked: ${report.output2_hypothesisTest.contaminatedPixelsMasked} px).`
                : `Patrón: ${report.output2_hypothesisTest.topology} (Rayos cósmicos filtrados: ${report.output2_hypothesisTest.contaminatedPixelsMasked} px).`}
            </div>
          </div>

          {/* Output 3 */}
          <div className="bg-slate-950/75 border border-slate-800/80 rounded-lg p-2.5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">
                {isEn ? "Output 3: Proper Motion (μ, θ)" : "Salida 3: Vector Movimiento (μ, θ)"}
              </span>
              <span className="text-[10px] font-mono text-slate-400">Jeremías · Sears Vol.1</span>
            </div>
            <div className="font-mono text-sm text-white font-bold">
              {report.output3_properMotion.muTotalArcsecYr}&quot;/yr ({report.output3_properMotion.positionAngleDeg}° E of N)
            </div>
            <div className="text-[10px] text-slate-400">
              Δα* = {report.output3_properMotion.deltaRaArcsec}&quot;, Δδ = {report.output3_properMotion.deltaDecArcsec}&quot; (Δt = {report.output3_properMotion.deltaTimeYears} yr)
            </div>
          </div>

          {/* Output 4 */}
          <div className="bg-slate-950/75 border border-slate-800/80 rounded-lg p-2.5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-400">
                {isEn ? "Output 4: Parallax & Velocity" : "Salida 4: Paralaje y Distancia"}
              </span>
              <span className="text-[10px] font-mono text-slate-400">Jeremías · Serway</span>
            </div>
            <div className="font-mono text-sm text-white font-bold">
              d = {report.output4_parallaxDistance.distanceLightYears ?? "N/A"} ly · v_t = {report.output4_parallaxDistance.tangentialVelocityKmS ?? "N/A"} km/s
            </div>
            <div className="text-[10px] text-slate-400">
              p = {report.output4_parallaxDistance.parallaxMas} mas ({report.output4_parallaxDistance.distanceParsecs} pc, Base B = 2 AU)
            </div>
          </div>

          {/* Output 5 */}
          <div className="bg-slate-950/75 border border-slate-800/80 rounded-lg p-2.5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-400">
                {isEn ? "Output 5: Wien & Stefan-Boltzmann" : "Salida 5: Termodinámica Radiativa"}
              </span>
              <span className="text-[10px] font-mono text-slate-400">Joaquín · Çengel 7ed</span>
            </div>
            <div className="font-mono text-sm text-white font-bold">
              {report.output5_thermodynamics.effectiveTempKelvin} K ({report.output5_thermodynamics.effectiveTempCelsius} °C)
            </div>
            <div className="text-[10px] text-slate-400">
              λ_max = {report.output5_thermodynamics.peakWavelengthUm} µm · Color_IR(D6/D1) = {report.output5_thermodynamics.spherexColorIndexD6D1 > 0 ? `+${report.output5_thermodynamics.spherexColorIndexD6D1}` : report.output5_thermodynamics.spherexColorIndexD6D1}
            </div>
          </div>

          {/* Output 6 */}
          <div className="bg-slate-950/75 border border-slate-800/80 rounded-lg p-2.5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-400">
                {isEn ? "Output 6: NIR Molecular Fingerprints" : "Salida 6: Huella Química 102 Bandas"}
              </span>
              <span className="text-[10px] font-mono text-slate-400">Jonás · Chang 11ed</span>
            </div>
            <div className="font-mono text-xs text-white font-semibold truncate">
              {report.output6_dominantMolecules[0]}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {report.output6_dominantMolecules.slice(1).join(" · ")}
            </div>
          </div>
        </div>

        {/* Student Takeaway Footer */}
        <div className="mt-1 px-3 py-2 rounded-lg bg-emerald-950/25 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{humanConclusions.studentTakeaway}</span>
        </div>
      </div>

      {/* Thesis Markdown Report Modal */}
      {showThesisModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">
                  {isEn
                    ? "Academic Case Study & Statistical Hypothesis Report (APA 7th Ed.)"
                    : "Informe de Caso de Estudio e Inferencia Estadística PyE (APA 7.ª Ed.)"}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedToast ? (isEn ? "Copied!" : "¡Copiado!") : isEn ? "Copy .md" : "Copiar .md"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isEn ? "Download .md" : "Descargar .md"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowThesisModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {thesisMarkdown}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

