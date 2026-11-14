import React from "react";
import { Layers, Sparkles } from "lucide-react";
import type { SpherexObservation } from "../lib/types";
import { useLanguage } from "../i18n/LanguageContext";

interface ObservationsPanelProps {
  observations: SpherexObservation[];
  totalFound: number;
  selectedIdx: number;
  onSelect: (idx: number) => void;
  loading: boolean;
}

export const ObservationsPanel: React.FC<ObservationsPanelProps> = ({
  observations,
  totalFound,
  selectedIdx,
  onSelect,
  loading,
}) => {
  const { t } = useLanguage();

  return (
    <aside className="bg-space-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4 backdrop-blur-sm shadow-xl w-full lg:w-80 shrink-0">
      <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            {t.observations.title}
          </h2>
        </div>
        <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded-full bg-slate-800 text-cyan-400 border border-slate-700">
          {totalFound}
        </span>
      </div>

      <div className="flex flex-col gap-2 max-h-[640px] overflow-y-auto pr-1">
        {observations.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-500 text-xs">
            {loading ? (
              <p>{t.observations.searching}</p>
            ) : (
              <p>{t.observations.emptyDesc}</p>
            )}
          </div>
        ) : (
          observations.map((obs, idx) => {
            const isSelected = idx === selectedIdx;
            return (
              <button
                key={`${obs.obs_id}-${obs.bandpass}-${idx}`}
                type="button"
                onClick={() => onSelect(idx)}
                className={`text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "bg-cyan-950/40 border-cyan-500/80 shadow-[0_0_12px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30"
                    : "bg-space-950/40 border-slate-800/70 hover:bg-slate-800/40 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      isSelected
                        ? "bg-cyan-500 text-black font-bold"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {obs.bandpass || "SPHEREx"}
                  </span>
                  <span className="text-[11px] font-mono text-cyan-300 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                    {obs.em_min_um !== null && obs.em_max_um !== null
                      ? `${obs.em_min_um} – ${obs.em_max_um} µm`
                      : t.observations.irFallback}
                  </span>
                </div>

                <div className="text-xs font-mono text-slate-200 truncate">{obs.obs_id}</div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 font-mono">
                  <span>{obs.obs_collection}</span>
                  {obs.t_exptime && <span>{t.observations.expTime(obs.t_exptime)}</span>}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
