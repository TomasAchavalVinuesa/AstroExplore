/**
 * CHRONO-SPHEREx Statistical & Multi-Epoch Pattern Detection Module (PyE)
 * + Sector A (Joaquín): Minimum-Variance Statistics (Devore) & Radiative Thermodynamics (Çengel)
 *
 * Independent, modular feature package ready for 1-line invocation from Tomy's main code.
 */

export * from "./types";
export * from "./constants";
export * from "./joakoEngine";
export * from "./engine";
export { TemporalStatsLab, type TemporalStatsLabProps } from "./TemporalStatsLab";
