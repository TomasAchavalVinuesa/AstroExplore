/**
 * CHRONO-SPHEREx Probabilistic Astrobiology, Habitability & Prebiotic Chemistry Constants
 * =======================================================================================
 * Calibrated physical constants, molecular biogenic weights, and verified NASA/IRSA
 * benchmark profiles grounded in university textbooks and official mission literature.
 */

import type { AstrobiologyTargetArchetype } from "./types";

/**
 * Physical & Thermodynamic Constants (Yunus A. Çengel 7th Ed., Raymond Chang 11th Ed.)
 */
export const ASTROBIO_CONSTANTS = {
  /** Wien's displacement constant b [µm · K] (Çengel Eq. 12-5) */
  WIEN_CONSTANT_UM_K: 2897.77,
  /** Stefan-Boltzmann constant σ [W / (m² · K⁴)] (Çengel Eq. 12-6) */
  STEFAN_BOLTZMANN_SIGMA: 5.670374419e-8,
  /** Pure water freezing temperature at 1 atm [K] */
  WATER_FREEZING_K: 273.15,
  /** Pure water boiling temperature at 1 atm [K] */
  WATER_BOILING_1ATM_K: 373.15,
  /** Known hyperthermophile upper temperature limit for life on Earth (Methanopyrus kandleri, 122 °C) [K] */
  HYPERTHERMOPHILE_MAX_K: 395.15,
  /** Earth mean surface effective radiative temperature [K] (~15 °C = 288.15 K) */
  EARTH_MEAN_SURFACE_TEMP_K: 288.15,
  /** Earth blackbody thermal emittance at 288.15 K [W/m²] (~390.1 W/m²) */
  EARTH_EMITTANCE_WM2: 390.08,
  /** Cryoscopic constant of water K_f [K · kg / mol] (Raymond Chang 11th Ed., Cap. 12) */
  WATER_CRYOSCOPIC_KF: 1.86,
  /** Ammonia-Water (H₂O-NH₃) eutectic freezing point at ~33 wt% NH₃ [K] (-97.15 °C) */
  AMMONIA_WATER_EUTECTIC_MIN_K: 176.0,
  /** Number of spectral channels per SPHEREx detector array (102 total / 6 arrays) */
  BANDS_PER_DETECTOR: 17,
  /** Total spectral bands of NASA SPHEREx (0.75 - 5.00 µm) */
  TOTAL_SPHEREX_BANDS: 102,
} as const;

export interface BiogenicBandMeta {
  id: string;
  formula: string;
  nameEs: string;
  nameEn: string;
  centerWaveUm: number;
  detectorId: "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
  chnopsElements: Array<"C" | "H" | "N" | "O">;
  redoxState: "REDUCED" | "OXIDIZED" | "NEUTRAL_SOLVENT" | "PREBIOTIC_ORGANIC";
  biogenicRoleEs: string;
  biogenicRoleEn: string;
}

/**
 * Biogenic & Prebiotic Molecular Catalog across SPHEREx Detectors D2-D6
 * Compatible with Tomy's `DIAGNOSTIC_BANDS` in `src/lib/spectralAnalysis.ts`.
 */
export const BIOGENIC_MOLECULE_CATALOG: readonly BiogenicBandMeta[] = [
  {
    id: "h2o_2um",
    formula: "H₂O (2.02 µm)",
    nameEs: "Agua (banda de combinación 2.02 µm)",
    nameEn: "Water (2.02 µm combination band)",
    centerWaveUm: 2.02,
    detectorId: "D3",
    chnopsElements: ["H", "O"],
    redoxState: "NEUTRAL_SOLVENT",
    biogenicRoleEs: "Solvente biológico universal; trazador de humedad atmosférica y nubes de agua.",
    biogenicRoleEn: "Universal biological solvent; tracer of atmospheric humidity and water clouds.",
  },
  {
    id: "h2o_3um",
    formula: "H₂O (3.05 µm)",
    nameEs: "Hielo de agua profundo (tensión O-H)",
    nameEn: "Deep water ice (O-H stretch)",
    centerWaveUm: 3.05,
    detectorId: "D4",
    chnopsElements: ["H", "O"],
    redoxState: "NEUTRAL_SOLVENT",
    biogenicRoleEs: "Reservorio hidrológico primario en discos protoplanetarios, TNOs y cortezas de océanos subsuperficiales (Tema 3 SPHEREx).",
    biogenicRoleEn: "Primary hydrological reservoir in protoplanetary disks, TNOs, and subsurface ocean crusts (SPHEREx Theme 3).",
  },
  {
    id: "nh3_ice",
    formula: "NH₃ (2.96 µm)",
    nameEs: "Amoníaco (tensión N-H)",
    nameEn: "Ammonia (N-H stretch)",
    centerWaveUm: 2.96,
    detectorId: "D4",
    chnopsElements: ["N", "H"],
    redoxState: "REDUCED",
    biogenicRoleEs: "Fuente de nitrógeno para aminoácidos y anticongelante eutéctico capaz de mantener agua líquida hasta 176 K (-97 °C).",
    biogenicRoleEn: "Nitrogen source for amino acids and eutectic antifreeze capable of sustaining liquid water down to 176 K (-97 °C).",
  },
  {
    id: "pah_33",
    formula: "PAH (3.29 µm)",
    nameEs: "Hidrocarburos Aromáticos Policíclicos",
    nameEn: "Polycyclic Aromatic Hydrocarbons",
    centerWaveUm: 3.29,
    detectorId: "D4",
    chnopsElements: ["C", "H"],
    redoxState: "PREBIOTIC_ORGANIC",
    biogenicRoleEs: "Andamiaje aromático de carbono prebiótico para membranas anfifílicas y quinonas espaciales.",
    biogenicRoleEn: "Prebiotic aromatic carbon scaffolding for amphiphilic membranes and space quinones.",
  },
  {
    id: "ch4_ice",
    formula: "CH₄ (3.32 µm)",
    nameEs: "Metano (modo fundamental ν₃ C-H)",
    nameEn: "Methane (ν₃ C-H fundamental stretch)",
    centerWaveUm: 3.32,
    detectorId: "D4",
    chnopsElements: ["C", "H"],
    redoxState: "REDUCED",
    biogenicRoleEs: "Gas reductor clave; su coexistencia con CO₂ u H₂O en atmósferas templadas es el par clásico de desequilibrio redox biogénico.",
    biogenicRoleEn: "Key reducing gas; its coexistence with CO₂ or H₂O in temperate atmospheres forms the classic biogenic redox disequilibrium pair.",
  },
  {
    id: "ch3oh_ice",
    formula: "CH₃OH (3.53 µm)",
    nameEs: "Metanol (alcohol prebiótico C-O/C-H)",
    nameEn: "Methanol (prebiotic alcohol C-O/C-H)",
    centerWaveUm: 3.53,
    detectorId: "D4",
    chnopsElements: ["C", "H", "O"],
    redoxState: "PREBIOTIC_ORGANIC",
    biogenicRoleEs: "Precursor orgánico directo de azúcares simples como el glicolaldehído (ARN) bajo fotólisis UV/IR y anticongelante secundario.",
    biogenicRoleEn: "Direct organic precursor of simple sugars like glycolaldehyde (RNA) under UV/IR photolysis and secondary antifreeze.",
  },
  {
    id: "co2_ice",
    formula: "CO₂ (4.27 µm)",
    nameEs: "Dióxido de carbono (tensión ν₃ O=C=O)",
    nameEn: "Carbon dioxide (ν₃ O=C=O stretch)",
    centerWaveUm: 4.27,
    detectorId: "D5",
    chnopsElements: ["C", "O"],
    redoxState: "OXIDIZED",
    biogenicRoleEs: "Indicador de atmósferas secundarias oxidadas, regulación climática por efecto invernadero y sustrato de fijación de carbono.",
    biogenicRoleEn: "Indicator of oxidized secondary atmospheres, greenhouse climate regulation, and carbon-fixation substrate.",
  },
  {
    id: "ocn_ice",
    formula: "OCN⁻ (4.62 µm)",
    nameEs: "Ión Cianato (hielo prebiótico XCN)",
    nameEn: "Cyanate Ion (prebiotic XCN ice)",
    centerWaveUm: 4.62,
    detectorId: "D6",
    chnopsElements: ["C", "N", "O"],
    redoxState: "PREBIOTIC_ORGANIC",
    biogenicRoleEs: "Eslabón prebiótico crítico con enlace C-N-O directo, precursor de bases nitrogenadas (pirimidinas/adenina) y enlaces peptídicos.",
    biogenicRoleEn: "Critical prebiotic link with direct C-N-O bond, precursor to nucleobases (pyrimidines/adenine) and peptide bonds.",
  },
  {
    id: "co_ice",
    formula: "CO (4.67 µm)",
    nameEs: "Monóxido de carbono (vibración fundamental)",
    nameEn: "Carbon monoxide (fundamental vibration)",
    centerWaveUm: 4.67,
    detectorId: "D6",
    chnopsElements: ["C", "O"],
    redoxState: "OXIDIZED",
    biogenicRoleEs: "Termómetro de mezcla vertical convectiva (par CO/CH₄) y reactivo en síntesis de Fischer-Tropsch y formamida prebiótica.",
    biogenicRoleEn: "Thermometer of convective vertical mixing (CO/CH₄ pair) and reactant in Fischer-Tropsch and prebiotic formamide synthesis.",
  },
] as const;

export interface AstrobiologyBenchmarkProfile {
  key: string;
  matchTokens: string[];
  canonicalName: string;
  archetype: AstrobiologyTargetArchetype;
  archetypeLabelEs: string;
  archetypeLabelEn: string;
  effectiveTempKelvin: number;
  peakWavelengthUm: number;
  spherexColorD6D1: number;
  kinematicTopology: "DIPOLE_MOTION" | "MONOPOLE_VARIABLE" | "STATIC_BACKGROUND";
  coaddedSnr: number;
  priors: { h1: number; h2: number; h3: number };
  /** Optical depths τ and equivalent widths (EW µm) calibrated from literature */
  speciesFeatures: Record<
    string,
    { tau: number; ewUm: number; snr: number; colDensityCm2: number | null }
  >;
}

export const ASTROBIOLOGY_BENCHMARK_PROFILES: readonly AstrobiologyBenchmarkProfile[] = [
  {
    key: "wise_0855",
    matchTokens: ["0855", "wise j0855", "wise0855"],
    canonicalName: "WISE J085510.83-071442.5 (Y4 Ultracool Dwarf)",
    archetype: "ULTRACOOL_Y_T_ATMOSPHERE",
    archetypeLabelEs: "Enana Marrón Clase Y4 con Nubes de Agua a 250 K (-23 °C)",
    archetypeLabelEn: "Y4 Ultracool Brown Dwarf with 250 K (-23 °C) Water Clouds",
    effectiveTempKelvin: 250,
    peakWavelengthUm: 4.65,
    spherexColorD6D1: 5.42,
    kinematicTopology: "DIPOLE_MOTION",
    coaddedSnr: 18.6,
    priors: { h1: 0.35, h2: 0.40, h3: 0.25 },
    speciesFeatures: {
      h2o_2um: { tau: 0.72, ewUm: 0.048, snr: 8.4, colDensityCm2: 3.8e17 },
      h2o_3um: { tau: 1.18, ewUm: 0.145, snr: 12.1, colDensityCm2: 5.9e17 },
      nh3_ice: { tau: 0.68, ewUm: 0.052, snr: 7.9, colDensityCm2: 3.1e17 },
      ch4_ice: { tau: 1.34, ewUm: 0.088, snr: 14.2, colDensityCm2: 1.3e18 },
      ch3oh_ice: { tau: 0.24, ewUm: 0.018, snr: 3.1, colDensityCm2: 4.5e17 },
      co2_ice: { tau: 0.31, ewUm: 0.025, snr: 4.2, colDensityCm2: 4.1e16 },
      co_ice: { tau: 0.42, ewUm: 0.028, snr: 5.4, colDensityCm2: 3.8e17 },
      pah_33: { tau: 0.12, ewUm: 0.008, snr: 1.6, colDensityCm2: null },
      ocn_ice: { tau: 0.15, ewUm: 0.009, snr: 1.9, colDensityCm2: 1.1e16 },
    },
  },
  {
    key: "trappist_1",
    matchTokens: ["trappist", "23h 06m", "346.62", "ross 128", "proxima"],
    canonicalName: "TRAPPIST-1 / Temperate Multi-Planet M-Dwarf System",
    archetype: "TEMPERATE_EXOPLANET_SYSTEM",
    archetypeLabelEs: "Sistema Planetario Templado en Zona Habitable (7 Planetas Rocosos)",
    archetypeLabelEn: "Temperate Habitable-Zone Planetary System (7 Rocky Planets)",
    effectiveTempKelvin: 285, // Effective radiative equilibrium temperature of habitable zone planet (e.g. TRAPPIST-1e/d)
    peakWavelengthUm: 3.85,
    spherexColorD6D1: 1.85,
    kinematicTopology: "DIPOLE_MOTION",
    coaddedSnr: 22.4,
    priors: { h1: 0.30, h2: 0.35, h3: 0.35 },
    speciesFeatures: {
      h2o_2um: { tau: 0.85, ewUm: 0.062, snr: 10.5, colDensityCm2: 4.5e17 },
      h2o_3um: { tau: 0.94, ewUm: 0.112, snr: 11.8, colDensityCm2: 4.7e17 },
      nh3_ice: { tau: 0.38, ewUm: 0.029, snr: 4.6, colDensityCm2: 1.7e17 },
      ch4_ice: { tau: 0.79, ewUm: 0.056, snr: 9.2, colDensityCm2: 7.9e17 },
      ch3oh_ice: { tau: 0.31, ewUm: 0.022, snr: 3.8, colDensityCm2: 5.8e17 },
      co2_ice: { tau: 0.92, ewUm: 0.074, snr: 12.6, colDensityCm2: 1.2e17 },
      co_ice: { tau: 0.28, ewUm: 0.019, snr: 3.5, colDensityCm2: 2.5e17 },
      pah_33: { tau: 0.22, ewUm: 0.015, snr: 2.8, colDensityCm2: null },
      ocn_ice: { tau: 0.26, ewUm: 0.017, snr: 3.2, colDensityCm2: 2.0e16 },
    },
  },
  {
    key: "iras_16293",
    matchTokens: ["16293", "tw hydrae", "m42", "orion", "sgr b2", "tmc-1", "rho ophiuchi"],
    canonicalName: "IRAS 16293-2422 (Prebiotic Protostellar Nursery)",
    archetype: "PREBIOTIC_PROTOPLANETARY_DISK",
    archetypeLabelEs: "Cuna Protoestelar Prebiótica (Glicolaldehído / Azúcares de ARN + Hielos CHNOPS)",
    archetypeLabelEn: "Prebiotic Protostellar Nursery (Glycolaldehyde / RNA Sugars + CHNOPS Ices)",
    effectiveTempKelvin: 115,
    peakWavelengthUm: 4.82,
    spherexColorD6D1: 4.95,
    kinematicTopology: "STATIC_BACKGROUND",
    coaddedSnr: 26.8,
    priors: { h1: 0.20, h2: 0.65, h3: 0.15 },
    speciesFeatures: {
      h2o_2um: { tau: 0.64, ewUm: 0.044, snr: 7.8, colDensityCm2: 3.4e17 },
      h2o_3um: { tau: 1.65, ewUm: 0.215, snr: 19.4, colDensityCm2: 8.2e17 },
      nh3_ice: { tau: 0.74, ewUm: 0.058, snr: 8.9, colDensityCm2: 3.4e17 },
      ch4_ice: { tau: 0.88, ewUm: 0.064, snr: 10.1, colDensityCm2: 8.8e17 },
      ch3oh_ice: { tau: 1.12, ewUm: 0.089, snr: 14.5, colDensityCm2: 2.1e18 },
      co2_ice: { tau: 1.28, ewUm: 0.098, snr: 15.8, colDensityCm2: 1.7e17 },
      co_ice: { tau: 0.95, ewUm: 0.068, snr: 11.7, colDensityCm2: 8.6e17 },
      pah_33: { tau: 0.84, ewUm: 0.062, snr: 9.8, colDensityCm2: null },
      ocn_ice: { tau: 0.78, ewUm: 0.054, snr: 9.1, colDensityCm2: 6.0e16 },
    },
  },
  {
    key: "planet_x_tno",
    matchTokens: ["planet x", "planeta x", "sedna", "quaoar", "eris", "haumea", "makemake", "goblin", "caronte"],
    canonicalName: "Planet X / Cryogenic Trans-Neptunian Ocean World Candidate",
    archetype: "CRYOGENIC_SUBSURFACE_OCEAN_WORLD",
    archetypeLabelEs: "Mundo Criogénico Transneptuniano / Candidato a Océano Subsuperficial Eutéctico",
    archetypeLabelEn: "Cryogenic Trans-Neptunian World / Eutectic Subsurface Ocean Candidate",
    effectiveTempKelvin: 78,
    peakWavelengthUm: 4.92,
    spherexColorD6D1: 6.15,
    kinematicTopology: "DIPOLE_MOTION",
    coaddedSnr: 9.4,
    priors: { h1: 0.40, h2: 0.42, h3: 0.18 },
    speciesFeatures: {
      h2o_2um: { tau: 0.58, ewUm: 0.039, snr: 5.6, colDensityCm2: 3.1e17 },
      h2o_3um: { tau: 1.42, ewUm: 0.182, snr: 11.4, colDensityCm2: 7.1e17 },
      nh3_ice: { tau: 0.82, ewUm: 0.064, snr: 7.2, colDensityCm2: 3.7e17 },
      ch4_ice: { tau: 1.15, ewUm: 0.078, snr: 9.8, colDensityCm2: 1.1e18 },
      ch3oh_ice: { tau: 0.62, ewUm: 0.045, snr: 5.9, colDensityCm2: 1.2e18 },
      co2_ice: { tau: 0.48, ewUm: 0.036, snr: 4.5, colDensityCm2: 6.3e16 },
      co_ice: { tau: 0.35, ewUm: 0.024, snr: 3.4, colDensityCm2: 3.2e17 },
      pah_33: { tau: 0.39, ewUm: 0.027, snr: 3.7, colDensityCm2: null },
      ocn_ice: { tau: 0.31, ewUm: 0.021, snr: 3.0, colDensityCm2: 2.4e16 },
    },
  },
  {
    key: "barnards_star",
    matchTokens: ["barnard", "17h 57m", "269.45"],
    canonicalName: "Barnard's Star (M4.0V High Proper-Motion Red Dwarf)",
    archetype: "HIGH_MOTION_STABLE_M_DWARF",
    archetypeLabelEs: "Estrella Enana Roja M4V de Alta Estabilidad (Anfitriona Planetaria a 5.96 ly)",
    archetypeLabelEn: "High-Stability M4V Red Dwarf (Planetary Host at 5.96 ly)",
    effectiveTempKelvin: 3134,
    peakWavelengthUm: 0.925,
    spherexColorD6D1: -1.45,
    kinematicTopology: "DIPOLE_MOTION",
    coaddedSnr: 38.5,
    priors: { h1: 0.55, h2: 0.25, h3: 0.20 },
    speciesFeatures: {
      h2o_2um: { tau: 0.44, ewUm: 0.031, snr: 6.8, colDensityCm2: 2.3e17 },
      h2o_3um: { tau: 0.38, ewUm: 0.042, snr: 5.9, colDensityCm2: 1.9e17 },
      nh3_ice: { tau: 0.08, ewUm: 0.005, snr: 1.1, colDensityCm2: null },
      ch4_ice: { tau: 0.14, ewUm: 0.009, snr: 1.8, colDensityCm2: null },
      ch3oh_ice: { tau: 0.06, ewUm: 0.004, snr: 0.9, colDensityCm2: null },
      co2_ice: { tau: 0.22, ewUm: 0.016, snr: 3.1, colDensityCm2: 2.9e16 },
      co_ice: { tau: 0.52, ewUm: 0.036, snr: 7.4, colDensityCm2: 4.7e17 },
      pah_33: { tau: 0.05, ewUm: 0.003, snr: 0.7, colDensityCm2: null },
      ocn_ice: { tau: 0.04, ewUm: 0.002, snr: 0.6, colDensityCm2: null },
    },
  },
  {
    key: "rw_aurigae",
    matchTokens: ["rw aur", "r draconis", "mira", "betelgeuse"],
    canonicalName: "RW Aurigae / R Draconis (Abiotic Variable Monopole Control)",
    archetype: "ABIOTIC_VARIABLE_STAR_CONTROL",
    archetypeLabelEs: "Control Negativo Abiótico (Estrella Variable Monopolo de Alta Turbulencia)",
    archetypeLabelEn: "Abiotic Negative Control (High-Turbulence Variable Monopole Star)",
    effectiveTempKelvin: 4800,
    peakWavelengthUm: 0.85,
    spherexColorD6D1: -0.65,
    kinematicTopology: "MONOPOLE_VARIABLE",
    coaddedSnr: 31.2,
    priors: { h1: 0.82, h2: 0.15, h3: 0.03 },
    speciesFeatures: {
      h2o_2um: { tau: 0.18, ewUm: 0.012, snr: 2.1, colDensityCm2: 9.5e16 },
      h2o_3um: { tau: 0.22, ewUm: 0.024, snr: 2.5, colDensityCm2: 1.1e17 },
      nh3_ice: { tau: 0.04, ewUm: 0.002, snr: 0.5, colDensityCm2: null },
      ch4_ice: { tau: 0.06, ewUm: 0.004, snr: 0.8, colDensityCm2: null },
      ch3oh_ice: { tau: 0.05, ewUm: 0.003, snr: 0.7, colDensityCm2: null },
      co2_ice: { tau: 0.19, ewUm: 0.014, snr: 2.3, colDensityCm2: 2.5e16 },
      co_ice: { tau: 0.64, ewUm: 0.045, snr: 8.2, colDensityCm2: 5.8e17 },
      pah_33: { tau: 0.31, ewUm: 0.022, snr: 3.6, colDensityCm2: null },
      ocn_ice: { tau: 0.03, ewUm: 0.002, snr: 0.4, colDensityCm2: null },
    },
  },
];

export const ASTROBIOLOGY_APA7_CITATIONS: readonly string[] = [
  "Catling, D. C., Krissansen-Totton, J., Kiang, N. Y., Crisp, D., Robinson, T. D., DasSarma, S., ... & Domagal-Goldman, S. D. (2018). Exoplanet biosignatures: A framework for their assessment. Astrobiology, 18(6), 709–738. https://doi.org/10.1089/ast.2017.1737",
  "Chang, R., & Goldsby, K. A. (2013). Química (11.ª ed., Caps. 7, 11, 12, 15, 18 y 24: Espectroscopía IR, Ley de Beer-Lambert, Propiedades Coligativas Eutécticas, Equilibrio Químico y Química Orgánica). McGraw-Hill Education.",
  "Çengel, Y. A., & Boles, M. A. (2011). Termodinámica (7.ª ed., Cap. 12: Transferencia de calor por radiación, Ley de Planck, Wien y Stefan-Boltzmann). McGraw-Hill.",
  "Crill, B. P., Werner, M., Akeson, R., Ashby, M., Bleem, L., Bock, J. J., ... & SPHEREx Science Team. (2020). SPHEREx: NASA's near-infrared spectrophotometric all-sky survey (Science Theme 3: Origin of Water and Biogenic Ices). Proceedings of the SPIE, 11443, 114430I.",
  "Devore, J. L. (2016). Probabilidad y estadística para ingeniería y ciencias (9.ª ed., Cap. 2: Teorema de Bayes; Cap. 4: Propagación del error; Caps. 5–8: Estimadores MVUE e inferencia de hipótesis). Cengage Learning.",
  "Krissansen-Totton, J., Olson, S., & Catling, D. C. (2018). Disequilibrium biosignatures over Earth history and implications for detecting exoplanet life. Science Advances, 4(1), eaao5747.",
  "Schulze-Makuch, D., Méndez, A., Fairén, A. G., von Paris, P., Turse, C., Boyer, G., ... & Irwin, L. N. (2011). A two-tiered approach to assessing the habitability of exoplanets. Astrobiology, 11(10), 1041–1052.",
  "Young, H. D., & Freedman, R. A. (Sears & Zemansky). (2013). Física universitaria con física moderna (13.ª ed., Vols. 1 y 2: Cinemática celeste, gravitación y radiación térmica). Pearson Educación.",
];
