import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import {
  ControlsPanel,
  type MoleculeSignature,
} from "./components/ControlsPanel";
import { LanguageSelector } from "./components/LanguageSelector";
import { ObservationsPanel } from "./components/ObservationsPanel";
import {
  CosmicBackground,
  SpaceGate,
  type CosmicBackgroundHandle,
} from "./components/SpaceGate";
import { ViewerPanel } from "./components/ViewerPanel";
import {
  DEFAULT_CUTOUT_FOV_DEG,
  clampCutoutFov,
  parseDec,
  parseRA,
} from "./lib/coordinates";
import { resolveCelestialName } from "./lib/celestialResolver";
import { SPHEREX_HIPS_WAVELENGTHS_UM } from "./lib/hips";
import { getRenderedCutout, prefetchFitsCutout, queryAllSpherexVersions } from "./lib/irsa";
import { clearUrlState, parseUrlState, syncUrlState } from "./lib/urlState";
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

type ScreenId = "entry" | "loading" | "explorer";

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

  // Screen navigation state (Entry -> Loading -> Explorer)
  const [currentScreen, setCurrentScreen] = useState<ScreenId>("entry");
  const [loadingProgress, setLoadingProgress] = useState<number>(0);

  // Dual-map split state: false = 1 map (100% width), true = 2 maps dividing the original map space in 2
  const [secondMapOpen, setSecondMapOpen] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [showExposuresModal, setShowExposuresModal] = useState<boolean>(false);

  // Active molecular signatures & tuned HiPS spectral channel
  const [activeMolecules, setActiveMolecules] = useState<Set<string>>(new Set());
  const [externalChannelIdx, setExternalChannelIdx] = useState<number | null>(null);

  const cosmicBgRef = useRef<CosmicBackgroundHandle | null>(null);
  const [cursorSky, setCursorSky] = useState<{ ra: number; dec: number } | null>(null);
  const [warping, setWarping] = useState(false);

  const [raInput, setRaInput] = useState("08h55m10.831s");
  const [decInput, setDecInput] = useState("-7d14m42.53s");
  const [targetName, setTargetName] = useState("WISE 0855");
  const [collectionMode, setCollectionMode] = useState<CollectionQueryMode>("spherex_dr1");
  const [band, setBand] = useState("all");
  const [radius, setRadius] = useState("0.05");
  const [size, setSize] = useState(DEFAULT_CUTOUT_FOV_DEG.toFixed(2));

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
  const [lastCoords, setLastCoords] = useState<{ ra: number; dec: number; size: number } | null>({
    ra: 133.79513,
    dec: -7.24515,
    size: DEFAULT_CUTOUT_FOV_DEG,
  });
  const [activeUrlCoords, setActiveUrlCoords] = useState<{ ra: string; dec: string } | null>(null);
  const [urlBootstrapDone, setUrlBootstrapDone] = useState(false);
  const urlInitializedRef = useRef(false);
  const [urlErrorModal, setUrlErrorModal] = useState<{
    kind: "invalidTarget" | "invalidCoords";
    value: string;
  } | null>(null);

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

      setActiveUrlCoords({ ra: rawRa.trim(), dec: rawDec.trim() });
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

  // Instant update of flux stretch, colormap, or zodi subtraction on loaded FITS
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

  // Background prefetch next observation
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

  // URL State: Parse URL parameters on initial load (supports ?ra=&dec= and ?target=)
  useEffect(() => {
    if (typeof window === "undefined" || urlInitializedRef.current) return;
    urlInitializedRef.current = true;

    const parsed = parseUrlState(window.location.search);

    if (parsed.kind === "none") {
      setUrlBootstrapDone(true);
      return;
    }

    if (parsed.kind === "invalidCoords") {
      clearUrlState();
      setCurrentScreen("entry");
      setUrlErrorModal({ kind: "invalidCoords", value: parsed.rawCoords });
      setUrlBootstrapDone(true);
      return;
    }

    const effectiveBand = parsed.options.band ?? band;
    const effectiveSize = parsed.options.size ?? size;
    const effectiveStretch = parsed.options.stretch ?? stretch;
    const effectiveCmap = parsed.options.colormap ?? colormap;
    const effectiveZodi = parsed.options.subtractZodi ?? subtractZodi;

    if (parsed.options.band) setBand(parsed.options.band);
    if (parsed.options.size) setSize(parsed.options.size);
    if (parsed.options.stretch) setStretch(parsed.options.stretch);
    if (parsed.options.colormap) setColormap(parsed.options.colormap);
    if (parsed.options.subtractZodi !== undefined) setSubtractZodi(parsed.options.subtractZodi);

    if (parsed.kind === "coords") {
      const effectiveCol = parsed.options.collection ?? collectionMode;
      if (parsed.options.collection) setCollectionMode(parsed.options.collection);

      setRaInput(parsed.ra);
      setDecInput(parsed.dec);
      setActivePresetId(null);
      setResolvedObject(null);
      setTargetName(t.chrono.customSkyPatch);
      setActiveUrlCoords({ ra: parsed.ra, dec: parsed.dec });
      setCurrentScreen("explorer");
      setSecondMapOpen(true);
      setUrlBootstrapDone(true);

      void executeSearch(
        parsed.ra,
        parsed.dec,
        effectiveCol,
        effectiveBand,
        radius,
        effectiveSize
      );
      return;
    }

    // parsed.kind === "target"
    if (!parsed.target) {
      clearUrlState();
      setCurrentScreen("entry");
      setUrlErrorModal({ kind: "invalidTarget", value: "" });
      setUrlBootstrapDone(true);
      return;
    }

    setCurrentScreen("loading");
    setLoadingProgress(35);

    const resolveInitialTarget = async () => {
      const matchingPreset = t.presets.find(
        (p) =>
          p.label.toLowerCase() === parsed.target.toLowerCase() ||
          p.queryName.toLowerCase() === parsed.target.toLowerCase()
      );

      if (matchingPreset) {
        const effectiveCol = parsed.options.collection ?? matchingPreset.collection;
        setActivePresetId(matchingPreset.id);
        setTargetName(matchingPreset.label);
        setRaInput(matchingPreset.ra);
        setDecInput(matchingPreset.dec);
        setCollectionMode(effectiveCol);
        setActiveUrlCoords({ ra: matchingPreset.ra, dec: matchingPreset.dec });

        syncUrlState({
          ra: matchingPreset.ra,
          dec: matchingPreset.dec,
          collection: effectiveCol,
          band: effectiveBand,
          size: effectiveSize,
          stretch: effectiveStretch,
          colormap: effectiveCmap,
          subtractZodi: effectiveZodi,
        });

        try {
          const resolved = await resolveCelestialName(matchingPreset.queryName);
          setResolvedObject(resolved);
        } catch {
          setResolvedObject(null);
        }

        setLoadingProgress(100);
        setCurrentScreen("explorer");
        setSecondMapOpen(true);
        setUrlBootstrapDone(true);
        await executeSearch(
          matchingPreset.ra,
          matchingPreset.dec,
          effectiveCol,
          effectiveBand,
          radius,
          effectiveSize
        );
        return;
      }

      try {
        const resolved = await resolveCelestialName(parsed.target);
        const effectiveCol = parsed.options.collection ?? "spherex_dr1";
        setActivePresetId(null);
        setResolvedObject(resolved);
        setTargetName(resolved.canonicalName);
        setRaInput(resolved.raHms);
        setDecInput(resolved.decDms);
        setCollectionMode(effectiveCol);
        setActiveUrlCoords({ ra: resolved.raHms, dec: resolved.decDms });

        syncUrlState({
          ra: resolved.raHms,
          dec: resolved.decDms,
          collection: effectiveCol,
          band: effectiveBand,
          size: effectiveSize,
          stretch: effectiveStretch,
          colormap: effectiveCmap,
          subtractZodi: effectiveZodi,
        });

        setLoadingProgress(100);
        setCurrentScreen("explorer");
        setSecondMapOpen(true);
        setUrlBootstrapDone(true);
        await executeSearch(
          resolved.raHms,
          resolved.decDms,
          effectiveCol,
          effectiveBand,
          radius,
          effectiveSize
        );
      } catch {
        clearUrlState();
        setCurrentScreen("entry");
        setUrlErrorModal({ kind: "invalidTarget", value: parsed.target });
        setUrlBootstrapDone(true);
      }
    };

    void resolveInitialTarget();
  }, [
    band,
    collectionMode,
    colormap,
    executeSearch,
    radius,
    size,
    stretch,
    subtractZodi,
    t.chrono.customSkyPatch,
    t.presets,
  ]);

  // URL State: Keep browser URL synced with active explorer coordinates & display settings
  useEffect(() => {
    if (!urlBootstrapDone || currentScreen !== "explorer" || !activeUrlCoords) return;
    syncUrlState({
      ra: activeUrlCoords.ra,
      dec: activeUrlCoords.dec,
      collection: collectionMode,
      band,
      size,
      stretch,
      colormap,
      subtractZodi,
    });
  }, [
    urlBootstrapDone,
    currentScreen,
    activeUrlCoords,
    collectionMode,
    band,
    size,
    stretch,
    colormap,
    subtractZodi,
  ]);

  // Dismiss URL validation modal with Escape
  useEffect(() => {
    if (!urlErrorModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUrlErrorModal(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [urlErrorModal]);

  // Launch from Screen 1 (Entry) -> Warp + Screen 2 (Loading) -> Screen 3 (Explorer)
  const launchExplorer = useCallback(async () => {
    setWarping(true);
    const raDeg = parseRA(raInput);
    const decDeg = parseDec(decInput);
    const warpTarget = raDeg !== null && decDeg !== null ? { ra: raDeg, dec: decDeg } : null;
    const warpPromise = cosmicBgRef.current?.warpTo(warpTarget, 1200) ?? Promise.resolve();

    setCurrentScreen("loading");
    setLoadingProgress(25);

    const searchPromise = versions
      ? Promise.resolve()
      : executeSearch(raInput, decInput, collectionMode, band, radius, size);

    const stepTimer = window.setTimeout(() => {
      setLoadingProgress(85);
    }, 320);

    await Promise.all([
      warpPromise,
      Promise.race([
        searchPromise,
        new Promise((resolve) => window.setTimeout(resolve, 1400)),
      ]),
    ]);

    window.clearTimeout(stepTimer);
    setLoadingProgress(100);
    setWarping(false);

    window.setTimeout(() => {
      setCurrentScreen("explorer");
    }, 200);
  }, [versions, executeSearch, raInput, decInput, collectionMode, band, radius, size]);

  const launchToCoords = useCallback(
    async (params: {
      ra: string;
      dec: string;
      raDeg: number;
      decDeg: number;
      targetLabel?: string;
      preset?: TargetPreset | null;
      resolved?: ResolvedCelestialObject | null;
    }) => {
      setWarping(true);
      const nextCollection = params.preset?.collection ?? collectionMode;
      setRaInput(params.ra);
      setDecInput(params.dec);
      setActivePresetId(params.preset?.id ?? null);
      setResolvedObject(params.resolved ?? null);
      setTargetName(
        params.targetLabel ?? params.preset?.label ?? t.chrono.customSkyPatch
      );
      if (params.preset?.collection) {
        setCollectionMode(params.preset.collection);
      }
      setSecondMapOpen(true);

      const warpPromise =
        cosmicBgRef.current?.warpTo({ ra: params.raDeg, dec: params.decDeg }, 1200) ??
        Promise.resolve();

      setCurrentScreen("loading");
      setLoadingProgress(25);

      const searchPromise = executeSearch(
        params.ra,
        params.dec,
        nextCollection,
        band,
        radius,
        size
      );

      const stepTimer = window.setTimeout(() => {
        setLoadingProgress(85);
      }, 320);

      await Promise.all([
        warpPromise,
        Promise.race([
          searchPromise,
          new Promise((resolve) => window.setTimeout(resolve, 1400)),
        ]),
      ]);

      window.clearTimeout(stepTimer);
      setLoadingProgress(100);
      setWarping(false);

      window.setTimeout(() => {
        setCurrentScreen("explorer");
      }, 200);
    },
    [band, collectionMode, executeSearch, radius, size, t.chrono.customSkyPatch]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActivePresetId(null);
    setTargetName(t.chrono.customSkyPatch);
    setSecondMapOpen(true);
    void executeSearch(raInput, decInput, collectionMode, band, radius, size);
  };

  const handleSubmitCoords = useCallback(
    (raStr: string, decStr: string) => {
      setActivePresetId(null);
      setResolvedObject(null);
      setTargetName(t.chrono.customSkyPatch);
      setSecondMapOpen(true);
      void executeSearch(raStr, decStr, collectionMode, band, radius, size);
    },
    [band, collectionMode, executeSearch, radius, size, t.chrono.customSkyPatch]
  );

  const handleSelectPreset = useCallback(
    async (preset: TargetPreset) => {
      setActivePresetId(preset.id);
      setTargetName(preset.label);
      setRaInput(preset.ra);
      setDecInput(preset.dec);
      setCollectionMode(preset.collection);
      setSecondMapOpen(true);

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

      if (matchingPreset) {
        setTargetName(matchingPreset.label);
        setRaInput(matchingPreset.ra);
        setDecInput(matchingPreset.dec);
        setCollectionMode(matchingPreset.collection);
        setSecondMapOpen(true);
        try {
          const resolved = await resolveCelestialName(matchingPreset.queryName);
          setResolvedObject(resolved);
        } catch {
          setResolvedObject(null);
        } finally {
          setResolvingName(false);
        }
        await executeSearch(
          matchingPreset.ra,
          matchingPreset.dec,
          matchingPreset.collection,
          band,
          radius,
          size
        );
        return;
      }

      try {
        const resolved = await resolveCelestialName(name);
        setResolvedObject(resolved);
        setTargetName(resolved.canonicalName);
        setRaInput(resolved.raHms);
        setDecInput(resolved.decDms);
        setCollectionMode("spherex_dr1");
        setSecondMapOpen(true);
        await executeSearch(resolved.raHms, resolved.decDms, "spherex_dr1", band, radius, size);
      } catch {
        setStatusState({ type: "objectNotFound", name });
      } finally {
        setResolvingName(false);
      }
    },
    [band, executeSearch, radius, size, t.presets]
  );

  const handleToggleMolecule = useCallback(
    (mol: MoleculeSignature) => {
      setActiveMolecules((prev) => {
        const next = new Set(prev);
        if (next.has(mol.id)) {
          next.delete(mol.id);
        } else {
          next.add(mol.id);
          // Tune HiPS channel to closest wavelength for this molecule
          let bestIdx = 0;
          let bestDiff = Infinity;
          SPHEREX_HIPS_WAVELENGTHS_UM.forEach((w, idx) => {
            const diff = Math.abs(w - mol.wavelengthUm);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestIdx = idx;
            }
          });
          setExternalChannelIdx(bestIdx);

          // If observations include the molecule's detector band, select it
          const matchingObsIdx = observations.findIndex((o) => o.bandpass === mol.band);
          if (matchingObsIdx >= 0) {
            setSelectedIdx(matchingObsIdx);
          }
        }
        return next;
      });
    },
    [observations]
  );

  const handleSelectCollection = (col: SpherexCollectionId) => {
    setActiveCollection(col);
    setSelectedIdx(0);
  };

  const handleSelectVersionObservation = useCallback(
    (col: SpherexCollectionId, targetObs: SpherexObservation) => {
      setActiveCollection(col);
      const colObs = versions?.[col]?.observations ?? [];
      const foundIdx = colObs.findIndex(
        (o) =>
          (o.access_url && targetObs.access_url && o.access_url === targetObs.access_url) ||
          (o.obs_id === targetObs.obs_id && o.bandpass === targetObs.bandpass)
      );
      setSelectedIdx(foundIdx >= 0 ? foundIdx : 0);
    },
    [versions]
  );

  const handleChangeFov = useCallback((newSize: number) => {
    const clamped = clampCutoutFov(newSize);
    setSize(String(clamped));
    setLastCoords((prev) => (prev ? { ...prev, size: clamped } : prev));
  }, []);

  const handleQueryAtCoords = useCallback(
    (raDeg: number, decDeg: number) => {
      const raStr = raDeg.toFixed(5);
      const decStr = decDeg.toFixed(5);
      setActivePresetId(null);
      setResolvedObject(null);
      setTargetName(t.chrono.customSkyPatch);
      setRaInput(raStr);
      setDecInput(decStr);
      setSecondMapOpen(true);
      void executeSearch(raStr, decStr, collectionMode, band, radius, size);
    },
    [band, collectionMode, executeSearch, radius, size, t.chrono.customSkyPatch]
  );

  const selectedObs = observations[selectedIdx] ?? null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#080B10] text-slate-100 select-none">
      {/* Interactive 3D Galaxy + Starfield + Celestial Graticule Canvas */}
      <CosmicBackground
        ref={cosmicBgRef}
        mode={currentScreen === "explorer" ? "explorer" : "gate"}
        onCursorSky={setCursorSky}
      />

      {/* Top-Left Back & Sidebar Toggle Pills (Explorer only) */}
      {currentScreen === "explorer" && (
        <div className="fixed top-6 left-5 sm:left-7 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setCurrentScreen("entry");
            }}
            aria-label={t.chrono.backButton}
            title={t.chrono.backButton}
            className="btn-press glass-panel rounded-full px-3.5 py-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-white hover:border-[#00D2FF]/45 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#00D2FF]" />
            <span>{t.chrono.backButton}</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? t.chrono.togglePanelClose : t.chrono.togglePanelOpen}
            title={sidebarOpen ? t.chrono.togglePanelClose : t.chrono.togglePanelOpen}
            className={`btn-press glass-panel rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs font-medium cursor-pointer transition-colors ${
              sidebarOpen
                ? "border-[#00D2FF]/60 text-[#00D2FF] bg-[#00D2FF]/10"
                : "text-slate-200 hover:text-white hover:border-[#00D2FF]/45"
            }`}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-3.5 h-3.5 text-[#00D2FF]" />
            ) : (
              <PanelLeftOpen className="w-3.5 h-3.5 text-[#00D2FF]" />
            )}
            <span>{t.chrono.panelLabel}</span>
          </button>
        </div>
      )}

      {/* Persistent Top-Right Language Pill */}
      <div className="fixed top-6 right-7 z-30">
        <LanguageSelector />
      </div>

      {/* ===================================================================== */}
      {/* SCREEN 1: ENTRY (SpaceGate — 3D + HUD + 3 Interactive Blocks)         */}
      {/* ===================================================================== */}
      <section
        id="screen-entry"
        className={`screen ${
          currentScreen === "entry" ? "is-active" : "is-hidden"
        } flex-col items-center justify-center`}
      >
        <SpaceGate
          raInput={raInput}
          setRaInput={setRaInput}
          decInput={decInput}
          setDecInput={setDecInput}
          cursorSky={cursorSky}
          warping={warping}
          loading={loading}
          withBackground={false}
          onExploreFree={() => void launchExplorer()}
          onLaunchToCoords={(params) => void launchToCoords(params)}
        />
      </section>

      {/* ===================================================================== */}
      {/* SCREEN 2: LOADING TRANSITION (Analyzing space... with Rocket)         */}
      {/* ===================================================================== */}
      <section
        id="screen-loading"
        className={`screen ${
          currentScreen === "loading" ? "is-active" : "is-hidden"
        } items-center justify-center px-6`}
      >
        <div className="glass-panel rounded-[24px] px-10 py-8 flex flex-col items-center text-center min-w-[300px]">
          {/* Animated Launching Rocket */}
          <div className="relative mb-5 flex items-center justify-center">
            <div className="rocket-animate text-[#00D2FF] drop-shadow-[0_0_20px_rgba(0,210,255,0.6)]">
              <svg
                className="w-12 h-12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path
                  className="flame-animate"
                  d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"
                  stroke="#FFB703"
                />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
              </svg>
            </div>
          </div>

          <p className="text-base font-medium tracking-tight text-white mb-4">
            {t.chrono.loadingLabel}
          </p>

          {/* Razor-thin progress bar */}
          <div className="w-56 h-[3px] rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#00D2FF] shadow-[0_0_12px_#00D2FF] transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SCREEN 3: MAIN EXPLORER (Sidebar + Live Sky Viewport(s) + Epoch Bar)  */}
      {/* ===================================================================== */}
      <section
        id="screen-explorer"
        className={`screen ${
          currentScreen === "explorer" ? "is-active" : "is-hidden"
        } p-5 pt-16 sm:p-7 sm:pt-16 flex-col lg:flex-row`}
      >
        <div
          aria-hidden={!sidebarOpen}
          className={`shrink-0 overflow-hidden transition-[width,max-height,margin,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            sidebarOpen
              ? "w-full max-h-[46vh] mb-5 opacity-100 lg:w-[310px] lg:max-h-full lg:mb-0 lg:mr-5"
              : "w-full max-h-0 mb-0 opacity-0 pointer-events-none lg:w-0 lg:max-h-full lg:mb-0 lg:mr-0"
          }`}
        >
          <div
            className={`w-full lg:w-[310px] h-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              sidebarOpen
                ? "translate-y-0 lg:translate-x-0"
                : "-translate-y-3 lg:translate-y-0 lg:-translate-x-5"
            }`}
          >
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
              totalFound={totalFound}
              activeMolecules={activeMolecules}
              onToggleMolecule={handleToggleMolecule}
              onClose={() => setSidebarOpen(false)}
              onChangeFov={handleChangeFov}
              onSubmitCoords={handleSubmitCoords}
              onSubmit={handleSubmit}
              onSelectPreset={handleSelectPreset}
              onSearchCelestialName={handleSearchCelestialName}
              onOpenExposuresDrawer={() => setShowExposuresModal(true)}
            />
          </div>
        </div>

        <ViewerPanel
          selectedObs={selectedObs}
          cutout={cutout}
          cutoutLoading={cutoutLoading}
          lastCoords={lastCoords}
          targetName={targetName}
          showCrosshair={showCrosshair}
          status={status}
          siaUrl={siaUrl}
          resolvedObject={resolvedObject}
          versions={versions}
          activeCollection={activeCollection}
          stretch={stretch}
          colormap={colormap}
          subtractZodi={subtractZodi}
          secondMapOpen={secondMapOpen}
          onToggleSecondMap={setSecondMapOpen}
          externalChannelIdx={externalChannelIdx}
          onChangeFov={handleChangeFov}
          onSelectVersionObservation={handleSelectVersionObservation}
          onQueryAtCoords={handleQueryAtCoords}
        />
      </section>

      {/* Optional FITS Exposures Drawer / Modal */}
      {showExposuresModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-end p-4">
          <div className="relative h-full max-h-[92vh] flex flex-col">
            <button
              type="button"
              onClick={() => setShowExposuresModal(false)}
              className="btn-press glass-panel absolute -top-2 -left-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-slate-200 hover:text-white cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <ObservationsPanel
              observations={observations}
              totalFound={totalFound}
              selectedIdx={selectedIdx}
              onSelect={(idx) => {
                setSelectedIdx(idx);
                setSecondMapOpen(true);
                setShowExposuresModal(false);
              }}
              loading={loading}
              versions={versions}
              activeCollection={activeCollection}
              onSelectCollection={handleSelectCollection}
            />
          </div>
        </div>
      )}
      {/* Invalid URL target / coordinates popup modal */}
      {urlErrorModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="url-error-modal-title"
          onClick={() => setUrlErrorModal(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel relative w-full max-w-md rounded-2xl p-6 border border-rose-500/40 shadow-[0_0_40px_rgba(244,63,94,0.2)]"
          >
            <button
              type="button"
              onClick={() => setUrlErrorModal(null)}
              aria-label={t.urlError.dismissButton}
              className="btn-press absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4">
              <div className="shrink-0 w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0 pr-4">
                <h3
                  id="url-error-modal-title"
                  className="text-base font-semibold text-white mb-1.5"
                >
                  {urlErrorModal.kind === "invalidTarget"
                    ? t.urlError.invalidTargetTitle
                    : t.urlError.invalidCoordsTitle}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed break-words">
                  {urlErrorModal.kind === "invalidTarget"
                    ? t.urlError.invalidTargetMessage(urlErrorModal.value)
                    : t.urlError.invalidCoordsMessage(urlErrorModal.value)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setUrlErrorModal(null)}
                className="btn-press px-5 py-2 rounded-xl bg-[#00D2FF]/15 border border-[#00D2FF]/60 text-[#00D2FF] text-sm font-medium hover:bg-[#00D2FF]/25 transition-colors cursor-pointer"
              >
                {t.urlError.dismissButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
