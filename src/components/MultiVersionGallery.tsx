import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Grid, Layers, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { getRenderedCutout, SPHEREX_COLLECTIONS } from "../lib/irsa";
import type {
  CollectionVersionData,
  ColormapName,
  RenderedCutout,
  SpherexCollectionId,
  SpherexObservation,
  StretchMode,
} from "../lib/types";

interface MultiVersionGalleryProps {
  versions: Record<SpherexCollectionId, CollectionVersionData> | null;
  lastCoords: { ra: number; dec: number; size: number } | null;
  stretch: StretchMode;
  colormap: ColormapName;
  subtractZodi: boolean;
  activeCollection: SpherexCollectionId;
  selectedObs: SpherexObservation | null;
  onSelectVersionObservation: (collection: SpherexCollectionId, obs: SpherexObservation) => void;
}

interface GalleryItem {
  key: string;
  collection: SpherexCollectionId;
  obs: SpherexObservation;
  matchingCount: number;
}

const GALLERY_PAGE_SIZE = 4;

export const MultiVersionGallery: React.FC<MultiVersionGalleryProps> = ({
  versions,
  lastCoords,
  stretch,
  colormap,
  subtractZodi,
  activeCollection,
  selectedObs,
  onSelectVersionObservation,
}) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"byBand" | "byCollection">("byBand");
  const [galleryPage, setGalleryPage] = useState<number>(1);
  const [renderedMap, setRenderedMap] = useState<
    Record<string, { status: "idle" | "loading" | "ready" | "error"; cutout?: RenderedCutout }>
  >({});
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => new Set());
  const startedKeysRef = useRef<Set<string>>(new Set());
  const batchAbortRef = useRef<AbortController | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardNodesRef = useRef<Map<string, HTMLElement>>(new Map());

  const availableCollections = useMemo(() => {
    if (!versions) return [];
    return SPHEREX_COLLECTIONS.filter((col) => versions[col]?.observations.length > 0);
  }, [versions]);

  const galleryItems = useMemo<GalleryItem[]>(() => {
    if (!versions) return [];
    const items: GalleryItem[] = [];

    if (mode === "byCollection") {
      for (const col of availableCollections) {
        const colData = versions[col];
        if (!colData || colData.observations.length === 0) continue;
        const firstObs = colData.observations[0];
        items.push({
          key: `${col}|${firstObs.obs_id}|${firstObs.bandpass}`,
          collection: col,
          obs: firstObs,
          matchingCount: colData.total_found,
        });
      }
    } else {
      for (const col of availableCollections) {
        const colData = versions[col];
        if (!colData || colData.observations.length === 0) continue;

        const byBand = new Map<string, SpherexObservation[]>();
        for (const obs of colData.observations) {
          const b = obs.bandpass || "SPHEREx";
          const list = byBand.get(b) ?? [];
          list.push(obs);
          byBand.set(b, list);
        }

        const sortedBands = Array.from(byBand.keys()).sort();
        for (const b of sortedBands) {
          const list = byBand.get(b)!;
          items.push({
            key: `${col}|${b}|${list[0].obs_id}`,
            collection: col,
            obs: list[0],
            matchingCount: list.length,
          });
        }
      }
    }

    return items;
  }, [availableCollections, mode, versions]);

  const totalPages = Math.max(1, Math.ceil(galleryItems.length / GALLERY_PAGE_SIZE));
  const safePage = Math.min(galleryPage, totalPages);
  const startIdx = (safePage - 1) * GALLERY_PAGE_SIZE;
  const endIdx = Math.min(startIdx + GALLERY_PAGE_SIZE, galleryItems.length);
  const paginatedGalleryItems = useMemo(
    () => galleryItems.slice(startIdx, endIdx),
    [galleryItems, startIdx, endIdx]
  );

  useEffect(() => {
    setGalleryPage(1);
  }, [galleryItems, lastCoords]);

  // Observador de visibilidad para cargar solo las tarjetas visibles de la página actual (lazy loading)
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisibleKeys(new Set(paginatedGalleryItems.map((i) => i.key)));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const newlyVisible: string[] = [];
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const key = (entry.target as HTMLElement).dataset.galleryKey;
            if (key) newlyVisible.push(key);
          }
        }
        if (newlyVisible.length > 0) {
          setVisibleKeys((prev) => {
            let changed = false;
            const next = new Set(prev);
            for (const k of newlyVisible) {
              if (!next.has(k)) {
                next.add(k);
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        }
      },
      { rootMargin: "150px" }
    );

    observerRef.current = observer;
    for (const node of cardNodesRef.current.values()) {
      observer.observe(node);
    }

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [paginatedGalleryItems]);

  const setCardRef = useCallback(
    (key: string) => (node: HTMLButtonElement | null) => {
      const prev = cardNodesRef.current.get(key);
      if (prev && observerRef.current) {
        observerRef.current.unobserve(prev);
      }
      if (node) {
        cardNodesRef.current.set(key, node);
        observerRef.current?.observe(node);
      } else {
        cardNodesRef.current.delete(key);
      }
    },
    []
  );

  // Reiniciar lote cuando cambian las coordenadas, ítems o parámetros visuales
  useEffect(() => {
    batchAbortRef.current?.abort();
    const controller = new AbortController();
    batchAbortRef.current = controller;
    startedKeysRef.current = new Set();

    if (!lastCoords || galleryItems.length === 0) {
      setRenderedMap({});
      return;
    }

    const initialMap: Record<
      string,
      { status: "idle" | "loading" | "ready" | "error"; cutout?: RenderedCutout }
    > = {};
    for (const item of galleryItems) {
      initialMap[item.key] = { status: "idle" };
    }
    setRenderedMap(initialMap);

    return () => {
      controller.abort();
    };
  }, [galleryItems, lastCoords, stretch, colormap, subtractZodi]);

  // Encolar únicamente los ítems visibles de la página actual que aún no han comenzado a descargarse
  useEffect(() => {
    const controller = batchAbortRef.current;
    if (!lastCoords || !controller || controller.signal.aborted) return;

    const pendingVisible = paginatedGalleryItems.filter(
      (item) => visibleKeys.has(item.key) && !startedKeysRef.current.has(item.key)
    );
    if (pendingVisible.length === 0) return;

    for (const item of pendingVisible) {
      startedKeysRef.current.add(item.key);
    }

    setRenderedMap((prev) => {
      const next = { ...prev };
      for (const item of pendingVisible) {
        next[item.key] = { status: "loading" };
      }
      return next;
    });

    for (const item of pendingVisible) {
      void getRenderedCutout({
        accessUrl: item.obs.access_url,
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
            [item.key]: { status: "ready", cutout },
          }));
        })
        .catch((err) => {
          if (
            controller.signal.aborted ||
            (err instanceof DOMException && err.name === "AbortError")
          ) {
            startedKeysRef.current.delete(item.key);
            return;
          }
          setRenderedMap((prev) => ({
            ...prev,
            [item.key]: { status: "error" },
          }));
        });
    }
  }, [visibleKeys, paginatedGalleryItems, lastCoords, stretch, colormap, subtractZodi]);

  if (!versions || availableCollections.length === 0 || galleryItems.length === 0) {
    return null;
  }

  return (
    <div className="bg-space-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/70 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Grid className="w-4 h-4 text-cyan-400" />
            <span>{t.viewer.galleryTitle}</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {t.viewer.gallerySubtitle({
              count: galleryItems.length,
              collections: availableCollections.length,
            })}
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-space-900/90 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode("byBand")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              mode === "byBand"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>{t.viewer.galleryModeByBand}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("byCollection")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              mode === "byCollection"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>{t.viewer.galleryModeByCollection}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {paginatedGalleryItems.map((item) => {
          const entry = renderedMap[item.key];
          const isCurrent =
            activeCollection === item.collection &&
            selectedObs?.obs_id === item.obs.obs_id &&
            selectedObs?.bandpass === item.obs.bandpass;

          return (
            <button
              key={item.key}
              ref={setCardRef(item.key)}
              data-gallery-key={item.key}
              type="button"
              onClick={() => onSelectVersionObservation(item.collection, item.obs)}
              title={t.viewer.galleryClickToInspect}
              className={`group text-left rounded-xl overflow-hidden border transition-all flex flex-col cursor-pointer ${
                isCurrent
                  ? "bg-cyan-950/40 border-cyan-400 ring-1 ring-cyan-400/40 shadow-lg shadow-cyan-950/50"
                  : "bg-space-900/60 border-slate-800/80 hover:border-cyan-700/70 hover:bg-space-900"
              }`}
            >
              {/* Miniatura del Recorte FITS */}
              <div className="relative w-full aspect-square bg-black/90 flex items-center justify-center overflow-hidden border-b border-slate-800/70">
                {entry?.status === "ready" && entry.cutout ? (
                  <>
                    <img
                      src={entry.cutout.dataUrl}
                      alt={`${item.collection} ${item.obs.bandpass}`}
                      className="w-full h-full object-contain [image-rendering:pixelated] group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-60">
                      <div className="w-4 h-4 rounded-full border border-cyan-400/70" />
                    </div>
                  </>
                ) : entry?.status === "error" ? (
                  <span className="text-[11px] text-rose-400/90 px-2 text-center">
                    {t.viewer.galleryErrorCutout}
                  </span>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span className="text-[10px]">{t.viewer.galleryLoadingCutout}</span>
                  </div>
                )}

                {/* Etiqueta de versión de colección */}
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-space-950/90 text-cyan-300 border border-cyan-800/60 backdrop-blur-sm">
                  {t.controls.collectionShortLabels[item.collection]}
                </span>

                {isCurrent && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-cyan-500 text-slate-950 flex items-center gap-1 shadow">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    {t.viewer.galleryActiveBadge}
                  </span>
                )}
              </div>

              {/* Metadatos de la versión y banda */}
              <div className="p-2.5 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white truncate">
                    {item.obs.bandpass || "SPHEREx"}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 shrink-0">
                    {item.obs.em_min_um !== null && item.obs.em_max_um !== null
                      ? `${item.obs.em_min_um}–${item.obs.em_max_um} µm`
                      : t.observations.irFallback}
                  </span>
                </div>

                <div className="text-[10px] font-mono text-slate-400 truncate">
                  {item.obs.obs_id}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>{t.viewer.galleryExposuresCount(item.matchingCount)}</span>
                  {entry?.cutout && (
                    <span className="font-mono text-slate-400">
                      {entry.cutout.width}×{entry.cutout.height}px
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Paginación de la Galería de Bandas / Versiones */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/70 text-xs">
          <span className="text-[11px] text-slate-400">
            {t.viewer.galleryPaginationInfo({
              from: startIdx + 1,
              to: endIdx,
              total: galleryItems.length,
            })}
          </span>

          <div className="flex items-center gap-2 bg-space-900/80 border border-slate-800 rounded-xl px-2.5 py-1">
            <button
              type="button"
              onClick={() => setGalleryPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              title={t.viewer.galleryPrevPage}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-[11px] font-semibold text-cyan-300">
              {t.viewer.galleryPageIndicator({ page: safePage, totalPages })}
            </span>

            <button
              type="button"
              onClick={() => setGalleryPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              title={t.viewer.galleryNextPage}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
