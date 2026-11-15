/**
 * CHRONO-SPHEREx Astrochemistry Module
 * Formal physical-chemical types for infrared molecular detection and analysis.
 * Complies with SPHEREx DR1/QR3 102-band spectral catalog (0.75 - 5.00 µm).
 */

export type MoleculeId =
  | "H2O_ICE"
  | "H2O_VAPOR"
  | "CH4_METHANE"
  | "CO2_CARBON_DIOXIDE"
  | "CO_CARBON_MONOXIDE"
  | "NH3_AMMONIA"
  | "PAH_ORGANICS"
  | "SILICATES";

export interface MolecularBandDefinition {
  id: MoleculeId;
  commonName: string;
  chemicalFormula: string;
  centerWaveUm: number;
  waveMinUm: number;
  waveMaxUm: number;
  detectorId: "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
  vibrationalMode: string;
  astrophysicalSignificance: string;
  habitabilityContext: string;
  colorHex: string;
  referenceCitation: string;
}

export interface MolecularDetection {
  definition: MolecularBandDefinition;
  observedFlux: number | null;
  continuumFlux: number | null;
  opticalDepthTau: number;
  absorptionDepthPercent: number;
  snr: number;
  isDetected: boolean;
  confidence: "High (≥5σ)" | "Moderate (3-5σ)" | "Tentative (2-3σ)" | "Upper Limit (<2σ)";
}

export type AstronomicalClassification =
  | "VOLATILE_RICH_COLD_BODY"      // Planet X candidate, icy TNO, Kuiper belt dwarf
  | "ULTRACOOL_BROWN_DWARF"         // T/Y Dwarf (WISE 0855, Epsilon Indi B)
  | "COOL_STELLAR_ATMOSPHERE"       // M Dwarf (Barnard's Star)
  | "PROTOPLANETARY_DEBRIS_DISK"    // Young stellar object with circumstellar dust (RW Aurigae)
  | "VARIABLE_PULSATING_AGB"        // Asymptotic Giant Branch / Mira star (R Draconis)
  | "UNCLASSIFIED_CONTINUUM";

export interface AstrochemicalProfile {
  targetName: string;
  coordinates: { ra: number; dec: number };
  totalBandsSampled: number;
  wienTemperatureKelvin: number | null;
  stefanBoltzmannEmittanceWm2: number | null;
  peakWavelengthUm: number | null;
  detections: MolecularDetection[];
  ch4ToCoRatio: number | null;
  thermochemicalState: "Cold Reducing (CH₄ Dominant)" | "Hot / Vertically Mixed (CO Dominant)" | "Equilibrium Transition" | "Undetermined";
  volatileRichnessScore: number; // 0 to 100
  classification: AstronomicalClassification;
  classificationConfidence: number; // 0 to 100%
  executiveConclusion: string;
  academicReportMarkdown: string;
}
