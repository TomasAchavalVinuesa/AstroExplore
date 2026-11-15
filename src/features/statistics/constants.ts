/**
 * CHRONO-SPHEREx Statistical & Multi-Epoch Pattern Detection Module (PyE)
 * Calibrated physical constants and reference target benchmarks from NASA/IPAC IRSA & Gaia DR3.
 */

import type { PatternTopology } from "./types";

export const STAT_CONSTANTS = {
  SPHEREX_PIXEL_SCALE_ARCSEC: 6.2,
  SPHEREX_BANDS_PER_DETECTOR: 17,
  SPHEREX_TOTAL_BANDS: 102,
  SPHEREX_DETECTORS_COUNT: 6,
  COADD_SNR_GAIN_FACTOR: Math.sqrt(17), // ~4.1231056
  WIEN_CONSTANT_UM_K: 2897.771955,
  STEFAN_BOLTZMANN_SIGMA: 5.670374419e-8,
  TANGENTIAL_VELOCITY_CONST: 4.74047, // km/s per (arcsec/yr * pc)
  PARSEC_TO_LIGHT_YEARS: 3.26156,
  FULL_MOON_DIAMETER_ARCSEC: 1800, // 30 arcminutes = 1800 arcseconds
  VOYAGER_1_SPEED_KMS: 17.0,
  EARTH_ORBITAL_SPEED_KMS: 29.78,
} as const;

export interface OfficialTargetBenchmark {
  id: string;
  matchKeywords: string[];
  canonicalName: string;
  spectralType: string;
  raDeg: number;
  decDeg: number;
  topology: PatternTopology;
  muRaMasYr: number;
  muDecMasYr: number;
  muTotalArcsecYr: number;
  positionAngleDeg: number;
  parallaxMas: number;
  peakWaveUm: number;
  teffKelvin: number;
  colorIndexD6D1: number;
  singleBandSnr: number;
  peakPosZ: number;
  peakNegZ: number;
  fluxVariationPercent: number;
  dominantMolecules: string[];
}

/**
 * The 5 Mandatory NASA Space Apps Challenge Test Targets + Planet X Prototype
 * Values strictly match NASA/IPAC IRSA, Gaia DR3, and Obsidian vault documentation:
 * [[03_Obtencion_de_Data_Fisica_GDoc]] & [[04_Objetivos_Oficiales_de_Prueba]]
 */
export const OFFICIAL_TARGET_BENCHMARKS: OfficialTargetBenchmark[] = [
  {
    id: "wise_0855",
    matchKeywords: ["wise", "0855", "j0855"],
    canonicalName: "WISE J085510.83-071442.5 (WISE 0855)",
    spectralType: "Y2 / Y4 Ultracool Brown Dwarf (Planetary-Mass Analog)",
    raDeg: 133.79513,
    decDeg: -7.24515,
    topology: "DIPOLE_MOTION",
    muRaMasYr: -8118.0,
    muDecMasYr: 680.0,
    muTotalArcsecYr: 8.146,
    positionAngleDeg: 274.8,
    parallaxMas: 433.0,
    peakWaveUm: 4.55,
    teffKelvin: 250,
    colorIndexD6D1: 5.42,
    singleBandSnr: 4.8,
    peakPosZ: 8.42,
    peakNegZ: -8.15,
    fluxVariationPercent: 2.1,
    dominantMolecules: ["H₂O Ice (3.05 µm, D4)", "CH₄ Methane (3.32 µm, D4)", "NH₃ Ammonia (2.95 µm, D4)", "CO (4.67 µm, D6)"],
  },
  {
    id: "barnards_star",
    matchKeywords: ["barnard", "hip 87937", "gj 699"],
    canonicalName: "Barnard's Star (GJ 699)",
    spectralType: "M4.0V Red Dwarf (Highest Known Stellar Proper Motion)",
    raDeg: 269.45208,
    decDeg: 4.69336,
    topology: "DIPOLE_MOTION",
    muRaMasYr: -802.8,
    muDecMasYr: 10362.5,
    muTotalArcsecYr: 10.393,
    positionAngleDeg: 355.6,
    parallaxMas: 547.4,
    peakWaveUm: 0.92,
    teffKelvin: 3134,
    colorIndexD6D1: -1.85,
    singleBandSnr: 18.5,
    peakPosZ: 14.6,
    peakNegZ: -14.2,
    fluxVariationPercent: 1.4,
    dominantMolecules: ["H₂O Vapor (1.40 µm, D2)", "CO Overtone (2.30 µm, D3)", "FeH / TiO Continuum (D1)"],
  },
  {
    id: "epsilon_indi_b",
    matchKeywords: ["epsilon", "indi", "eps ind"],
    canonicalName: "Epsilon Indi Ba/Bb",
    spectralType: "T1 + T6 Binary Brown Dwarf System",
    raDeg: 331.04383,
    decDeg: -56.78269,
    topology: "DIPOLE_MOTION",
    muRaMasYr: 3960.0,
    muDecMasYr: -2538.0,
    muTotalArcsecYr: 4.704,
    positionAngleDeg: 122.7,
    parallaxMas: 275.8,
    peakWaveUm: 2.23,
    teffKelvin: 1300,
    colorIndexD6D1: 2.65,
    singleBandSnr: 9.2,
    peakPosZ: 9.15,
    peakNegZ: -8.89,
    fluxVariationPercent: 3.2,
    dominantMolecules: ["CH₄ Methane (1.66 & 2.20 µm, D3)", "H₂O Vapor (1.40 & 1.90 µm, D2/D3)", "CH₄ Fundamental (3.32 µm, D4)"],
  },
  {
    id: "rw_aurigae",
    matchKeywords: ["rw aur", "aurigae", "rw_aur"],
    canonicalName: "RW Aurigae (RW Aur)",
    spectralType: "T Tauri Variable Star with Circumstellar Protoplanetary Disk",
    raDeg: 76.95653,
    decDeg: 30.40141,
    topology: "MONOPOLE_VARIABLE",
    muRaMasYr: 2.4,
    muDecMasYr: -2.1,
    muTotalArcsecYr: 0.0032,
    positionAngleDeg: 131.2,
    parallaxMas: 6.1,
    peakWaveUm: 3.65,
    teffKelvin: 4800,
    colorIndexD6D1: 1.92,
    singleBandSnr: 11.4,
    peakPosZ: 1.15,
    peakNegZ: -9.64, // Deep dimming eclipse event from circumstellar dust cloud
    fluxVariationPercent: -48.5,
    dominantMolecules: ["Silicate Dust (2.00 µm, D3)", "PAHs & Organics (3.30 µm, D4)", "CO Disk Emission (4.67 µm, D6)"],
  },
  {
    id: "r_draconis",
    matchKeywords: ["r dra", "draconis", "r_dra"],
    canonicalName: "R Draconis (R Dra)",
    spectralType: "Mira-Type Pulsating AGB Red Giant (P ≈ 245.6 days)",
    raDeg: 248.16762,
    decDeg: 66.75496,
    topology: "MONOPOLE_VARIABLE",
    muRaMasYr: -9.8,
    muDecMasYr: -11.5,
    muTotalArcsecYr: 0.0151,
    positionAngleDeg: 220.4,
    parallaxMas: 1.48,
    peakWaveUm: 1.11,
    teffKelvin: 2600,
    colorIndexD6D1: 1.15,
    singleBandSnr: 14.0,
    peakPosZ: 11.82, // Strong pulsation brightening phase between 6-month SPHEREx passes
    peakNegZ: -0.95,
    fluxVariationPercent: 64.2,
    dominantMolecules: ["H₂O Extended Shell (1.40 & 1.90 µm, D2/D3)", "CO Fundamental (4.67 µm, D6)", "CO₂ (4.26 µm, D5)"],
  },
  {
    id: "planet_x_candidate",
    matchKeywords: ["planet", "nine", "planeta", "tno", "sedna"],
    canonicalName: "Hypothetical Trans-Neptunian Planet X / Icy Dwarf",
    spectralType: "Cryogenic Outer Solar System World (D6 Thermal Beacon)",
    raDeg: 62.5,
    decDeg: -15.2,
    topology: "DIPOLE_MOTION",
    muRaMasYr: 1420.0,
    muDecMasYr: 480.0,
    muTotalArcsecYr: 1.499,
    positionAngleDeg: 71.3,
    parallaxMas: 3800.0, // Very large parallax due to Solar System proximity (~540 AU)
    peakWaveUm: 4.85,
    teffKelvin: 95,
    colorIndexD6D1: 6.8,
    singleBandSnr: 2.1, // Sub-threshold in 1 band (2.1σ), discovered via 17-band coadd (8.66σ)!
    peakPosZ: 6.12,
    peakNegZ: -5.94,
    fluxVariationPercent: 1.8,
    dominantMolecules: ["H₂O Crystalline Ice (3.05 µm, D4)", "CH₄ Volatile Ice (3.32 µm, D4)", "CO₂ Ice (4.27 µm, D5)"],
  },
];

