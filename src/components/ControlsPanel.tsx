import React, { useState } from "react";
import {
  Compass,
  Eye,
  Filter,
  Loader2,
  Search,
  Sliders,
  Sparkles,
  Telescope,
} from "lucide-react";
import type {
  CollectionQueryMode,
  ColormapName,
  ResolvedCelestialObject,
  StretchMode,
  TargetPreset,
} from "../lib/types";
import { useLanguage } from "../i18n/LanguageContext";

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
  onSubmit: (e: React.FormEvent) => void;
  onSelectPreset: (preset: TargetPreset) => void;
  onSearchCelestialName: (name: string) => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  raInput,
  setRaInput,
  decInput,
  setDecInput,
  collectionMode,
  setCollectionMode,
  band,
  setBand,
  radius,
  setRadius,
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
  onSubmit,
  onSelectPreset,
  onSearchCelestialName,
}) => {
  const { t } = useLanguage();
  const [nameQuery, setNameQuery] = useState("");

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameQuery.trim()) return;
    onSearchCelestialName(nameQuery.trim());
  };

  return (
    <aside className="bg-space-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-5 backdrop-blur-sm shadow-xl">
      {/* Sección 1: Buscador y Catálogo de Cuerpos Celestes (CDS Sesame + SPHEREx) */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Telescope className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            {t.controls.celestialSearchTitle}
          </h2>
        </div>

        <form onSubmit={handleNameSubmit} className="flex flex-col gap-2">
          <label
            htmlFor="celestial-name-input"
            className="block text-xs font-medium text-slate-300"
          >
            {t.controls.celestialSearchLabel}
          </label>
          <div className="flex gap-2">
            <input
              id="celestial-name-input"
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder={t.controls.celestialSearchPlaceholder}
              className="flex-1 min-w-0 px-3 py-2 text-xs bg-space-950/80 border border-slate-700/80 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
            />
            <button
              type="submit"
              disabled={resolvingName || loading || !nameQuery.trim()}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              {resolvingName ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.controls.celestialSearchingButton}</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>{t.controls.celestialSearchButton}</span>
                </>
              )}
            </button>
          </div>
          <span className="text-[11px] text-slate-500 leading-tight">
            {t.controls.celestialSearchHelp}
          </span>
        </form>

        {/* Listado de Cuerpos Celestes Destacados */}
        <div className="bg-space-950/50 border border-slate-800/70 rounded-xl p-3 flex flex-col gap-2">
          <span className="text-[11px] font-medium text-slate-400 block">
            {t.controls.recommendedTargets}
          </span>
          <div className="grid grid-cols-1 gap-1.5 max-h-[235px] overflow-y-auto pr-1">
            {t.presets.map((preset) => {
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
                  className={`text-left px-2.5 py-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-0.5 ${
                    isSelected
                      ? "bg-cyan-950/60 border-cyan-500/80 text-white shadow-sm"
                      : "bg-slate-900/70 hover:bg-cyan-950/30 text-slate-300 border-slate-800 hover:border-cyan-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold flex items-center gap-1.5 text-cyan-200">
                      <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                      {preset.label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/60 shrink-0">
                      {preset.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ficha del Objeto Celeste Resuelto por la API */}
        {resolvedObject && (
          <div className="bg-cyan-950/25 border border-cyan-800/50 rounded-xl p-3 text-xs flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                {t.controls.resolvedBadgeTitle}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {resolvedObject.resolverSource}
              </span>
            </div>
            <div className="font-mono font-bold text-white text-xs">
              {resolvedObject.canonicalName}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-300">
              <span>
                <strong className="text-slate-400">{t.controls.resolvedTypeLabel}</strong>{" "}
                <code className="text-cyan-300">{resolvedObject.otype}</code>
              </span>
              {resolvedObject.pmRa !== null && resolvedObject.pmDec !== null && (
                <span>
                  <strong className="text-slate-400">{t.controls.resolvedPmLabel}</strong>{" "}
                  <code className="text-amber-300">
                    {resolvedObject.pmRa.toFixed(1)}, {resolvedObject.pmDec.toFixed(1)} mas/yr
                  </code>
                </span>
              )}
            </div>
            {resolvedObject.aliases.length > 0 && (
              <div className="text-[10px] text-slate-400 truncate">
                <strong>{t.controls.resolvedAliasesLabel}</strong>{" "}
                {resolvedObject.aliases.slice(0, 3).join(" · ")}
              </div>
            )}
          </div>
        )}
      </section>

      <hr className="border-slate-800/80" />

      {/* Sección 2: Coordenadas y Parámetros de Consulta */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            {t.controls.coordsTitle}
          </h2>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ra-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                {t.controls.raLabel}
              </label>
              <input
                id="ra-input"
                type="text"
                value={raInput}
                onChange={(e) => setRaInput(e.target.value)}
                placeholder={t.controls.raPlaceholder}
                required
                className="w-full px-3 py-2 text-xs font-mono bg-space-950/80 border border-slate-700/80 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                {t.controls.raHelp}
              </span>
            </div>

            <div>
              <label
                htmlFor="dec-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                {t.controls.decLabel}
              </label>
              <input
                id="dec-input"
                type="text"
                value={decInput}
                onChange={(e) => setDecInput(e.target.value)}
                placeholder={t.controls.decPlaceholder}
                required
                className="w-full px-3 py-2 text-xs font-mono bg-space-950/80 border border-slate-700/80 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                {t.controls.decHelp}
              </span>
            </div>
          </div>

          <hr className="border-slate-800/80 my-0.5" />

          {/* Parámetros de Consulta IRSA */}
          <div className="flex items-center gap-2 mb-1">
            <Filter className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              {t.controls.queryTitle}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label
                htmlFor="collection-select"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                {t.controls.collectionLabel}
              </label>
              <select
                id="collection-select"
                value={collectionMode}
                onChange={(e) => setCollectionMode(e.target.value as CollectionQueryMode)}
                className="w-full px-3 py-2 text-xs bg-space-950/80 border border-slate-700/80 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              >
                <option value="spherex_dr1">
                  {t.controls.collectionLabels.spherex_dr1}
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="band-select"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                {t.controls.bandLabel}
              </label>
              <select
                id="band-select"
                value={band}
                onChange={(e) => setBand(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-space-950/80 border border-slate-700/80 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="radius-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                {t.controls.radiusLabel}
              </label>
              <input
                id="radius-input"
                type="number"
                step="0.01"
                min="0.01"
                max="2"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-space-950/80 border border-slate-700/80 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="size-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                {t.controls.sizeLabel}
              </label>
              <input
                id="size-input"
                type="number"
                step="0.01"
                min="0.02"
                max="1"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-space-950/80 border border-slate-700/80 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 hover:from-cyan-500 hover:via-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white font-medium text-xs tracking-wide rounded-xl shadow-lg shadow-cyan-900/30 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.controls.queryingButton}</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>{t.controls.queryButton}</span>
              </>
            )}
          </button>
        </form>
      </section>

      <hr className="border-slate-800/80" />

      {/* Sección 3: Opciones de Visualización */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            {t.controls.displayTitle}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="stretch-select"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              {t.controls.stretchLabel}
            </label>
            <select
              id="stretch-select"
              value={stretch}
              onChange={(e) => setStretch(e.target.value as StretchMode)}
              className="w-full px-2.5 py-1.5 text-xs bg-space-950/80 border border-slate-700/80 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
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
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              {t.controls.colormapLabel}
            </label>
            <select
              id="colormap-select"
              value={colormap}
              onChange={(e) => setColormap(e.target.value as ColormapName)}
              className="w-full px-2.5 py-1.5 text-xs bg-space-950/80 border border-slate-700/80 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="inferno">{t.controls.colormapOptions.inferno}</option>
              <option value="viridis">{t.controls.colormapOptions.viridis}</option>
              <option value="plasma">{t.controls.colormapOptions.plasma}</option>
              <option value="magma">{t.controls.colormapOptions.magma}</option>
              <option value="gray">{t.controls.colormapOptions.gray}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <label className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={subtractZodi}
              onChange={(e) => setSubtractZodi(e.target.checked)}
              className="rounded bg-space-950 border-slate-700 text-cyan-500 focus:ring-cyan-500/30"
            />
            <span>{t.controls.subtractZodi}</span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCrosshair}
              onChange={(e) => setShowCrosshair(e.target.checked)}
              className="rounded bg-space-950 border-slate-700 text-cyan-500 focus:ring-cyan-500/30"
            />
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.controls.showCrosshair}</span>
            </span>
          </label>
        </div>
      </section>
    </aside>
  );
};
