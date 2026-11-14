"use client";

import React, { useCallback, useEffect, useState } from "react";
import { parseDec, parseRA } from "@/lib/coordinates";
import type {
  ColormapName,
  CutoutResponse,
  SearchResponse,
  SpherexObservation,
  StretchMode,
} from "@/lib/types";

interface PresetTarget {
  label: string;
  ra: string;
  dec: string;
  collection: string;
}

const PRESETS: PresetTarget[] = [
  { label: "Objetivo Test (HMS/DMS)", ra: "08h55m10.831s", dec: "-7d14m42.53s", collection: "spherex_dr1" },
  { label: "Galaxia M101", ra: "210.80227", dec: "54.34895", collection: "spherex_dr1" },
  { label: "Vela / Carina", ra: "127.69444", dec: "-39.17760", collection: "spherex_dr1" },
  { label: "Campo Profundo NEP", ra: "270.0", dec: "66.0", collection: "spherex_dr1_deep" },
];

export default function HomePage() {
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
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const [siaUrl, setSiaUrl] = useState("");
  const [totalFound, setTotalFound] = useState(0);
  const [observations, setObservations] = useState<SpherexObservation[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [cutout, setCutout] = useState<CutoutResponse | null>(null);
  const [lastCoords, setLastCoords] = useState<{ ra: number; dec: number; size: number } | null>(
    null
  );

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
      setStatus({
        text: `Descargando y renderizando recorte FITS (${obs.bandpass} — ${obs.obs_id})...`,
        isError: false,
      });

      const qs = new URLSearchParams({
        access_url: obs.access_url,
        ra: String(raDeg),
        dec: String(decDeg),
        size: String(sizeDeg),
        stretch: stretchVal,
        colormap: cmapVal,
        subtract_zodi: String(zodiVal),
      });

      const res = await fetch(`/api/cutout?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "No se pudo obtener el recorte FITS.");
      }
      setCutout(data as CutoutResponse);
      setStatus(null);
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
        setStatus({
          text: "Ascensión Recta inválida. Usa grados (0–360) o formato HMS (ej. 08h55m10.831s).",
          isError: true,
        });
        return;
      }
      if (decDeg === null) {
        setStatus({
          text: "Declinación inválida. Usa grados (-90 a +90) o formato DMS (ej. -7d14m42.53s).",
          isError: true,
        });
        return;
      }

      setLoading(true);
      setStatus({
        text: `Consultando IRSA SIA en RA=${raDeg.toFixed(5)}°, Dec=${decDeg.toFixed(5)}° (${col})...`,
        isError: false,
      });

      try {
        const qs = new URLSearchParams({
          ra: String(raDeg),
          dec: String(decDeg),
          radius: String(radiusNum),
          collection: col,
          band: bandVal,
        });
        const res = await fetch(`/api/search?${qs.toString()}`);
        const data = (await res.json()) as SearchResponse & { detail?: string };
        if (!res.ok) {
          throw new Error(data.detail || "Error en la consulta SIA.");
        }

        setSiaUrl(data.sia_url);
        setTotalFound(data.total_found);
        setObservations(data.observations);
        setSelectedIdx(0);
        setLastCoords({ ra: raDeg, dec: decDeg, size: sizeNum });

        if (data.observations.length === 0) {
          setCutout(null);
          setStatus({
            text: `No se encontraron exposiciones en "${col}" para RA=${raDeg.toFixed(4)}°, Dec=${decDeg.toFixed(4)}°.`,
            isError: true,
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
        setStatus({
          text: err instanceof Error ? err.message : "Error inesperado consultando IRSA.",
          isError: true,
        });
      } finally {
        setLoading(false);
      }
    },
    [colormap, loadCutout, stretch, subtractZodi]
  );

  // Re-render cached FITS cutout immediately when display controls change
  useEffect(() => {
    const obs = observations[selectedIdx];
    if (!obs || !lastCoords) return;
    loadCutout(obs, lastCoords.ra, lastCoords.dec, lastCoords.size, stretch, colormap, subtractZodi).catch(
      (err) => {
        setStatus({
          text: err instanceof Error ? err.message : "Error actualizando visualización.",
          isError: true,
        });
      }
    );
  }, [stretch, colormap, subtractZodi, selectedIdx, observations, lastCoords, loadCutout]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(raInput, decInput, collection, band, radius, size);
  };

  const selectedObs = observations[selectedIdx] ?? null;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-badge">SPHEREx</div>
          <div>
            <h1>Explorador de Imágenes SPHEREx</h1>
            <p className="subtitle">
              Next.js + TypeScript · APIs oficiales NASA/IPAC IRSA (SIA &amp; IBE Cutouts)
            </p>
          </div>
        </div>
        <div className="api-links">
          <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noopener noreferrer">
            IRSA SPHEREx
          </a>
          <a href="https://caltech-ipac.github.io/irsa-tutorials/spherex/" target="_blank" rel="noopener noreferrer">
            Tutoriales IRSA
          </a>
        </div>
      </header>

      <main className="layout">
        <aside className="panel">
          <h2>Coordenadas Celestes (ICRS)</h2>
          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="ra-input">Ascensión Recta (RA)</label>
                <input
                  id="ra-input"
                  type="text"
                  value={raInput}
                  onChange={(e) => setRaInput(e.target.value)}
                  placeholder="133.795 o 08h55m10.831s"
                  required
                />
                <small>Grados (0–360) o HMS</small>
              </div>
              <div className="field">
                <label htmlFor="dec-input">Declinación (Dec)</label>
                <input
                  id="dec-input"
                  type="text"
                  value={decInput}
                  onChange={(e) => setDecInput(e.target.value)}
                  placeholder="-7.245 o -7d14m42.53s"
                  required
                />
                <small>Grados (-90 a +90) o DMS</small>
              </div>
            </div>

            <div className="presets">
              <span className="presets-label">Objetivos de prueba:</span>
              <div className="preset-chips">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setRaInput(p.ra);
                      setDecInput(p.dec);
                      setCollection(p.collection);
                      executeSearch(p.ra, p.dec, p.collection, band, radius, size);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <hr className="divider" />

            <h3>Parámetros de Consulta</h3>
            <div className="field-row">
              <div className="field">
                <label htmlFor="collection-select">Colección IRSA</label>
                <select
                  id="collection-select"
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                >
                  <option value="spherex_dr1">spherex_dr1 (Wide DR1)</option>
                  <option value="spherex_dr1_deep">spherex_dr1_deep (Deep DR1)</option>
                  <option value="spherex_qr3">spherex_qr3 (Quick Release 3)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="band-select">Detector / Banda</label>
                <select id="band-select" value={band} onChange={(e) => setBand(e.target.value)}>
                  <option value="all">Todas (D1–D6)</option>
                  <option value="D1">D1 (0.75–1.12 µm)</option>
                  <option value="D2">D2 (1.11–1.64 µm)</option>
                  <option value="D3">D3 (1.63–2.42 µm)</option>
                  <option value="D4">D4 (2.40–3.85 µm)</option>
                  <option value="D5">D5 (3.81–4.43 µm)</option>
                  <option value="D6">D6 (4.42–5.00 µm)</option>
                </select>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="radius-input">Radio búsqueda (°)</label>
                <input
                  id="radius-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="2"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="size-input">Tamaño recorte (°)</label>
                <input
                  id="size-input"
                  type="number"
                  step="0.01"
                  min="0.02"
                  max="1"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Consultando IRSA..." : "Consultar Imagen SPHEREx"}
            </button>
          </form>

          <hr className="divider" />

          <h3>Opciones de Visualización</h3>
          <div className="field-row">
            <div className="field">
              <label htmlFor="stretch-select">Escala de flujo</label>
              <select
                id="stretch-select"
                value={stretch}
                onChange={(e) => setStretch(e.target.value as StretchMode)}
              >
                <option value="asinh">Asinh (Recomendado)</option>
                <option value="log">Logarítmica</option>
                <option value="sqrt">Raíz cuadrada</option>
                <option value="linear">Lineal</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="colormap-select">Paleta de color</label>
              <select
                id="colormap-select"
                value={colormap}
                onChange={(e) => setColormap(e.target.value as ColormapName)}
              >
                <option value="inferno">Inferno</option>
                <option value="viridis">Viridis</option>
                <option value="plasma">Plasma</option>
                <option value="magma">Magma</option>
                <option value="gray">Escala de grises</option>
              </select>
            </div>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={subtractZodi}
              onChange={(e) => setSubtractZodi(e.target.checked)}
            />
            <span>Restar luz zodiacal (extensión ZODI del FITS)</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showCrosshair}
              onChange={(e) => setShowCrosshair(e.target.checked)}
            />
            <span>Mostrar mira en la coordenada consultada</span>
          </label>
        </aside>

        <section className="panel">
          <div className="viewer-header">
            <div>
              <h2>
                {selectedObs
                  ? `${selectedObs.bandpass} · ${selectedObs.obs_id}`
                  : "Visor de Recorte Espectral"}
              </h2>
              <p className="muted">
                {lastCoords && selectedObs
                  ? `Centro: RA ${lastCoords.ra.toFixed(5)}°, Dec ${lastCoords.dec.toFixed(5)}° · Recorte ${lastCoords.size}°`
                  : 'Ingresa RA y Dec (decimales o HMS/DMS) y presiona "Consultar Imagen SPHEREx".'}
              </p>
            </div>
            {cutout && (
              <a
                className="btn-secondary"
                href={cutout.fits_cutout_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Descargar FITS
              </a>
            )}
          </div>

          {status && (
            <div className={`status-banner ${status.isError ? "error" : ""}`}>{status.text}</div>
          )}

          <div className="canvas-wrapper">
            {cutout ? (
              <>
                <img
                  src={`data:image/png;base64,${cutout.image_base64}`}
                  alt="Recorte SPHEREx"
                  className="cutout-img"
                />
                {showCrosshair && <div className="crosshair" />}
              </>
            ) : (
              <div className="placeholder">
                <div className="placeholder-icon">✦</div>
                <p>Esperando consulta de coordenadas...</p>
              </div>
            )}
          </div>

          {cutout && selectedObs && (
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Banda / Detector</span>
                <strong>{selectedObs.bandpass || "—"}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Longitud de onda</span>
                <strong>
                  {selectedObs.em_min_um !== null && selectedObs.em_max_um !== null
                    ? `${selectedObs.em_min_um} – ${selectedObs.em_max_um} µm`
                    : "—"}
                </strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Dimensiones</span>
                <strong>
                  {cutout.width} × {cutout.height} px
                </strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Mediana / Máx</span>
                <strong>
                  {cutout.stats.median} / {cutout.stats.max} {cutout.stats.unit}
                </strong>
              </div>
            </div>
          )}

          {cutout && siaUrl && (
            <div className="api-trace">
              <div>
                <strong>SIA Query:</strong> <code>{siaUrl}</code>
              </div>
              <div>
                <strong>IBE Cutout:</strong> <code>{cutout.fits_cutout_url}</code>
              </div>
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="results-header">
            <h2>Exposiciones Encontradas</h2>
            <span className="badge">{totalFound}</span>
          </div>
          <div className="observations-list">
            {observations.length === 0 ? (
              <p className="muted">
                Aquí aparecerán los archivos FITS de SPHEREx que cubren tus coordenadas.
              </p>
            ) : (
              observations.map((obs, idx) => (
                <button
                  key={`${obs.obs_id}-${obs.bandpass}-${idx}`}
                  type="button"
                  className={`obs-item ${idx === selectedIdx ? "active" : ""}`}
                  onClick={() => setSelectedIdx(idx)}
                >
                  <div className="obs-top">
                    <span className="obs-band">{obs.bandpass || "SPHEREx"}</span>
                    <span className="obs-wave">
                      {obs.em_min_um !== null && obs.em_max_um !== null
                        ? `${obs.em_min_um}–${obs.em_max_um} µm`
                        : "IR"}
                    </span>
                  </div>
                  <div className="obs-id">{obs.obs_id}</div>
                </button>
              ))
            )}
          </div>
        </aside>
      </main>
    </>
  );
}
