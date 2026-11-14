import { formatDectoDMS, formatRAtoHMS, parseDec, parseRA } from "./coordinates";
import type { ResolvedCelestialObject } from "./types";

const SESAME_ORIGIN = "https://cds.unistra.fr";

interface KnownTargetOverride {
  sesameQuery: string;
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
 * Diccionario de normalización y respaldo para objetos destacados de SPHEREx
 * (como WISE 0855 que en SIMBAD figura como WISE J085510.83-071442.5 y posee alto movimiento propio).
 */
const KNOWN_TARGET_OVERRIDES: Record<string, KnownTargetOverride> = {
  "wise 0855": {
    sesameQuery: "WISE J085510.83-071442.5",
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
    sesameQuery: "WISE J085510.83-071442.5",
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
    sesameQuery: "Barnard's Star",
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
    sesameQuery: "Barnard's Star",
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
    sesameQuery: "Barnard's Star",
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
    sesameQuery: "Epsilon Indi B",
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
    sesameQuery: "RW Aurigae",
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
    sesameQuery: "R Draconis",
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

function getText(parent: Element | Document, tag: string): string | null {
  const el = parent.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() || null;
}

function getNumber(parent: Element | Document, tag: string): number | null {
  const txt = getText(parent, tag);
  if (!txt) return null;
  const n = Number(txt);
  return Number.isFinite(n) ? n : null;
}

/**
 * Consulta la API pública CDS Sesame (SIMBAD / NED / VizieR) para resolver
 * un nombre de cuerpo celeste a sus coordenadas ICRS (RA, Dec) y metadatos.
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
  const sesameQuery = override ? override.sesameQuery : trimmed;

  const pathAndQuery = `/cgi-bin/nph-sesame/-oxp/SNV?${encodeURIComponent(sesameQuery)}`;
  const directUrl = `${SESAME_ORIGIN}${pathAndQuery}`;
  const proxyUrl = `/sesame-proxy${pathAndQuery}`;

  let xmlText = "";
  try {
    // Sesame habilita CORS (Access-Control-Allow-Origin: *) de forma nativa
    const res = await fetch(directUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xmlText = await res.text();
  } catch {
    try {
      const resProxy = await fetch(proxyUrl);
      if (resProxy.ok) {
        xmlText = await resProxy.text();
      }
    } catch {
      // Si falla por red y existe override local, usamos el respaldo verificado
    }
  }

  if (xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const resolvers = Array.from(doc.getElementsByTagName("Resolver"));

    for (const resolver of resolvers) {
      const jradeg = getNumber(resolver, "jradeg");
      const jdedeg = getNumber(resolver, "jdedeg");

      if (jradeg !== null && jdedeg !== null) {
        const oname = getText(resolver, "oname") ?? override?.canonicalName ?? trimmed;
        const otype = getText(resolver, "otype") ?? override?.otype ?? "Celestial Object";
        const pmRa = getNumber(resolver, "pmRA") ?? override?.pmRa ?? null;
        const pmDec = getNumber(resolver, "pmDE") ?? override?.pmDec ?? null;
        const resolverName = resolver.getAttribute("name")?.split("=")[0] ?? "CDS Sesame";

        const aliasNodes = Array.from(resolver.getElementsByTagName("alias"));
        const aliases = aliasNodes
          .map((n) => n.textContent?.trim() ?? "")
          .filter((a) => a.length > 0 && a !== oname)
          .slice(0, 6);

        // Para WISE 0855 preservamos la coordenada exacta de época SPHEREx (08h55m10.831s, -7d14m42.53s)
        const isWise0855 = normalizedKey.startsWith("wise 0855");
        const finalRaDeg = isWise0855 && override ? override.raDeg : jradeg;
        const finalDecDeg = isWise0855 && override ? override.decDeg : jdedeg;
        const finalRaHms =
          isWise0855 && override?.raHms ? override.raHms : formatRAtoHMS(finalRaDeg);
        const finalDecDms =
          isWise0855 && override?.decDms ? override.decDms : formatDectoDMS(finalDecDeg);

        const resolved: ResolvedCelestialObject = {
          query: trimmed,
          canonicalName: oname,
          otype,
          raDeg: finalRaDeg,
          decDeg: finalDecDeg,
          raHms: finalRaHms,
          decDms: finalDecDms,
          pmRa,
          pmDec,
          aliases: aliases.length > 0 ? aliases : (override?.aliases ?? []),
          resolverSource: `CDS Sesame (${resolverName})`,
        };

        resolverCache.set(normalizedKey, resolved);
        return resolved;
      }
    }
  }

  // Fallback si es uno de los objetivos destacados conocidos
  if (override) {
    const fallbackResolved: ResolvedCelestialObject = {
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
      resolverSource: "SPHEREx / CDS Catalog",
    };
    resolverCache.set(normalizedKey, fallbackResolved);
    return fallbackResolved;
  }

  throw new Error("OBJECT_NOT_FOUND");
}
