import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Database, Layers, Sparkles } from "lucide-react";
import { SPHEREX_COLLECTIONS } from "../lib/irsa";
import type {
  CollectionVersionData,
  SpherexCollectionId,
  SpherexObservation,
} from "../lib/types";
import { useLanguage } from "../i18n/LanguageContext";

interface ObservationsPanelProps {
  observations: SpherexObservation[];
  totalFound: number;
  selectedIdx: number;
  onSelect: (idx: number) => void;
  loading: boolean;
  versions: Record<SpherexCollectionId, CollectionVersionData> | null;
  activeCollection: SpherexCollectionId;
  onSelectCollection: (collection: SpherexCollectionId) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export const ObservationsPanel: React.FC<ObservationsPanelProps> = ({
  observations,
  totalFound,
  selectedIdx,
  onSelect,
  loading,
  versions,
  activeCollection,
  onSelectCollection,
}) => {
  const { t } = useLanguage();
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const totalItems = observations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Sincronizar automáticamente la página activa cuando cambia la observación seleccionada desde otro panel
  useEffect(() => {
    if (totalItems === 0) {
      setCurrentPage(1);
      return;
    }
    const targetPage = Math.floor(selectedIdx / pageSize) + 1;
    if (targetPage >= 1 && targetPage <= totalPages) {
      setCurrentPage(targetPage);
    }
  }, [selectedIdx, pageSize, totalItems, totalPages]);

  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedObservations = observations.slice(startIndex, endIndex);

  const handleChangePage = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    setCurrentPage(clamped);
    const firstIdxInPage = (clamped - 1) * pageSize;
    if (firstIdxInPage < totalItems) {
      onSelect(firstIdxInPage);
    }
  };

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

      {/* Pestañas de Versiones del Catálogo SPHEREx (Wide DR1, Deep DR1) */}
      {versions && (
        <div className="flex flex-col gap-1.5 bg-space-950/60 border border-slate-800/70 rounded-xl p-2.5">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <Database className="w-3 h-3 text-cyan-400" />
            {t.observations.versionsHeader}
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            {SPHEREX_COLLECTIONS.map((col) => {
              const count = versions[col]?.total_found ?? 0;
              const isActive = activeCollection === col;
              const hasData = count > 0;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => onSelectCollection(col)}
                  className={`px-2 py-1.5 rounded-lg border text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                    isActive
                      ? "bg-cyan-950/70 border-cyan-500 text-white shadow-sm"
                      : hasData
                      ? "bg-slate-900/80 border-slate-700/80 hover:border-cyan-700 text-slate-200"
                      : "bg-space-950/40 border-slate-800/60 text-slate-500 opacity-70"
                  }`}
                >
                  <span className="text-[10px] font-semibold truncate w-full">
                    {t.controls.collectionShortLabels[col]}
                  </span>
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      isActive
                        ? "text-cyan-300"
                        : hasData
                        ? "text-emerald-400"
                        : "text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
        {observations.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-500 text-xs">
            {loading ? (
              <p>{t.observations.searching}</p>
            ) : versions ? (
              <p>{t.observations.noObsInCollection}</p>
            ) : (
              <p>{t.observations.emptyDesc}</p>
            )}
          </div>
        ) : (
          paginatedObservations.map((obs, localIdx) => {
            const globalIdx = startIndex + localIdx;
            const isSelected = globalIdx === selectedIdx;
            return (
              <button
                key={`${obs.obs_id}-${obs.bandpass}-${globalIdx}`}
                type="button"
                onClick={() => onSelect(globalIdx)}
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
                  <span>{obs.epoch_date ?? obs.obs_collection}</span>
                  {obs.t_exptime && <span>{t.observations.expTime(obs.t_exptime)}</span>}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Controles de Paginación de Exposiciones FITS */}
      {totalItems > 0 && (
        <div className="flex flex-col gap-2 pt-2.5 border-t border-slate-800/70 text-xs">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>
              {t.observations.paginationInfo({
                from: startIndex + 1,
                to: endIndex,
                total: totalItems,
              })}
            </span>

            <label className="flex items-center gap-1.5">
              <span>{t.observations.pageSizeLabel}</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
                className="bg-space-950 border border-slate-700/80 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 bg-space-950/60 border border-slate-800/80 rounded-xl px-2.5 py-1.5">
              <button
                type="button"
                onClick={() => handleChangePage(safePage - 1)}
                disabled={safePage <= 1}
                title={t.observations.prevPage}
                className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-mono text-[11px] font-semibold text-cyan-300">
                {t.observations.pageIndicator({ page: safePage, totalPages })}
              </span>

              <button
                type="button"
                onClick={() => handleChangePage(safePage + 1)}
                disabled={safePage >= totalPages}
                title={t.observations.nextPage}
                className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
