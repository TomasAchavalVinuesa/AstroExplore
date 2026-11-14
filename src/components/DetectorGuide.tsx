import React, { useState } from "react";
import { DETECTORS_METADATA, parseDetectorId } from "../lib/detectors";
import type { DetectorId } from "../lib/types";
import { useLanguage } from "../i18n/LanguageContext";

interface DetectorGuideProps {
  currentBand: string;
  onSelectBand: (band: string) => void;
  simpleMode?: boolean;
  selectedObsBandpass?: string;
}

export const DetectorGuide: React.FC<DetectorGuideProps> = ({
  currentBand,
  onSelectBand,
  simpleMode = false,
  selectedObsBandpass,
}) => {
  const { language } = useLanguage();
  const isEn = language === "en";

  const activeDetId =
    currentBand !== "all"
      ? (currentBand as DetectorId)
      : selectedObsBandpass
        ? parseDetectorId(selectedObsBandpass) || "D1"
        : "D1";

  const [hoveredDetId, setHoveredDetId] = useState<DetectorId | null>(null);
  const displayDet = DETECTORS_METADATA[hoveredDetId || activeDetId] || DETECTORS_METADATA.D1;

  const detectorKeys: DetectorId[] = ["D1", "D2", "D3", "D4", "D5", "D6"];

  const name = isEn && displayDet.nameEn ? displayDet.nameEn : displayDet.name;
  const desc = isEn
    ? simpleMode
      ? displayDet.simpleDescriptionEn || displayDet.simpleDescription
      : displayDet.scientificDescriptionEn || displayDet.scientificDescription
    : simpleMode
      ? displayDet.simpleDescription
      : displayDet.scientificDescription;
  const molecules =
    isEn && displayDet.targetMoleculesEn ? displayDet.targetMoleculesEn : displayDet.targetMolecules;

  return (
    <div className="detector-guide-container">
      <div className="detector-guide-header">
        <div>
          <h4>
            {isEn
              ? simpleMode
                ? "Infrared Detectors Guide (102 Bands)"
                : "SPHEREx Spectral Architecture (6 H2RG Detectors · 102 LVF Bands)"
              : simpleMode
                ? "Guía de Detectores Infrarrojos (102 Bandas)"
                : "Arquitectura Espectral SPHEREx (6 Detectores H2RG · 102 Bandas LVF)"}
          </h4>
          <p className="detector-subtitle">
            {isEn
              ? simpleMode
                ? "SPHEREx splits the thermal infrared spectrum into 6 camera arrays. Select one to explore its physics:"
                : "6 HgCdTe 2048×2048 focal planes with Linear Variable Filters (LVF). Each samples 17 contiguous infrared bands."
              : simpleMode
                ? "SPHEREx divide el arcoíris térmico en 6 cámaras. Seleccioná una para explorar su física:"
                : "6 arreglos HgCdTe de 2048×2048 con filtros lineales variables (LVF). Cada uno muestrea 17 bandas continuas."}
          </p>
        </div>
        <div
          className="detector-snr-badge"
          title={
            isEn
              ? "Theoretical quadratic co-addition SNR gain"
              : "Ganancia teórica de co-adición cuadrática"
          }
        >
          <span>{isEn ? "SNR Gain:" : "Ganancia SNR:"}</span>
          <strong>+312% (√17 ≈ 4.12×)</strong>
        </div>
      </div>

      {/* Spectral bar visualization */}
      <div className="spectrum-bar">
        {detectorKeys.map((id) => {
          const det = DETECTORS_METADATA[id];
          const isSelected = currentBand === id || (!hoveredDetId && activeDetId === id);
          return (
            <button
              key={id}
              type="button"
              className={`spectrum-segment ${isSelected ? "selected" : ""}`}
              style={{
                background: isSelected
                  ? det.colorHex
                  : `linear-gradient(180deg, ${det.colorHex}22 0%, ${det.colorHex}44 100%)`,
                borderColor: isSelected ? "#ffffff" : `${det.colorHex}88`,
                color: isSelected ? "#000000" : "#ffffff",
              }}
              onMouseEnter={() => setHoveredDetId(id)}
              onMouseLeave={() => setHoveredDetId(null)}
              onClick={() => onSelectBand(currentBand === id ? "all" : id)}
            >
              <div className="spectrum-segment-id">{id}</div>
              <div className="spectrum-segment-wave">
                {det.waveMin}–{det.waveMax} µm
              </div>
            </button>
          );
        })}
      </div>

      {/* Details Card */}
      <div
        className="detector-detail-card"
        style={{ borderLeftColor: displayDet.colorHex }}
      >
        <div className="detector-detail-top">
          <div className="detector-title-row">
            <span
              className="detector-chip-tag"
              style={{
                backgroundColor: `${displayDet.colorHex}25`,
                color: displayDet.colorHex,
                borderColor: displayDet.colorHex,
              }}
            >
              {displayDet.id} · {displayDet.bandsCount} {isEn ? "bands" : "bandas"}
            </span>
            <strong className="detector-name">{name}</strong>
          </div>
          <div className="detector-resolving">
            <span>{isEn ? "Resolving Power:" : "Resolución:"}</span>{" "}
            <code>{displayDet.resolvingPower}</code>
          </div>
        </div>

        <p className="detector-desc">{desc}</p>

        <div className="detector-pills-row">
          <div className="detector-signatures">
            <span className="pills-label">
              {isEn
                ? simpleMode
                  ? "Key Signatures:"
                  : "Diagnostic Signatures:"
                : simpleMode
                  ? "Firmas clave:"
                  : "Firmas diagnósticas:"}
            </span>
            {molecules.map((mol) => (
              <span key={mol} className="molecule-pill">
                {mol}
              </span>
            ))}
          </div>
          <div className="detector-teff">
            <span className="pills-label">
              {isEn ? "Thermal Regime (Wien):" : "Régimen térmico (Wien):"}
            </span>
            <code className="teff-badge">{displayDet.teffKelvin}</code>
          </div>
        </div>
      </div>
    </div>
  );
};
