/**
 * CHRONO-SPHEREx Probabilistic Astrobiology, Habitability & Prebiotic Chemistry Module
 * ====================================================================================
 * Rigorous probabilistic framework evaluating:
 * 1. Bayesian Posterior Probabilities P(H_i | Data) (Jay L. Devore, Cap. 2.4 & Catling et al. 2018 NASA Astrobiology)
 * 2. Beer-Lambert Optical Depth, Column Density & CHNOPS Inventory (Raymond Chang 11th Ed., Caps. 7, 11, 24)
 * 3. Gibbs Free Energy & Redox Thermochemical Disequilibrium (Raymond Chang Cap. 15 & 18; Lovelock 1965)
 * 4. Eutectic Ammonia-Water Cryoscopic Freezing Depression (Raymond Chang Cap. 12: ΔT_f = K_f · m)
 * 5. Radiative Blackbody Thermodynamics: Planck, Wien & Stefan-Boltzmann (Yunus A. Çengel 7th Ed., Cap. 12)
 * 6. Astrometric Kinematics & Radiative Stability (Sears & Zemansky Vols. 1 & 2; Erwin Kreyszig Cap. 24)
 *
 * SCIENTIFIC INTEGRITY RULE:
 * Never makes deterministic "Life / No Life" claims. All outputs are expressed strictly as conditional
 * Bayesian probabilities with 95% confidence intervals (±ΔP_95%) and explicit Type I (abiotic false-positive)
 * and Type II (missed weak signal) error rates.
 */

export type AstrobiologyTargetArchetype =
  | "TEMPERATE_EXOPLANET_SYSTEM"       // e.g. TRAPPIST-1, Ross 128, Proxima Centauri, Tau Ceti
  | "ULTRACOOL_Y_T_ATMOSPHERE"         // e.g. WISE 0855 (250 K water clouds), WISE 1828 (~300 K), Epsilon Indi B
  | "PREBIOTIC_PROTOPLANETARY_DISK"    // e.g. IRAS 16293-2422 (glycolaldehyde), TW Hydrae, Orion M42, Sgr B2
  | "CRYOGENIC_SUBSURFACE_OCEAN_WORLD" // e.g. Planet X candidate, Sedna, Quaoar, Eris, Europa/Enceladus analogues
  | "HIGH_MOTION_STABLE_M_DWARF"       // e.g. Barnard's Star, Kapteyn's Star
  | "ABIOTIC_VARIABLE_STAR_CONTROL";   // e.g. RW Aurigae, R Draconis (intrinsic variable monopoles - abiotic controls)

export type JeffreysEvidenceScale =
  | "DECISIVE_EVIDENCE"       // Bayes Factor K > 100 (log10 K > 2.0)
  | "STRONG_EVIDENCE"         // 10 < K <= 100 (1.0 < log10 K <= 2.0)
  | "SUBSTANTIAL_EVIDENCE"    // 3.2 < K <= 10 (0.5 < log10 K <= 1.0)
  | "ANECDOTAL_INSUFFICIENT"  // 1.0 <= K <= 3.2
  | "FAVORS_ABIOTIC_NULL";    // K < 1.0

export interface BayesianHypothesisProbabilities {
  /**
   * H1: Null Abiotic Hypothesis — Spectrum and flux are 100% explained by inert thermochemical
   * equilibrium, stellar photospheres, or abiotic dust without prebiotic or biological anomalies.
   */
  h1AbioticEquilibriumPct: number;
  /**
   * H2: Prebiotic Biogenic Reservoir Hypothesis (SPHEREx Theme 3: Galactic Ices) —
   * Confirmed inventory of biogenic ices & organic precursors (H₂O, CH₃OH, OCN⁻, NH₃, CH₄, PAHs)
   * capable of seeding planetary systems or sustaining subsurface chemistry.
   */
  h2PrebioticReservoirPct: number;
  /**
   * H3: Habitable Niche / Redox Disequilibrium Biosignature Candidate Hypothesis —
   * Coexistence of water solvent, compatible thermal/eutectic window, and atmospheric redox
   * disequilibrium (CH₄ + CO₂ / anomalous CH₄/CO), warranting JWST/HWO follow-up.
   */
  h3HabitableOrBiosignatureCandidatePct: number;
  /**
   * 95% Statistical Confidence Interval half-width (±ΔP_95%) derived from FITS variance & coverage
   * (Jay Devore Cap. 7).
   */
  confidenceInterval95HalfWidthPct: number;
  /** Prior probabilities P(H1), P(H2), P(H3) before observing the SPHEREx infrared spectrum */
  priorsPct: {
    h1PriorPct: number;
    h2PriorPct: number;
    h3PriorPct: number;
  };
  /** Bayes Factor K_21 = P(E | H2) / P(E | H1) measuring prebiotic evidence strength */
  bayesFactorPrebioticK21: number;
  /** Bayes Factor K_31 = P(E | H3) / P(E | H1) measuring habitability/disequilibrium evidence strength */
  bayesFactorHabitableK31: number;
  evidenceScale: JeffreysEvidenceScale;
  /** Type I Error risk α (%): Probability of an abiotic process mimicking the observed features */
  abioticFalsePositiveRiskAlphaPct: number;
  /** Type II Error risk β (%): Probability of missing a true weak feature after 17-band coaddition */
  missedSignalRiskBetaPct: number;
}

export type ProbabilisticPillarId =
  | "P1_HYDROLOGICAL_SOLVENT"
  | "P2_PREBIOTIC_CHNOPS_INVENTORY"
  | "P3_REDOX_THERMOCHEMICAL_DISEQUILIBRIUM"
  | "P4_THERMODYNAMIC_AND_EUTECTIC_PHASE"
  | "P5_INSTRUMENTAL_SNR_AND_STATISTICAL_POWER";

export interface ProbabilisticPillarScore {
  id: ProbabilisticPillarId;
  titleEs: string;
  titleEn: string;
  shortLabelEs: string;
  shortLabelEn: string;
  probabilityPct: number;
  uncertainty95Pct: number;
  weightInComposite: number;
  formulaLatex: string;
  measuredEvidenceEs: string;
  measuredEvidenceEn: string;
  textbookCitation: string;
  nasaReference: string;
  statusColor: "emerald" | "cyan" | "amber" | "rose";
}

export interface CryoscopicSubsurfaceModel {
  /** Pure water freezing point at standard pressure: 273.15 K (0 °C) */
  pureWaterFreezingKelvin: number;
  /** Estimated effective molality of antifreeze volatiles (NH₃ + CH₃OH) in H₂O ice mantle [mol/kg] */
  estimatedAntifreezeMolalityMolKg: number;
  /** Cryoscopic freezing point depression ΔT_f = K_f · m (Raymond Chang Cap. 12, K_f = 1.86 °C·kg/mol) */
  cryoscopicDepressionKelvin: number;
  /** Effective eutectic liquid threshold temperature [K] (down to 176.0 K for H₂O-NH₃ eutectic) */
  effectiveLiquidThresholdKelvin: number;
  effectiveLiquidThresholdCelsius: number;
  /** Whether internal Kelvin-Helmholtz or radiogenic heating can maintain a subsurface ocean */
  subsurfaceOceanViable: boolean;
  /** Conditional probability of a subsurface liquid water-ammonia ocean beneath the icy crust (%) */
  subsurfaceOceanProbabilityPct: number;
  explanationEs: string;
  explanationEn: string;
}

export interface BiogenicMoleculeContribution {
  id: string;
  formula: string;
  nameEs: string;
  nameEn: string;
  centerWaveUm: number;
  detectorId: "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
  chnopsElements: Array<"C" | "H" | "N" | "O">;
  opticalDepthTau: number;
  equivalentWidthUm: number;
  columnDensityCm2: number | null;
  snr: number;
  detectionProbabilityPct: number;
  biogenicRoleEs: string;
  biogenicRoleEn: string;
  isDetected: boolean;
}

export interface CompositeAstrobiologyIndices {
  /**
   * Planetary Habitability & Prebiotic Potential Index (PHI) [0 - 100%]
   * Weighted geometric-arithmetic synthesis of the 5 probabilistic pillars.
   */
  phiCompositePct: number;
  phiConfidence95Pct: number;
  /**
   * Infrared Earth Similarity & Thermal-Chemical Compatibility Index (ESI-IR) [0.00 - 1.00]
   * Adapted from Schulze-Makuch et al. (2011) for SPHEREx 0.75-5.00 µm observables.
   */
  esiInfraredScore: number;
  /**
   * Redox Disequilibrium Index Ω_redox [0 - 100%]
   * Quantifies simultaneous coexistence of reduced (CH₄, NH₃) and oxidized (CO₂, H₂O, CO) species.
   */
  redoxDisequilibriumOmegaPct: number;
  /**
   * CHNOPS Completeness Percentage [0 - 100%]
   * Fraction of core biogenic elements (C, H, N, O) spectroscopically confirmed in the target.
   */
  chnopsCompletenessPct: number;
  confirmedElements: Array<"C" | "H" | "N" | "O">;
}

export interface HumanAstrobiologyTranslation {
  headlineVerdictEs: string;
  headlineVerdictEn: string;
  plainProbabilityExplanationEs: string;
  plainProbabilityExplanationEn: string;
  abioticVsBiogenicHonestNoteEs: string;
  abioticVsBiogenicHonestNoteEn: string;
  recipeOfLifeAnalogyEs: string;
  recipeOfLifeAnalogyEn: string;
  antifreezeOceanAnalogyEs: string;
  antifreezeOceanAnalogyEn: string;
}

export interface ProbabilisticAstrobiologyReport {
  targetName: string;
  coordinates: { ra: number; dec: number };
  archetype: AstrobiologyTargetArchetype;
  archetypeLabelEs: string;
  archetypeLabelEn: string;
  dataSourceMode:
    | "LIVE_IRSA_ROI_AND_CUTOUTS"
    | "LIVE_IRSA_FITS_CUTOUTS"
    | "CALIBRATED_ARCHIVE_BENCHMARK";
  isLiveNasaData: boolean;
  coveredChannelsCount: number;
  totalBandsPossible: number;
  bayesian: BayesianHypothesisProbabilities;
  indices: CompositeAstrobiologyIndices;
  pillars: ProbabilisticPillarScore[];
  cryoscopicModel: CryoscopicSubsurfaceModel;
  molecules: BiogenicMoleculeContribution[];
  thermodynamicsSummary: {
    effectiveTempKelvin: number;
    effectiveTempCelsius: number;
    peakWavelengthUm: number;
    blackbodyEmittanceWm2: number;
    spherexColorIndexD6D1: number;
    kinematicTopology: "DIPOLE_MOTION" | "MONOPOLE_VARIABLE" | "STATIC_BACKGROUND" | "AWAITING_EPOCHS";
    coaddedSnr: number;
    statisticalPowerPct: number;
  };
  humanTranslation: HumanAstrobiologyTranslation;
  academicCitationsApa7: string[];
  academicThesisMarkdownEs: string;
  academicThesisMarkdownEn: string;
}
