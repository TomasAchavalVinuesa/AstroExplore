/**
 * CHRONO-SPHEREx Statistical & Multi-Epoch Pattern Detection Module (PyE)
 * Formal physical-mathematical and statistical types grounded in:
 * - Jay L. Devore (Probability and Statistics for Engineering and the Sciences, Caps. 5, 6, 7, 8)
 * - Yunus A. Çengel & Michael A. Boles (Thermodynamics: An Engineering Approach, 7th Ed., Cap. 12)
 * - Erwin Kreyszig (Advanced Engineering Mathematics, Cap. 24)
 * - Sears & Zemansky (University Physics Vols. 1 & 2)
 */

export type PatternTopology =
  | "DIPOLE_MOTION"       // +Z lobe paired with -Z lobe -> Astrometric proper motion / Planet X / Brown Dwarf
  | "MONOPOLE_VARIABLE"   // Isolated +Z or -Z lobe at static coordinates -> Intrinsic variable star (RW Aur, R Dra)
  | "STATIC_BACKGROUND"   // |Z| < 3σ across the field -> Null hypothesis H0 holds (static sky)
  | "AWAITING_EPOCHS";    // Fewer than 2 epochs loaded

export type StatisticalDecision =
  | "REJECT_H0_GOLD_STANDARD"   // |Z| >= 5.0σ (p <= 5.73e-7, 99.99994% confidence)
  | "REJECT_H0_SIGNIFICANT"     // 3.0σ <= |Z| < 5.0σ (p <= 0.0027, >= 99.73% confidence)
  | "MARGINAL_FLUCTUATION"      // 2.0σ <= |Z| < 3.0σ (tentative, requires coaddition)
  | "FAIL_TO_REJECT_H0";        // |Z| < 2.0σ (consistent with Gaussian thermal/zodiacal noise)

export type ThermalTrafficLightStatus =
  | "PLANET_X_COLD_WORLD_ALERT" // F_D6 >> F_D1 (Color_IR > +2.5, T_eff < 450 K)
  | "COOL_SUBSET_BROWN_DWARF"   // Moderate red infrared excess (+0.5 <= Color_IR <= +2.5)
  | "ORDINARY_HOT_STAR";        // F_D1 >= F_D6 (Color_IR < +0.5, T_eff > 2500 K)

export interface SnrProgressionPoint {
  bandCount: number;        // n = 1 .. 17
  cumulativeSnr: number;    // SNR(n) = sqrt(sum_{i=1}^n SNR_i^2)
  noiseStdFactor: number;   // 1 / sqrt(n)
  detectionUnlocked: boolean; // True when cumulativeSnr >= 5.0σ (Gold Standard)
}

export interface CoadditionSnrMetrics {
  bandsPerDetector: number;          // N = 17 bands per SPHEREx detector array (102 / 6)
  singleBandMeanSnr: number;         // Average SNR of an individual LVF channel
  coaddedSnr: number;                // SNR_coadd = sqrt(sum(SNR_i^2)) ≈ sqrt(17) * SNR_band
  theoreticalGainFactor: number;     // sqrt(17) ≈ 4.1231
  percentageSnrBoost: number;        // +312.31%
  noiseVarianceReductionFactor: number; // sigma_coadd^2 = sigma^2 / 17 (94.1% variance reduction)
  // Advanced Jay Devore Caps. 5, 6, 7, 8 metrics (Joaquín's Statistical Core):
  mvueCoaddedFluxMjySr: number;      // I_coadd = sum(w_i * I_i) / sum(w_i), w_i = 1 / sigma_i^2
  mvueStandardErrorMjySr: number;    // sigma_coadd = 1 / sqrt(sum(w_i))
  ci95LowerMjySr: number;            // I_coadd - 1.96 * sigma_coadd
  ci95UpperMjySr: number;            // I_coadd + 1.96 * sigma_coadd
  ci99LowerMjySr: number;            // I_coadd - 2.5758 * sigma_coadd
  ci99UpperMjySr: number;            // I_coadd + 2.5758 * sigma_coadd
  singleBandTypeIIErrorBeta: number; // Probability beta of missing the object in 1 band at 5σ threshold
  coaddedStatisticalPower: number;   // Power (1 - beta) after 17-band coaddition at 5σ threshold
  progressionCurve: SnrProgressionPoint[]; // Step-by-step SNR from n=1 to n=17 bands
}

export interface DifferenceHypothesisTest {
  nullHypothesisH0: string;
  alternativeHypothesisH1: string;
  backgroundMeanDiff: number;        // mu_D (robust median of difference matrix D)
  combinedNoiseSigmaD: number;       // sigma_D = sqrt(sigma_1^2 + sigma_2^2)
  peakPositiveZ: number;             // +Z_max (arrival at t2 or brightening)
  peakNegativeZ: number;             // -Z_min (departure from t1 or dimming)
  maxAbsZScore: number;              // |Z|_max test statistic
  twoTailedPValue: number;           // p = 2 * (1 - Phi(|Z|))
  confidencePercentage: number;      // (1 - p) * 100
  decision: StatisticalDecision;
  topology: PatternTopology;
  dipoleSymmetryRatio: number | null; // |Z_max| / |Z_min| (~1.0 for pure translation dipole)
  fluxVariationPercent: number;       // Relative flux change between t1 and t2
  contaminatedPixelsMasked: number;   // HDU[2] FLAGS != 0 cosmic ray rejections
  zodiSubtracted: boolean;            // HDU[4] ZODI subtraction status
}

export interface ProperMotionKinematics {
  epoch1Label: string;
  epoch2Label: string;
  mjd1: number;
  mjd2: number;
  deltaTimeYears: number;            // Delta t = (MJD2 - MJD1) / 365.25
  pixelScaleArcsec: number;          // SPHEREx official s = 6.2 arcsec/pixel
  centroidT1: { x: number; y: number }; // Pixel coordinates at t1
  centroidT2: { x: number; y: number }; // Pixel coordinates at t2
  deltaPixelX: number;
  deltaPixelY: number;
  deltaRaArcsec: number;             // Delta alpha* = dx * s
  deltaDecArcsec: number;            // Delta delta = dy * s
  totalDisplacementArcsec: number;   // Delta r = sqrt(Delta alpha*^2 + Delta delta^2)
  muRaMasYr: number;                 // mu_alpha* in mas/yr
  muDecMasYr: number;                // mu_delta in mas/yr
  muTotalArcsecYr: number;           // mu_total in arcsec/yr
  muTotalMasYr: number;              // mu_total in mas/yr
  positionAngleDeg: number;          // theta = atan2(mu_alpha*, mu_delta) mod 360 (East of North)
}

export interface ParallaxDistanceMetrics {
  parallaxArcsec: number | null;     // p = Delta theta_parallax / 2 [arcsec]
  parallaxMas: number | null;        // p [mas]
  distanceParsecs: number | null;    // d_pc = 1 / p
  distanceLightYears: number | null; // d_ly = 3.26156 * d_pc
  tangentialVelocityKmS: number | null; // v_t = 4.74047 * mu * d_pc [km/s]
  isSolarNeighborhood: boolean;      // True if d_ly < 50 ly or planetary candidate
}

export interface PlanckCurveSample {
  wavelengthUm: number;              // lambda [µm] from 0.75 to 5.00 µm
  spectralEmittanceWm2Um: number;    // E_b,lambda(lambda, T) [W/(m^2·µm)] (Çengel Eq. 12-4)
  normalizedIntensity: number;       // [0..1] normalized to peak within SPHEREx range
  detectorId: "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
}

export interface DetectorRadiationFraction {
  detectorId: "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
  waveRangeUm: [number, number];
  inBandEmittanceWm2: number;        // Integral of E_b,lambda over detector waveband
  fractionOfSpherexTotalPct: number; // % of SPHEREx 0.75-5.00 µm flux captured by this detector
}

export interface RadiativeThermodynamicsMetrics {
  peakWavelengthUm: number;          // lambda_max [µm]
  effectiveTempKelvin: number;       // T_eff = 2897.77 / lambda_max [K] (Wien's Law, Çengel Eq. 12-5)
  effectiveTempCelsius: number;      // T_C = T_eff - 273.15 [°C]
  blackbodyEmittanceWm2: number;     // E_b = sigma * T_eff^4 [W/m^2] (Stefan-Boltzmann, Çengel Eq. 12-6)
  spherexColorIndexD6D1: number;     // Color_IR = -2.5 * log10(F_D6 / F_D1)
  fluxRatioD6OverD1: number;         // F_D6 / F_D1 linear ratio
  thermalTrafficLight: ThermalTrafficLightStatus; // "Semáforo Térmico" from Obsidian Vault
  thermalRegimeLabel: string;
  // Advanced Yunus A. Çengel Cap. 12 Radiative Heat Transfer metrics (Joaquín's Thermodynamics Core):
  meanPhotonEnergyEv: number;        // E_photon = h * c / lambda_max [eV]
  spherexBandFractionPct: number;    // Fraction F_(0.75->5.00µm) of total blackbody radiation captured by SPHEREx
  internalHeatDominance: boolean;    // True if T_eff >> T_eq (Kelvin-Helmholtz internal heat in brown dwarfs / Planet X)
  habitabilityPhaseState: "CRYOGENIC_SOLID_ICE" | "TEMPERATE_LIQUID_WATER_WINDOW" | "HOT_VAPOR_GAS_REGIME";
  detectorFractions: DetectorRadiationFraction[]; // Energy distribution across D1..D6
  planckCurveSamples: PlanckCurveSample[];        // 60-point Planck curve E_b,lambda for SVG plotting
}

export interface HumanGroundedConclusions {
  headlineVerdict: string;
  whatChangedSummary: string;
  statisticalCertaintyPlain: string; // Coin-flip / false-positive odds analogy
  motionPlainAnalogy: string;        // Full Moon diameter crossing time & speed vs Voyager 1
  thermalBillAnalogy: string;        // "Factura de Luz" analogy (LED bulb W/m² & Antarctica °C)
  studentTakeaway: string;           // Clear PyE conclusion for university/high-school lab reports
}

export interface ZScoreMatrixRenderData {
  width: number;
  height: number;
  zValues: Float32Array;             // Standardized Z(x,y) per pixel
  diffValues: Float32Array;          // Raw difference D(x,y) = I2(x,y) - I1(x,y)
  peakPosCoord: { x: number; y: number };
  peakNegCoord: { x: number; y: number };
}

export interface JoakoStatisticalThermoResult {
  targetName: string;
  dataSourceMode: "LIVE_IRSA_FITS_CUTOUTS" | "CALIBRATED_ARCHIVE_BENCHMARK" | "AWAITING_LIVE_NASA_DATA";
  isLiveNasaData: boolean;
  coaddition: CoadditionSnrMetrics;
  hypothesisTest: DifferenceHypothesisTest;
  thermodynamics: RadiativeThermodynamicsMetrics;
  humanSummaryEs: {
    coadditionPlain: string;
    hypothesisPlain: string;
    thermodynamicsPlain: string;
    trafficLightBadge: string;
  };
  humanSummaryEn: {
    coadditionPlain: string;
    hypothesisPlain: string;
    thermodynamicsPlain: string;
    trafficLightBadge: string;
  };
}

export interface TemporalAstrophysicsReport {
  targetName: string;
  coordinates: { ra: number; dec: number };
  dataSourceMode: "LIVE_IRSA_FITS_CUTOUTS" | "CALIBRATED_ARCHIVE_BENCHMARK";
  output1_coaddition: CoadditionSnrMetrics;
  output2_hypothesisTest: DifferenceHypothesisTest;
  output3_properMotion: ProperMotionKinematics;
  output4_parallaxDistance: ParallaxDistanceMetrics;
  output5_thermodynamics: RadiativeThermodynamicsMetrics;
  output6_dominantMolecules: string[];
  joakoModule: JoakoStatisticalThermoResult;
  humanConclusionsEs: HumanGroundedConclusions;
  humanConclusionsEn: HumanGroundedConclusions;
  zScoreMatrix: ZScoreMatrixRenderData;
  academicThesisMarkdownEs: string;
  academicThesisMarkdownEn: string;
}
