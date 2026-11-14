import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "./components/Navbar";
import { ControlsPanel } from "./components/ControlsPanel";
import { ViewerPanel } from "./components/ViewerPanel";
import { ObservationsPanel } from "./components/ObservationsPanel";
import { parseDec, parseRA } from "./lib/coordinates";
import { resolveCelestialName } from "./lib/celestialResolver";
import { getRenderedCutout, prefetchFitsCutout, queryAllSpherexVersions } from "./lib/irsa";
import { useLanguage } from "./i18n/LanguageContext";
import type { Translations } from "./i18n/translations";
import type {
  CollectionQueryMode,
  CollectionVersionData,
  ColormapName,
  RenderedCutout,
  ResolvedCelestialObject,
  SpherexCollectionId,
  SpherexObservation,
  StretchMode,
  TargetPreset,
} from "./lib/types";

type StatusState =
  | { type: "resolvingObject"; name: string }
  | { type: "objectNotFound"; name: string }
  | { type: "downloadingFits"; band: string; id: string }
  | { type: "invalidRa" }
  | { type: "invalidDec" }
  | { type: "queryingSia"; ra: string; dec: string; collection: string }
  | { type: "queryingAllVersions"; ra: string; dec: string }
  | { type: "noImagesFound"; collection: string; ra: string; dec: string }
  | { type: "customError"; message: string }
  | null;

function translateErrorMessage(msg: string, t: Translations): string {
  if (msg.includes("IMAGE 2D")) return t.status.fitsNoImage;
  if (msg.includes("Dimensiones de imagen") || msg.includes("dimensions"))
    return t.status.fitsInvalidDimensions;
  if (msg.includes("NaN") || msg.includes("vacíos") || msg.includes("empty"))
    return t.status.fitsAllNan;
  if (msg.includes("Canvas")) return t.status.fitsCanvasError;
  return msg || t.status.unexpectedError;
}

export default function App() {
  const { t } = useLanguage();

  const [raInput, setRaInput] = useState("08h55m10.831s");
  const [decInput, setDecInput] = useState("-7d14m42.53s");
  const [collectionMode, setCollectionMode] = useState<CollectionQueryMode>("spherex_dr1");
  const [band, setBand] = useState("all");
  const [radius, setRadius] = useState("0.05");
  const [size, setSize] = useState("0.15");

  const [stretch, setStretch] = useState<StretchMode>("asinh");
  const [colormap, setColormap] = useState<ColormapName>("inferno");
  const [subtractZodi, setSubtractZodi] = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(true);

  const [loading, setLoading] = useState(false);
  const [cutoutLoading, setCutoutLoading] = useState(false);
  const cutoutRequestIdRef = useRef(0);
  const cutoutAbortRef = useRef<AbortController | null>(null);
  const [resolvingName, setResolvingName] = useState(false);
  const [resolvedObject, setResolvedObject] = useState<ResolvedCelestialObject | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>("wise_0855");

  const [statusState, setStatusState] = useState<StatusState>(null);
  const [versions, setVersions] = useState<Record<
    SpherexCollectionId,
    CollectionVersionData
  > | null>(null);
  const [activeCollection, setActiveCollection] = useState<SpherexCollectionId>("spherex_dr1");
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [cutout, setCutout] = useState<RenderedCutout | null>(null);
  const [lastCoords, setLastCoords] = useState<{ ra: number; dec: number; size: number } | null>(
    null
  );

  const status = useMemo(() => {
    if (!statusState) return null;
    switch (statusState.type) {
      case "resolvingObject":
        return { text: t.status.resolvingObject(statusState.name), isError: false };
      case "objectNotFound":
        return { text: t.status.objectNotFound(statusState.name), isError: true };
      case "downloadingFits":
        return {
          text: t.status.downloadingFits({ band: statusState.band, id: statusState.id }),
          isError: false,
        };
      case "invalidRa":
        return { text: t.status.invalidRa, isError: true };
      case "invalidDec":
        return { text: t.status.invalidDec, isError: true };
      case "queryingSia":
        return { text: t.status.queryingSia(statusState), isError: false };
      case "queryingAllVersions":
        return { text: t.status.queryingAllVersions(statusState), isError: false };
      case "noImagesFound":
        return { text: t.status.noImagesFound(statusState), isError: true };
      case "customError":
        return { text: translateErrorMessage(statusState.message, t), isError: true };
    }
  }, [statusState, t]);

  const activeVersionData = versions ? versions[activeCollection] : null;
  const observations = activeVersionData?.observations ?? [];
  const totalFound = activeVersionData?.total_found ?? 0;
  const siaUrl = activeVersionData?.sia_url ?? "";

  const loadCutout = useCallback(
    async (
      obs: SpherexObservation,
      raDeg: number,
      decDeg: number,
      sizeDeg: number,
      stretchVal: StretchMode,
      cmapVal: ColormapName,
      zodiVal: boolean
    ) => {
      cutoutAbortRef.current?.abort();
      const controller = new AbortController();
      cutoutAbortRef.current = controller;

      const reqId = ++cutoutRequestIdRef.current;
      setCutoutLoading(true);
      setStatusState({
        type: "downloadingFits",
        band: obs.bandpass || "SPHEREx",
        id: obs.obs_id,
      });

      try {
        const rendered = await getRenderedCutout({
          accessUrl: obs.access_url,
          ra: raDeg,
          dec: decDeg,
          size: sizeDeg,
          stretch: stretchVal,
          colormap: cmapVal,
          subtractZodi: zodiVal,
          priority: "high",
          signal: controller.signal,
        });
        if (reqId !== cutoutRequestIdRef.current) return;
        setCutout(rendered);
        setStatusState(null);
      } catch (err) {
        if (
          reqId !== cutoutRequestIdRef.current ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }
        setStatusState({
          type: "customError",
          message: err instanceof Error ? err.message : "",
        });
      } finally {
        if (reqId === cutoutRequestIdRef.current) {
          setCutoutLoading(false);
        }
      }
    },
    []
  );

  const executeSearch = useCallback(
    async (
      rawRa: string,
      rawDec: string,
      colMode: CollectionQueryMode,
      bandVal: string,
      radiusStr: string,
      sizeStr: string
    ) => {
      const raDeg = parseRA(rawRa);
      const decDeg = parseDec(rawDec);
      const radiusNum = Number(radiusStr);
      const sizeNum = Number(sizeStr);

      if (raDeg === null) {
        setStatusState({ type: "invalidRa" });
        return;
      }
      if (decDeg === null) {
        setStatusState({ type: "invalidDec" });
        return;
      }

      setLoading(true);
      setStatusState({
        type: "queryingSia",
        ra: raDeg.toFixed(5),
        dec: decDeg.toFixed(5),
        collection: colMode,
      });

      try {
        const multiData = await queryAllSpherexVersions({
          ra: raDeg,
          dec: decDeg,
          radius: radiusNum,
          collectionMode: colMode,
          band: bandVal,
        });

        setVersions(multiData.versions);
        const targetCol = multiData.recommendedCollection;
        setActiveCollection(targetCol);
        setSelectedIdx(0);
        setLastCoords({ ra: raDeg, dec: decDeg, size: sizeNum });

        const targetObsList = multiData.versions[targetCol].observations;

        if (targetObsList.length === 0) {
          setCutout(null);
          setStatusState({
            type: "noImagesFound",
            collection: "SPHEREx DR1 Wide (spherex_dr1)",
            ra: raDeg.toFixed(4),
            dec: decDeg.toFixed(4),
          });
          return;
        }
      } catch (err) {
        setStatusState({
          type: "customError",
          message: err instanceof Error ? err.message : "",
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Cambio instantáneo de escalas de flujo, paleta o zodi sobre el FITS en memoria
  useEffect(() => {
    const obs = observations[selectedIdx];
    if (!obs || !lastCoords) return;
    void loadCutout(
      obs,
      lastCoords.ra,
      lastCoords.dec,
      lastCoords.size,
      stretch,
      colormap,
      subtractZodi
    );
  }, [stretch, colormap, subtractZodi, selectedIdx, observations, lastCoords, loadCutout]);

  // Precargar en segundo plano la observación siguiente cuando el visor principal termina
  useEffect(() => {
    if (cutoutLoading || !cutout || !lastCoords) return;
    const nextObs = observations[selectedIdx + 1];
    if (!nextObs) return;

    const controller = new AbortController();
    prefetchFitsCutout({
      accessUrl: nextObs.access_url,
      ra: lastCoords.ra,
      dec: lastCoords.dec,
      size: lastCoords.size,
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [cutoutLoading, cutout, lastCoords, observations, selectedIdx]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActivePresetId(null);
    void executeSearch(raInput, decInput, collectionMode, band, radius, size);
  };

  const handleSelectPreset = useCallback(
    async (preset: TargetPreset) => {
      setActivePresetId(preset.id);
      setRaInput(preset.ra);
      setDecInput(preset.dec);
      setCollectionMode(preset.collection);

      setResolvingName(true);
      try {
        const resolved = await resolveCelestialName(preset.queryName);
        setResolvedObject(resolved);
      } catch {
        setResolvedObject(null);
      } finally {
        setResolvingName(false);
      }

      await executeSearch(preset.ra, preset.dec, preset.collection, band, radius, size);
    },
    [band, executeSearch, radius, size]
  );

  const handleSearchCelestialName = useCallback(
    async (name: string) => {
      setResolvingName(true);
      setStatusState({ type: "resolvingObject", name });

      const matchingPreset = t.presets.find(
        (p) =>
          p.label.toLowerCase() === name.toLowerCase() ||
          p.queryName.toLowerCase() === name.toLowerCase()
      );
      setActivePresetId(matchingPreset?.id ?? null);

      try {
        const resolved = await resolveCelestialName(name);
        setResolvedObject(resolved);
        setRaInput(resolved.raHms);
        setDecInput(resolved.decDms);
        setCollectionMode("spherex_dr1");
        await executeSearch(resolved.raHms, resolved.decDms, "spherex_dr1", band, radius, size);
      } catch {
        setStatusState({ type: "objectNotFound", name });
      } finally {
        setResolvingName(false);
      }
    },
    [band, executeSearch, radius, size, t.presets]
  );

  const handleSelectCollection = (col: SpherexCollectionId) => {
    setActiveCollection(col);
    setSelectedIdx(0);
  };

  const handleSelectVersionObservation = (
    col: SpherexCollectionId,
    targetObs: SpherexObservation
  ) => {
    setActiveCollection(col);
    const colObs = versions?.[col]?.observations ?? [];
    const foundIdx = colObs.findIndex(
      (o) => o.obs_id === targetObs.obs_id && o.bandpass === targetObs.bandpass
    );
    setSelectedIdx(foundIdx >= 0 ? foundIdx : 0);
  };

  const handleChangeFov = useCallback((newSize: number) => {
    const clamped = Number(Math.min(1.0, Math.max(0.02, newSize)).toFixed(3));
    setSize(String(clamped));
    setLastCoords((prev) => (prev ? { ...prev, size: clamped } : prev));
  }, []);

  const handleQueryAtCoords = useCallback(
    (raDeg: number, decDeg: number) => {
      const raStr = raDeg.toFixed(5);
      const decStr = decDeg.toFixed(5);
      setActivePresetId(null);
      setResolvedObject(null);
      setRaInput(raStr);
      setDecInput(decStr);
      void executeSearch(raStr, decStr, collectionMode, band, radius, size);
    },
    [band, collectionMode, executeSearch, radius, size]
  );

  const selectedObs = observations[selectedIdx] ?? null;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-[360px_1fr_320px] gap-5 items-start">
        <ControlsPanel
          raInput={raInput}
          setRaInput={setRaInput}
          decInput={decInput}
          setDecInput={setDecInput}
          collectionMode={collectionMode}
          setCollectionMode={setCollectionMode}
          band={band}
          setBand={setBand}
          radius={radius}
          setRadius={setRadius}
          size={size}
          setSize={setSize}
          stretch={stretch}
          setStretch={setStretch}
          colormap={colormap}
          setColormap={setColormap}
          subtractZodi={subtractZodi}
          setSubtractZodi={setSubtractZodi}
          showCrosshair={showCrosshair}
          setShowCrosshair={setShowCrosshair}
          loading={loading}
          resolvingName={resolvingName}
          resolvedObject={resolvedObject}
          activePresetId={activePresetId}
          onSubmit={handleSubmit}
          onSelectPreset={handleSelectPreset}
          onSearchCelestialName={handleSearchCelestialName}
        />

        <ViewerPanel
          selectedObs={selectedObs}
          cutout={cutout}
          cutoutLoading={cutoutLoading}
          lastCoords={lastCoords}
          showCrosshair={showCrosshair}
          status={status}
          siaUrl={siaUrl}
          resolvedObject={resolvedObject}
          versions={versions}
          activeCollection={activeCollection}
          stretch={stretch}
          colormap={colormap}
          subtractZodi={subtractZodi}
          onChangeFov={handleChangeFov}
          onSelectVersionObservation={handleSelectVersionObservation}
          onQueryAtCoords={handleQueryAtCoords}
        />

        <ObservationsPanel
          observations={observations}
          totalFound={totalFound}
          selectedIdx={selectedIdx}
          onSelect={(idx) => setSelectedIdx(idx)}
          loading={loading}
          versions={versions}
          activeCollection={activeCollection}
          onSelectCollection={handleSelectCollection}
        />
      </main>
    </div>
  );
}
