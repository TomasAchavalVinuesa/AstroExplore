/**
 * CHRONO-SPHEREx Astrochemistry Module - Constants & Molecular Signatures
 * Based on NIST Chemistry WebBook, HITRAN Molecular Database, and SPHEREx 102 Spectral Bands.
 */

import type { MolecularBandDefinition } from "./types";

/**
 * Universal Physical Constants (CODATA 2018 / 2022)
 */
export const CONSTANTS = {
  WIEN_DISPLACEMENT_CONST_UM_K: 2897.771955, // b in µm · K
  STEFAN_BOLTZMANN_SIGMA: 5.670374419e-8,    // W / (m² · K⁴)
  SPEED_OF_LIGHT_MS: 299792458,              // m/s
  PLANCK_CONST_JS: 6.62607015e-34,           // J · s
  BOLTZMANN_CONST_JK: 1.380649e-23,          // J / K
};

/**
 * High-priority molecular absorption bands in SPHEREx 0.75 - 5.0 µm range
 */
export const MOLECULAR_BANDS: MolecularBandDefinition[] = [
  {
    id: "H2O_ICE",
    commonName: "Water Ice (Amorphous / Crystalline)",
    chemicalFormula: "H₂O (s)",
    centerWaveUm: 3.05,
    waveMinUm: 2.90,
    waveMaxUm: 3.20,
    detectorId: "D4",
    vibrationalMode: "ν₁ / ν₃ symmetric & antisymmetric O-H stretch",
    astrophysicalSignificance:
      "Diagnostic signature of surface ices, cometary veneers, outer solar system volatile mantles, and icy planetesimals.",
    habitabilityContext:
      "Water retention in solid phase indicates sub-freezing volatile reservoirs essential for primordial prebiotic hydrospheres.",
    colorHex: "#38bdf8", // Light Blue
    referenceCitation: "Dartois et al. (2002); Chang, R. (2010) General Chemistry, Ch. 11.",
  },
  {
    id: "CH4_METHANE",
    commonName: "Methane (Gas / Clathrate)",
    chemicalFormula: "CH₄",
    centerWaveUm: 3.32,
    waveMinUm: 3.20,
    waveMaxUm: 3.45,
    detectorId: "D4",
    vibrationalMode: "ν₃ C-H asymmetric stretching mode",
    astrophysicalSignificance:
      "Primary biosignature gas and thermochemical indicator in reducing atmospheres; standard for cool brown dwarf classification (T/Y dwarfs).",
    habitabilityContext:
      "Methane coexistence with oxidized species in non-equilibrium conditions serves as a Tier-1 exoplanetary biosignature.",
    colorHex: "#4ade80", // Vibrant Green
    referenceCitation: "Yung et al. (1984); SPHEREx Science Plan (2026), Section 4.2.",
  },
  {
    id: "CO2_CARBON_DIOXIDE",
    commonName: "Carbon Dioxide",
    chemicalFormula: "CO₂",
    centerWaveUm: 4.27,
    waveMinUm: 4.18,
    waveMaxUm: 4.38,
    detectorId: "D5",
    vibrationalMode: "ν₃ asymmetric stretch (O=C=O)",
    astrophysicalSignificance:
      "Dominant secondary atmospheric component and greenhouse agent in terrestrial bodies (Venus, Earth, Mars, exoplanets).",
    habitabilityContext:
      "Atmospheric carbon cycling and greenhouse buffer; crucial for maintaining surface liquid water in circumstellar habitable zones.",
    colorHex: "#f43f5e", // Rose / Red
    referenceCitation: "JWST Transiting Exoplanet Community (2023); Sears & Zemansky (2013).",
  },
  {
    id: "CO_CARBON_MONOXIDE",
    commonName: "Carbon Monoxide",
    chemicalFormula: "CO",
    centerWaveUm: 4.67,
    waveMinUm: 4.55,
    waveMaxUm: 4.80,
    detectorId: "D6",
    vibrationalMode: "Fundamental (v = 1 ← 0) vibrational band",
    astrophysicalSignificance:
      "Equilibrium thermochemical tracer with CH₄: CH₄ + H₂O ⇌ CO + 3H₂. Abundance tests atmospheric quench levels and vertical mixing.",
    habitabilityContext:
      "Disequilibrium excess reveals strong atmospheric convection or violent vertical transport from warm planetary interiors.",
    colorHex: "#f97316", // Orange
    referenceCitation: "Hubeny & Burrows (2007); Çengel & Boles (2015) Thermodynamics.",
  },
  {
    id: "H2O_VAPOR",
    commonName: "Water Vapor (Atmospheric)",
    chemicalFormula: "H₂O (g)",
    centerWaveUm: 1.40,
    waveMinUm: 1.35,
    waveMaxUm: 1.50,
    detectorId: "D2",
    vibrationalMode: "ν₁ + ν₃ overtone / combination band",
    astrophysicalSignificance:
      "Indicator of warm atmospheric moisture, gas giant humidity, and stellar spectral classification for cool stars (late K and M types).",
    habitabilityContext:
      "Presence of atmospheric vapor combined with suitable surface pressure enables greenhouse temperature stabilization.",
    colorHex: "#60a5fa", // Blue
    referenceCitation: "Allard et al. (2001); Sears & Zemansky University Physics, Ch. 18.",
  },
  {
    id: "NH3_AMMONIA",
    commonName: "Ammonia",
    chemicalFormula: "NH₃",
    centerWaveUm: 2.95,
    waveMinUm: 2.85,
    waveMaxUm: 3.02,
    detectorId: "D4",
    vibrationalMode: "ν₁ / ν₃ symmetric & asymmetric stretch",
    astrophysicalSignificance:
      "Signature of extreme atmospheric cooling (T < 500 K). Distinctive spectroscopic marker separating T dwarfs from ultra-cool Y dwarfs.",
    habitabilityContext:
      "Prebiotic nitrogen fixation source in primordial atmospheres and potential alternative solvent in cryogenic worlds.",
    colorHex: "#a855f7", // Purple
    referenceCitation: "Cushing et al. (2011); Kirkpatrick et al. (2021).",
  },
  {
    id: "PAH_ORGANICS",
    commonName: "Polycyclic Aromatic Hydrocarbons",
    chemicalFormula: "C_n H_m (PAH)",
    centerWaveUm: 3.30,
    waveMinUm: 3.25,
    waveMaxUm: 3.35,
    detectorId: "D4",
    vibrationalMode: "Aromatic C-H stretching vibrational emission/absorption",
    astrophysicalSignificance:
      "Complex carbonaceous macromolecules tracing interstellar organic chemistry, photodissociation regions, and protoplanetary grain growth.",
    habitabilityContext:
      "Prebiotic organic feedstock delivered to young planetary crusts via cometary and asteroidal bombardment.",
    colorHex: "#e879f9", // Fuchsia
    referenceCitation: "Tielens, A. G. G. M. (2008) The Physics and Chemistry of Interstellar Dust.",
  },
  {
    id: "SILICATES",
    commonName: "Silicate Dust (Olivine / Pyroxene)",
    chemicalFormula: "Mg_x Fe_(2-x) SiO₄",
    centerWaveUm: 2.00,
    waveMinUm: 1.80,
    waveMaxUm: 2.25,
    detectorId: "D3",
    vibrationalMode: "Electronic crystal field & Fe²⁺ ligand absorption",
    astrophysicalSignificance:
      "Refractory rocky dust grains in protoplanetary accretion disks and surface regolith of airless rocky planetesimals.",
    habitabilityContext:
      "Foundational mineralogy for terrestrial mantle and crust formation in rocky exoplanetary systems.",
    colorHex: "#ca8a04", // Amber / Ochre
    referenceCitation: "Dorschner et al. (1995); Chang (2010), Chemistry of Minerals.",
  },
];
