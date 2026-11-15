import { compareRoiReadings } from "./spectralAnalysis";
import type {
  CelestialTrajectoryResult,
  ChemicalIdentityCheck,
  ExtrapolatedPosition,
  SavedRoiReading,
  TrajectoryModelType,
  TrajectoryPoint,
  TrajectorySegment,
} from "./types";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const DAYS_PER_YEAR = 365.25;
const MJD_UNIX_EPOCH = 40587.0;
const MS_PER_DAY = 86_400_000;

export function dateStringToMjd(dateStr: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  if (!Number.isFinite(utcMs)) return null;
  return utcMs / MS_PER_DAY + MJD_UNIX_EPOCH;
}

export function mjdToDateString(mjd: number): string {
  const utcMs = (mjd - MJD_UNIX_EPOCH) * MS_PER_DAY;
  return new Date(utcMs).toISOString().slice(0, 10);
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const mjd = dateStringToMjd(dateStr);
  if (mjd === null) return dateStr;
  return mjdToDateString(mjd + days);
}

/**
 * Verifica mediante comparación espectral y química por pares si las áreas seleccionadas
 * corresponden al mismo cuerpo celeste.
 */
export function validateSameCelestialBody(readings: SavedRoiReading[]): ChemicalIdentityCheck {
  if (readings.length < 2) {
    return {
      compatible: false,
      confidence: "insufficient",
      avgSimilarityPct: null,
      minSimilarityPct: null,
      sharedDetectedFormulas: [],
      pairCount: 0,
      insufficientOverlapPairs: 0,
    };
  }

  const similarities: number[] = [];
  let insufficientOverlapPairs = 0;
  let pairCount = 0;
  let sharedList: string[] | null = null;

  for (let i = 0; i < readings.length; i++) {
    for (let j = i + 1; j < readings.length; j++) {
      pairCount++;
      const cmp = compareRoiReadings(readings[i], readings[j]);
      if (cmp.insufficientOverlap || cmp.overallSimilarityPct === null) {
        insufficientOverlapPairs++;
      } else {
        similarities.push(cmp.overallSimilarityPct);
        const pairShared = new Set(cmp.sharedDetectedFormulas);
        if (sharedList === null) {
          sharedList = cmp.sharedDetectedFormulas;
        } else {
          sharedList = sharedList.filter((f) => pairShared.has(f));
        }
      }
    }
  }

  if (similarities.length === 0) {
    return {
      compatible: false,
      confidence: "insufficient",
      avgSimilarityPct: null,
      minSimilarityPct: null,
      sharedDetectedFormulas: [],
      pairCount,
      insufficientOverlapPairs,
    };
  }

  const avg = Number(
    (similarities.reduce((acc, v) => acc + v, 0) / similarities.length).toFixed(1)
  );
  const min = Number(Math.min(...similarities).toFixed(1));
  const sharedDetectedFormulas = sharedList ?? [];

  if (min >= 75 && avg >= 80) {
    return {
      compatible: true,
      confidence: "high",
      avgSimilarityPct: avg,
      minSimilarityPct: min,
      sharedDetectedFormulas,
      pairCount,
      insufficientOverlapPairs,
    };
  }

  if (min >= 60) {
    return {
      compatible: true,
      confidence: "moderate",
      avgSimilarityPct: avg,
      minSimilarityPct: min,
      sharedDetectedFormulas,
      pairCount,
      insufficientOverlapPairs,
    };
  }

  return {
    compatible: false,
    confidence: "low",
    avgSimilarityPct: avg,
    minSimilarityPct: min,
    sharedDetectedFormulas,
    pairCount,
    insufficientOverlapPairs,
  };
}

function fitLinearOLS(taus: number[], vals: number[]): [number, number] {
  const n = taus.length;
  let sumT = 0;
  let sumV = 0;
  for (let i = 0; i < n; i++) {
    sumT += taus[i];
    sumV += vals[i];
  }
  const meanT = sumT / n;
  const meanV = sumV / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dt = taus[i] - meanT;
    num += dt * (vals[i] - meanV);
    den += dt * dt;
  }

  const b1 = den > 1e-12 ? num / den : 0;
  const b0 = meanV - b1 * meanT;
  return [b0, b1];
}

function solveLinear3x3(A: number[][], b: number[]): number[] | null {
  const M = A.map((row, i) => [...row, b[i]]);
  const n = 3;

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > maxAbs) {
        maxAbs = Math.abs(M[r][col]);
        pivotRow = r;
      }
    }
    if (maxAbs < 1e-12) return null;
    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    }

    const pivot = M[col][col];
    for (let j = col; j <= n; j++) {
      M[col][j] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let j = col; j <= n; j++) {
        M[r][j] -= factor * M[col][j];
      }
    }
  }

  return [M[0][3], M[1][3], M[2][3]];
}

function fitQuadraticOLS(taus: number[], vals: number[]): number[] {
  const n = taus.length;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let sy = 0;
  let sty = 0;
  let st2y = 0;

  for (let i = 0; i < n; i++) {
    const t = taus[i];
    const t2 = t * t;
    const y = vals[i];
    s1 += t;
    s2 += t2;
    s3 += t2 * t;
    s4 += t2 * t2;
    sy += y;
    sty += t * y;
    st2y += t2 * y;
  }

  const solved = solveLinear3x3(
    [
      [n, s1, s2],
      [s1, s2, s3],
      [s2, s3, s4],
    ],
    [sy, sty, st2y]
  );

  return solved ?? fitLinearOLS(taus, vals);
}

function evalPoly(coeffs: number[], tau: number): number {
  let acc = 0;
  let pow = 1;
  for (let i = 0; i < coeffs.length; i++) {
    acc += coeffs[i] * pow;
    pow *= tau;
  }
  return acc;
}

function normalizeRaDeg(ra: number): number {
  const mod = ra % 360;
  return mod < 0 ? mod + 360 : mod;
}

function shortestDeltaRaDeg(ra: number, refRa: number): number {
  return ((ra - refRa + 540) % 360) - 180;
}

/**
 * Calcula la trayectoria astrométrica observada y ajusta el modelo cinemático
 * (lineal de movimiento propio o cuadrático opcional para >= 3 épocas).
 */
export function computeCelestialTrajectory(
  readings: SavedRoiReading[],
  requestedModel: TrajectoryModelType = "linear"
): CelestialTrajectoryResult | null {
  const withEpoch = readings
    .filter(
      (r) =>
        r.roi.epochMjd !== null &&
        r.roi.epochMjd !== undefined &&
        Number.isFinite(r.roi.epochMjd)
    )
    .slice()
    .sort((a, b) => (a.roi.epochMjd ?? 0) - (b.roi.epochMjd ?? 0));

  if (withEpoch.length < 2) return null;

  const first = withEpoch[0];
  const refRa = first.roi.centroidRa ?? first.roi.centerRa;
  const refDec = first.roi.centroidDec ?? first.roi.centerDec;
  const cosRefDec = Math.max(0.05, Math.cos(refDec * DEG2RAD));

  const points: TrajectoryPoint[] = withEpoch.map((r) => {
    const usedPhotocenter =
      r.roi.centroidRa !== undefined && r.roi.centroidDec !== undefined;
    const ra = r.roi.centroidRa ?? r.roi.centerRa;
    const dec = r.roi.centroidDec ?? r.roi.centerDec;
    const epochMjd = r.roi.epochMjd!;
    const xiArcsec = shortestDeltaRaDeg(ra, refRa) * cosRefDec * 3600;
    const etaArcsec = (dec - refDec) * 3600;
    return {
      readingId: r.id,
      label: r.name,
      ra,
      dec,
      epochDate: r.roi.epochDate ?? mjdToDateString(epochMjd),
      epochMjd,
      xiArcsec,
      etaArcsec,
      usedPhotocenter,
    };
  });

  const totalSpanDays = points[points.length - 1].epochMjd - points[0].epochMjd;
  if (totalSpanDays <= 1e-4) return null;

  const segments: TrajectorySegment[] = [];
  let totalPathArcsec = 0;

  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const dXi = p1.xiArcsec - p0.xiArcsec;
    const dEta = p1.etaArcsec - p0.etaArcsec;
    const dist = Math.hypot(dXi, dEta);
    const dt = p1.epochMjd - p0.epochMjd;
    const speedDay = dt > 1e-6 ? dist / dt : 0;
    const pa = ((Math.atan2(dXi, dEta) * RAD2DEG) % 360 + 360) % 360;
    totalPathArcsec += dist;
    segments.push({
      fromLabel: p0.label,
      toLabel: p1.label,
      deltaDays: dt,
      distanceArcsec: dist,
      speedArcsecPerDay: speedDay,
      speedArcsecPerYear: speedDay * DAYS_PER_YEAR,
      positionAngleDeg: pa,
    });
  }

  const last = points[points.length - 1];
  const netDisplacementArcsec = Math.hypot(last.xiArcsec, last.etaArcsec);

  const distinctEpochs = new Set(points.map((p) => p.epochMjd.toFixed(4))).size;
  const effectiveModel: TrajectoryModelType =
    requestedModel === "quadratic" && distinctEpochs >= 3 ? "quadratic" : "linear";

  const meanMjd = points.reduce((acc, p) => acc + p.epochMjd, 0) / points.length;
  const taus = points.map((p) => p.epochMjd - meanMjd);
  const xis = points.map((p) => p.xiArcsec);
  const etas = points.map((p) => p.etaArcsec);

  let coeffsXi =
    effectiveModel === "quadratic" ? fitQuadraticOLS(taus, xis) : fitLinearOLS(taus, xis);
  let coeffsEta =
    effectiveModel === "quadratic" ? fitQuadraticOLS(taus, etas) : fitLinearOLS(taus, etas);

  const finalModel: TrajectoryModelType =
    coeffsXi.length === 3 && coeffsEta.length === 3 ? "quadratic" : "linear";

  if (finalModel === "linear") {
    coeffsXi = coeffsXi.slice(0, 2);
    coeffsEta = coeffsEta.slice(0, 2);
  }

  let sqRes = 0;
  for (let i = 0; i < points.length; i++) {
    const rXi = xis[i] - evalPoly(coeffsXi, taus[i]);
    const rEta = etas[i] - evalPoly(coeffsEta, taus[i]);
    sqRes += rXi * rXi + rEta * rEta;
  }
  const dof = Math.max(1, points.length - coeffsXi.length);
  const rmsResidualArcsec = Math.sqrt(sqRes / dof);

  // Velocidad instantánea promedio (evaluada en el punto medio temporal, donde tau = 0 -> c1)
  const pmRaArcsecPerYear = (coeffsXi[1] ?? 0) * DAYS_PER_YEAR;
  const pmDecArcsecPerYear = (coeffsEta[1] ?? 0) * DAYS_PER_YEAR;
  const totalSpeedArcsecPerYear = Math.hypot(pmRaArcsecPerYear, pmDecArcsecPerYear);
  const positionAngleDeg =
    ((Math.atan2(pmRaArcsecPerYear, pmDecArcsecPerYear) * RAD2DEG) % 360 + 360) % 360;

  return {
    model: finalModel,
    points,
    segments,
    refRa,
    refDec,
    meanMjd,
    totalSpanDays,
    totalPathArcsec,
    netDisplacementArcsec,
    pmRaArcsecPerYear,
    pmDecArcsecPerYear,
    totalSpeedArcsecPerYear,
    positionAngleDeg,
    rmsResidualArcsec,
    coeffsXi,
    coeffsEta,
  };
}

/**
 * Extrapola (o interpola) la posición celeste estimada para una fecha objetivo (YYYY-MM-DD).
 */
export function extrapolatePositionAtDate(
  trajectory: CelestialTrajectoryResult,
  targetDate: string
): ExtrapolatedPosition | null {
  const targetMjd = dateStringToMjd(targetDate);
  if (targetMjd === null) return null;

  const tau = targetMjd - trajectory.meanMjd;
  const xiArcsec = evalPoly(trajectory.coeffsXi, tau);
  const etaArcsec = evalPoly(trajectory.coeffsEta, tau);

  const cosRefDec = Math.max(0.05, Math.cos(trajectory.refDec * DEG2RAD));
  const ra = normalizeRaDeg(trajectory.refRa + xiArcsec / (3600 * cosRefDec));
  const dec = Math.max(-90, Math.min(90, trajectory.refDec + etaArcsec / 3600));

  const first = trajectory.points[0];
  const last = trajectory.points[trajectory.points.length - 1];

  const displacementFromFirstArcsec = Math.hypot(
    xiArcsec - first.xiArcsec,
    etaArcsec - first.etaArcsec
  );
  const displacementFromLastArcsec = Math.hypot(
    xiArcsec - last.xiArcsec,
    etaArcsec - last.etaArcsec
  );
  const deltaDaysFromLast = targetMjd - last.epochMjd;

  const isExtrapolation = targetMjd < first.epochMjd || targetMjd > last.epochMjd;

  // Estimación de incertidumbre 1-sigma: crece con la distancia temporal al rango observado
  const baseSigma = Math.max(0.6, trajectory.rmsResidualArcsec);
  const span = Math.max(1, trajectory.totalSpanDays);
  const leverRatio = Math.abs(tau) / span;
  const modelFactor = trajectory.model === "quadratic" ? 1 + 0.45 * leverRatio * leverRatio : 1 + 0.35 * leverRatio;
  const uncertaintyArcsec = Number((baseSigma * modelFactor).toFixed(2));

  return {
    targetDate,
    targetMjd,
    ra,
    dec,
    xiArcsec,
    etaArcsec,
    uncertaintyArcsec,
    displacementFromLastArcsec,
    displacementFromFirstArcsec,
    deltaDaysFromLast,
    isExtrapolation,
  };
}
