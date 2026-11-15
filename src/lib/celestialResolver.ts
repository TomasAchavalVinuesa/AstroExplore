import { formatDectoDMS, formatRAtoHMS, parseDec, parseRA } from "./coordinates";
import type { ResolvedCelestialObject } from "./types";

interface KnownTargetOverride {
  canonicalName: string;
  otype: string;
  raHms?: string;
  decDms?: string;
  raDeg: number;
  decDeg: number;
  pmRa: number | null;
  pmDec: number | null;
  aliases: string[];
}

/**
 * Catálogo local de objetos destacados de SPHEREx con coordenadas verificadas.
 */
const KNOWN_TARGET_OVERRIDES: Record<string, KnownTargetOverride> = {
  "wise 0855": {
    canonicalName: "WISE J085510.83-071442.5 (WISE 0855-0714)",
    otype: "BD* / Y4",
    raHms: "08h55m10.831s",
    decDms: "-7d14m42.53s",
    raDeg: parseRA("08h55m10.831s") ?? 133.795129,
    decDeg: parseDec("-7d14m42.53s") ?? -7.245147,
    pmRa: -8118.0,
    pmDec: 680.0,
    aliases: ["WISE 0855-0714", "WISEA J085510.74-071442.5", "WISE J085510.83-071442.5"],
  },
  "wise 0855-0714": {
    canonicalName: "WISE J085510.83-071442.5 (WISE 0855-0714)",
    otype: "BD* / Y4",
    raHms: "08h55m10.831s",
    decDms: "-7d14m42.53s",
    raDeg: parseRA("08h55m10.831s") ?? 133.795129,
    decDeg: parseDec("-7d14m42.53s") ?? -7.245147,
    pmRa: -8118.0,
    pmDec: 680.0,
    aliases: ["WISE 0855", "WISEA J085510.74-071442.5", "WISE J085510.83-071442.5"],
  },
  "barnard's star": {
    canonicalName: "NAME Barnard's star",
    otype: "BY* (High PM M4V)",
    raHms: "17h57m48.498s",
    decDms: "+04d41m36.11s",
    raDeg: 269.452077,
    decDeg: 4.693365,
    pmRa: -801.55,
    pmDec: 10362.39,
    aliases: ["GJ 699", "HIP 87937", "V* V2500 Oph"],
  },
  "barnard star": {
    canonicalName: "NAME Barnard's star",
    otype: "BY* (High PM M4V)",
    raHms: "17h57m48.498s",
    decDms: "+04d41m36.11s",
    raDeg: 269.452077,
    decDeg: 4.693365,
    pmRa: -801.55,
    pmDec: 10362.39,
    aliases: ["GJ 699", "HIP 87937", "V* V2500 Oph"],
  },
  "estrella de barnard": {
    canonicalName: "NAME Barnard's star",
    otype: "BY* (High PM M4V)",
    raHms: "17h57m48.498s",
    decDms: "+04d41m36.11s",
    raDeg: 269.452077,
    decDeg: 4.693365,
    pmRa: -801.55,
    pmDec: 10362.39,
    aliases: ["Barnard's Star", "GJ 699", "HIP 87937"],
  },
  "epsilon indi b": {
    canonicalName: "* eps Ind B",
    otype: "BD* (T1 + T6 Binary)",
    raHms: "22h04m10.595s",
    decDms: "-56d46m58.24s",
    raDeg: 331.044147,
    decDeg: -56.782844,
    pmRa: 3976.0,
    pmDec: -2486.0,
    aliases: ["* eps Ind Ba", "* eps Ind Bb", "GJ 845 B"],
  },
  "rw aurigae": {
    canonicalName: "V* RW Aur",
    otype: "TT* (T Tauri Variable)",
    raHms: "05h07m49.566s",
    decDms: "+30d24m05.18s",
    raDeg: 76.956526,
    decDeg: 30.401438,
    pmRa: 2.91,
    pmDec: -21.25,
    aliases: ["HD 240764", "HIP 23873", "IRAS 05046+3020"],
  },
  "r draconis": {
    canonicalName: "V* R Dra",
    otype: "Mi* (Mira Variable)",
    raHms: "16h32m40.227s",
    decDms: "+66d45m17.93s",
    raDeg: 248.167611,
    decDeg: 66.754979,
    pmRa: -10.89,
    pmDec: -24.08,
    aliases: ["HD 149880", "HIP 80894", "IRAS 16325+6651"],
  },
};

const resolverCache = new Map<string, ResolvedCelestialObject>();

/**
 * Resuelve un nombre de cuerpo celeste del catálogo local de ejemplos SPHEREx
 * a sus coordenadas ICRS (RA, Dec) y metadatos sin consultar APIs externas.
 */
export async function resolveCelestialName(rawQuery: string): Promise<ResolvedCelestialObject> {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    throw new Error("EMPTY_QUERY");
  }

  const normalizedKey = trimmed.toLowerCase().replace(/\s+/g, " ");
  const cached = resolverCache.get(normalizedKey);
  if (cached) {
    return cached;
  }

  const override = KNOWN_TARGET_OVERRIDES[normalizedKey];
  if (override) {
    const resolved: ResolvedCelestialObject = {
      query: trimmed,
      canonicalName: override.canonicalName,
      otype: override.otype,
      raDeg: override.raDeg,
      decDeg: override.decDeg,
      raHms: override.raHms ?? formatRAtoHMS(override.raDeg),
      decDms: override.decDms ?? formatDectoDMS(override.decDeg),
      pmRa: override.pmRa,
      pmDec: override.pmDec,
      aliases: override.aliases,
      resolverSource: "SPHEREx Catalog",
    };
    resolverCache.set(normalizedKey, resolved);
    return resolved;
  }

  throw new Error("OBJECT_NOT_FOUND");
}
