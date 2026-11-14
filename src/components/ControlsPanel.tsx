import React, { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Layers,
  Loader2,
  Sliders,
  Sparkles,
} from "lucide-react";
import type {
  CollectionQueryMode,
  ColormapName,
  ResolvedCelestialObject,
  StretchMode,
  TargetPreset,
} from "../lib/types";
import { parseDec, parseRA } from "../lib/coordinates";
import { useLanguage } from "../i18n/LanguageContext";

export interface MoleculeSignature {
  id: "h2o" | "co2" | "co" | "ch3oh" | "ch4" | "nh3" | "pahs";
  color: string;
  band: string;
  wavelengthUm: number;
}

export const MOLECULE_SIGNATURES: MoleculeSignature[] = [
  { id: "h2o", color: "#38BDF8", band: "D4", wavelengthUm: 3.05 },
  { id: "co2", color: "#A78BFA", band: "D5", wavelengthUm: 4.25 },
  { id: "co", color: "#FB923C", band: "D6", wavelengthUm: 4.67 },
  { id: "ch3oh", color: "#F472B6", band: "D4", wavelengthUm: 3.53 },
  { id: "ch4", color: "#34D399", band: "D4", wavelengthUm: 3.32 },
  { id: "nh3", color: "#FFB703", band: "D4", wavelengthUm: 2.96 },
  { id: "pahs", color: "#00D2FF", band: "D4", wavelengthUm: 3.29 },
];

interface ControlsPanelProps {
  raInput: string;
  setRaInput: (val: string) => void;
  decInput: string;
  setDecInput: (val: string) => void;
  collectionMode: CollectionQueryMode;
  setCollectionMode: (val: CollectionQueryMode) => void;
  band: string;
  setBand: (val: string) => void;
  radius: string;
  setRadius: (val: string) => void;
  size: string;
  setSize: (val: string) => void;
  stretch: StretchMode;
  setStretch: (val: StretchMode) => void;
  colormap: ColormapName;
  setColormap: (val: ColormapName) => void;
  subtractZodi: boolean;
  setSubtractZodi: (val: boolean) => void;
  showCrosshair: boolean;
  setShowCrosshair: (val: boolean) => void;
  loading: boolean;
  resolvingName: boolean;
  resolvedObject: ResolvedCelestialObject | null;
  activePresetId: string | null;
  totalFound?: number;
  activeMolecules?: Set<string>;
  onToggleMolecule?: (mol: MoleculeSignature) => void;
  onBackToEntry?: () => void;
  onChangeFov?: (newSize: number) => void;
  onSubmitCoords?: (raStr: string, decStr: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSelectPreset: (preset: TargetPreset) => void;
  onSearchCelestialName: (name: string) => void;
  onOpenExposuresDrawer?: () => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  raInput,
  setRaInput,
  decInput,
  setDecInput,
  band,
  setBand,
  size,
  setSize,
  stretch,
  setStretch,
  colormap,
  setColormap,
  subtractZodi,
  setSubtractZodi,
  showCrosshair,
  setShowCrosshair,
  loading,
  resolvingName,
  resolvedObject,
  activePresetId,
  totalFound = 0,
  activeMolecules: externalMolecules,
  onToggleMolecule,
  onBackToEntry,
  onChangeFov,
  onSubmitCoords,
  onSubmit,
  onSelectPreset,
  onSearchCelestialName,
  onOpenExposuresDrawer,
}) => {
  const { t } = useLanguage();
  const [nameQuery, setNameQuery] = useState("");
  const [combinedCoords, setCombinedCoords] = useState(`${raInput}, ${decInput}`);
  const [localMolecules, setLocalMolecules] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeMolecules = externalMolecules ?? localMolecules;

  useEffect(() => {
    setCombinedCoords(`${raInput}, ${decInput}`);
  }, [raInput, decInput]);

  const handleCoordSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = combinedCoords.trim();
    if (!raw) return;

    let parsedRaStr = raInput;
    let parsedDecStr = decInput;

    if (raw.includes(",")) {
      const [left, right] = raw.split(",").map((s) => s.trim());
      if (left && right) {
        const raVal = parseRA(left);
        const decVal = parseDec(right);
        if (raVal !== null && decVal !== null) {
          parsedRaStr = left;
          parsedDecStr = right;
        } else {
          const nums = raw.match(/-?\d+(\.\d+)?/g);
          if (nums && nums.length >= 6) {
            const ra =
              (parseFloat(nums[0]) + parseFloat(nums[1]) / 60 + parseFloat(nums[2]) / 3600) * 15;
            const sign = right.includes("-") ? -1 : 1;
            const dec =
              sign *
              (Math.abs(parseFloat(nums[3])) +
                parseFloat(nums[4]) / 60 +
                parseFloat(nums[5]) / 3600);
            parsedRaStr = ra.toFixed(5);
            parsedDecStr = dec.toFixed(5);
          } else if (nums && nums.length >= 2) {
            parsedRaStr = nums[0];
            parsedDecStr = nums[1];
          }
        }
      }
    } else {
      const nums = raw.match(/-?\d+(\.\d+)?/g);
      if (nums && nums.length >= 6) {
        const ra =
          (parseFloat(nums[0]) + parseFloat(nums[1]) / 60 + parseFloat(nums[2]) / 3600) * 15;
        const sign = raw.includes("-") ? -1 : 1;
        const dec =
          sign *
          (Math.abs(parseFloat(nums[3])) +
            parseFloat(nums[4]) / 60 +
            parseFloat(nums[5]) / 3600);
        parsedRaStr = ra.toFixed(5);
        parsedDecStr = dec.toFixed(5);
      } else if (nums && nums.length >= 2) {
        parsedRaStr = nums[0];
        parsedDecStr = nums[1];
      }
    }

    setRaInput(parsedRaStr);
    setDecInput(parsedDecStr);

    if (onSubmitCoords) {
      onSubmitCoords(parsedRaStr, parsedDecStr);
    } else {
      onSubmit(e);
    }
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameQuery.trim()) return;
    onSearchCelestialName(nameQuery.trim());
  };

  const handleMoleculeClick = (mol: MoleculeSignature) => {
    if (onToggleMolecule) {
      onToggleMolecule(mol);
    } else {
      setLocalMolecules((prev) => {
        const next = new Set(prev);
        if (next.has(mol.id)) next.delete(mol.id);
        else next.add(mol.id);
        return next;
      });
    }
  };

  const numericSize = Math.min(0.5, Math.max(0.05, Number(size) || 0.12));

  return (
    <aside className="glass-panel rounded-[22px] w-full lg:w-[310px] shrink-0 p-5 flex flex-col justify-between gap-4 overflow-y-auto max-h-full">
      <div className="space-y-4">
        {/* Back to Entry */}
        {onBackToEntry && (
          <button
            type="button"
            onClick={onBackToEntry}
            className="btn-press inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            <span>←</span>
            <span>{t.chrono.backButton}</span>
          </button>
        )}

        {/* Search by Coordinates */}
        <form onSubmit={handleCoordSearch} className="space-y-1.5">
          <label htmlFor="input-coords" className="block text-xs font-medium text-slate-300">
            {t.chrono.searchByCoords}
          </label>
          <div className="flex gap-2">
            <input
              id="input-coords"
              type="text"
              value={combinedCoords}
              onChange={(e) => setCombinedCoords(e.target.value)}
              placeholder={t.chrono.coordsInputPlaceholder}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00D2FF]/70 font-mono"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-press shrink-0 px-3 py-2 rounded-xl bg-white/10 hover:bg-[#00D2FF]/20 border border-white/10 hover:border-[#00D2FF]/50 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.chrono.goButton}
            </button>
          </div>
        </form>

        {/* Search by Name */}
        <div className="space-y-2">
          <form onSubmit={handleNameSubmit} className="space-y-1.5">
            <label htmlFor="input-name" className="block text-xs font-medium text-slate-300">
              {t.chrono.searchByName}
            </label>
            <div className="flex gap-2">
              <input
                id="input-name"
                type="text"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder={t.chrono.nameInputPlaceholder}
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00D2FF]/70"
              />
              <button
                type="submit"
                disabled={resolvingName || loading || !nameQuery.trim()}
                className="btn-press shrink-0 px-3 py-2 rounded-xl bg-white/10 hover:bg-[#00D2FF]/20 border border-white/10 hover:border-[#00D2FF]/50 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
              >
                {resolvingName ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  t.chrono.searchButton
                )}
              </button>
            </div>
          </form>

          {/* Featured Preset Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {t.presets.slice(0, 5).map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setNameQuery(preset.queryName);
                    onSelectPreset(preset);
                  }}
                  title={preset.description}
                  className={`btn-press px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? "bg-[#00D2FF]/15 border-[#00D2FF]/65 text-white shadow-[0_0_12px_rgba(0,210,255,0.2)]"
                      : "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <Sparkles className="w-2.5 h-2.5 text-[#00D2FF] shrink-0" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>

          {resolvedObject && (
            <div className="rounded-xl bg-[#00D2FF]/[0.07] border border-[#00D2FF]/30 px-3 py-2 text-[11px] flex items-center justify-between gap-2">
              <div className="truncate">
                <span className="font-mono font-semibold text-white">
                  {resolvedObject.canonicalName}
                </span>
                <span className="text-slate-400 ml-1.5">({resolvedObject.otype})</span>
              </div>
              <span className="font-mono text-[10px] text-[#00D2FF] shrink-0">
                {resolvedObject.resolverSource}
              </span>
            </div>
          )}
        </div>

        {/* Zoom / Field of View Slider */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300">{t.chrono.zoomFov}</span>
            <span className="font-mono text-[#00D2FF]">{numericSize.toFixed(2)}°</span>
          </div>
          <input
            id="zoom-slider"
            type="range"
            min="0.05"
            max="0.50"
            step="0.01"
            value={numericSize}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSize(val.toFixed(2));
              onChangeFov?.(val);
            }}
            className="apple-slider w-full"
          />
        </div>

        {/* Molecule Filter Buttons */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">
              {t.chrono.molecularSignatures}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              {activeMolecules.size > 0 ? t.chrono.activeBadge : t.chrono.standbyBadge}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {MOLECULE_SIGNATURES.map((m) => {
              const active = activeMolecules.has(m.id);
              const label = t.chrono.molecules[m.id];
              return (
                <button
                  key={m.id}
                  type="button"
                  data-molecule={m.id}
                  data-active={active ? "true" : "false"}
                  onClick={() => handleMoleculeClick(m)}
                  className="mol-btn w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 hover:bg-white/[0.07] text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        background: m.color,
                        boxShadow: `0 0 8px ${m.color}66`,
                      }}
                    />
                    <span className="truncate">{label}</span>
                  </span>
                  <span
                    className={`text-[10px] font-mono shrink-0 ml-2 ${
                      active ? "text-[#00D2FF] font-semibold" : "text-slate-500"
                    }`}
                  >
                    {active ? `${t.chrono.onLabel} · ${m.band}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Collapsible Scientific & Band Controls */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="btn-press w-full flex items-center justify-between text-xs font-medium text-slate-300 hover:text-white py-1 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#00D2FF]" />
              <span>{t.chrono.advancedControls}</span>
            </span>
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="stretch-select"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    {t.controls.stretchLabel}
                  </label>
                  <select
                    id="stretch-select"
                    value={stretch}
                    onChange={(e) => setStretch(e.target.value as StretchMode)}
                    className="w-full px-2.5 py-1.5 text-xs bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00D2FF]/70"
                  >
                    <option value="asinh">{t.controls.stretchOptions.asinh}</option>
                    <option value="log">{t.controls.stretchOptions.log}</option>
                    <option value="sqrt">{t.controls.stretchOptions.sqrt}</option>
                    <option value="linear">{t.controls.stretchOptions.linear}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="colormap-select"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    {t.controls.colormapLabel}
                  </label>
                  <select
                    id="colormap-select"
                    value={colormap}
                    onChange={(e) => setColormap(e.target.value as ColormapName)}
                    className="w-full px-2.5 py-1.5 text-xs bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00D2FF]/70"
                  >
                    <option value="inferno">{t.controls.colormapOptions.inferno}</option>
                    <option value="viridis">{t.controls.colormapOptions.viridis}</option>
                    <option value="plasma">{t.controls.colormapOptions.plasma}</option>
                    <option value="magma">{t.controls.colormapOptions.magma}</option>
                    <option value="gray">{t.controls.colormapOptions.gray}</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="band-select" className="block text-[11px] text-slate-400 mb-1">
                  {t.controls.bandLabel}
                </label>
                <select
                  id="band-select"
                  value={band}
                  onChange={(e) => setBand(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00D2FF]/70"
                >
                  <option value="all">{t.controls.allBands}</option>
                  <option value="D1">D1 (0.75 – 1.12 µm)</option>
                  <option value="D2">D2 (1.11 – 1.64 µm)</option>
                  <option value="D3">D3 (1.63 – 2.42 µm)</option>
                  <option value="D4">D4 (2.40 – 3.85 µm)</option>
                  <option value="D5">D5 (3.81 – 4.43 µm)</option>
                  <option value="D6">D6 (4.42 – 5.00 µm)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={subtractZodi}
                    onChange={(e) => setSubtractZodi(e.target.checked)}
                    className="rounded bg-black/60 border-white/20 text-[#00D2FF] focus:ring-[#00D2FF]/30"
                  />
                  <span>{t.controls.subtractZodi}</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showCrosshair}
                    onChange={(e) => setShowCrosshair(e.target.checked)}
                    className="rounded bg-black/60 border-white/20 text-[#00D2FF] focus:ring-[#00D2FF]/30"
                  />
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-[#00D2FF]" />
                    <span>{t.controls.showCrosshair}</span>
                  </span>
                </label>
              </div>

              {onOpenExposuresDrawer && (
                <button
                  type="button"
                  onClick={onOpenExposuresDrawer}
                  className="btn-press w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-slate-200 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#00D2FF]" />
                    <span>{t.chrono.exposuresDrawerButton(totalFound)}</span>
                  </span>
                  <span className="text-[#00D2FF] font-mono">→</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Subtle API Status Footer */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate">
          {loading
            ? t.chrono.apiStatusQuerying
            : totalFound > 0
            ? t.chrono.apiStatusConnected(totalFound)
            : t.chrono.apiStatusReady}
        </span>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            loading
              ? "bg-amber-400 animate-pulse"
              : totalFound > 0
              ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
              : "bg-[#00D2FF] shadow-[0_0_8px_#00D2FF]"
          }`}
        />
      </div>
    </aside>
  );
};
