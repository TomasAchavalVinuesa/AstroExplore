import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "./components/Navbar";
import { ControlsPanel } from "./components/ControlsPanel";
import { ViewerPanel } from "./components/ViewerPanel";
import { ObservationsPanel } from "./components/ObservationsPanel";
import { parseDec, parseRA } from "./lib/coordinates";
import { getRenderedCutout, querySpherexSIA } from "./lib/irsa";
import { useLanguage } from "./i18n/LanguageContext";
import type { Translations } from "./i18n/translations";
import type {
  ColormapName,
  RenderedCutout,
  SpherexObservation,
  StretchMode,
  TargetPreset,
} from "./lib/types";

type StatusState =
  | { type: "downloadingFits"; band: string; id: string }
  | { type: "invalidRa" }
  | { type: "invalidDec" }
  | { type: "queryingSia"; ra: string; dec: string; collection: string }
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
  const [collection, setCollection] = useState("spherex_dr1");
  const [band, setBand] = useState("all");
  const [radius, setRadius] = useState("0.05");
  const [size, setSize] = useState("0.15");

  const [stretch, setStretch] = useState<StretchMode>("asinh");
  const [colormap, setColormap] = useState<ColormapName>("inferno");
  const [subtractZodi, setSubtractZodi] = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(true);

  const [loading, setLoading] = useState(false);
  const [statusState, setStatusState] = useState<StatusState>(null);
  const [siaUrl, setSiaUrl] = useState("");
  const [totalFound, setTotalFound] = useState(0);
  const [observations, setObservations] = useState<SpherexObservation[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [cutout, setCutout] = useState<RenderedCutout | null>(null);
  const [lastCoords, setLastCoords] = useState<{ ra: number; dec: number; size: number } | null>(
    null
  );

  const status = useMemo(() => {
    if (!statusState) return null;
    switch (statusState.type) {
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
      case "noImagesFound":
        return { text: t.status.noImagesFound(statusState), isError: true };
      case "customError":
        return { text: translateErrorMessage(statusState.message, t), isError: true };
    }
  }, [statusState, t]);

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
        });
        setCutout(rendered);
        setStatusState(null);
      } catch (err) {
        setStatusState({
          type: "customError",
          message: err instanceof Error ? err.message : "",
        });
      }
    },
    []
  );

  const executeSearch = useCallback(
    async (
      rawRa: string,
      rawDec: string,
      col: string,
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
        collection: col,
      });

      try {
        const data = await querySpherexSIA({
          ra: raDeg,
          dec: decDeg,
          radius: radiusNum,
          collection: col,
          band: bandVal,
        });

        setSiaUrl(data.sia_url);
        setTotalFound(data.total_found);
        setObservations(data.observations);
        setSelectedIdx(0);
        setLastCoords({ ra: raDeg, dec: decDeg, size: sizeNum });

        if (data.observations.length === 0) {
          setCutout(null);
          setStatusState({
            type: "noImagesFound",
            collection: col,
            ra: raDeg.toFixed(4),
            dec: decDeg.toFixed(4),
          });
          return;
        }

        await loadCutout(
          data.observations[0],
          raDeg,
          decDeg,
          sizeNum,
          stretch,
          colormap,
          subtractZodi
        );
      } catch (err) {
        setStatusState({
          type: "customError",
          message: err instanceof Error ? err.message : "",
        });
      } finally {
        setLoading(false);
      }
    },
    [colormap, loadCutout, stretch, subtractZodi]
  );

  // Cambio instantáneo de escalas de flujo, paleta o zodi sobre el FITS en memoria
  useEffect(() => {
    const obs = observations[selectedIdx];
    if (!obs || !lastCoords) return;
    loadCutout(obs, lastCoords.ra, lastCoords.dec, lastCoords.size, stretch, colormap, subtractZodi);
  }, [stretch, colormap, subtractZodi, selectedIdx, observations, lastCoords, loadCutout]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(raInput, decInput, collection, band, radius, size);
  };

  const handleSelectPreset = (preset: TargetPreset) => {
    setRaInput(preset.ra);
    setDecInput(preset.dec);
    setCollection(preset.collection);
    executeSearch(preset.ra, preset.dec, preset.collection, band, radius, size);
  };

  const selectedObs = observations[selectedIdx] ?? null;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-[340px_1fr_320px] gap-5 items-start">
        <ControlsPanel
          raInput={raInput}
          setRaInput={setRaInput}
          decInput={decInput}
          setDecInput={setDecInput}
          collection={collection}
          setCollection={setCollection}
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
          onSubmit={handleSubmit}
          onSelectPreset={handleSelectPreset}
        />

        <ViewerPanel
          selectedObs={selectedObs}
          cutout={cutout}
          lastCoords={lastCoords}
          showCrosshair={showCrosshair}
          status={status}
          siaUrl={siaUrl}
        />

        <ObservationsPanel
          observations={observations}
          totalFound={totalFound}
          selectedIdx={selectedIdx}
          onSelect={(idx) => setSelectedIdx(idx)}
          loading={loading}
        />
      </main>
    </div>
  );
}
