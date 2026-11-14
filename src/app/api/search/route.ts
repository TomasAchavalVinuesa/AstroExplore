import { NextRequest, NextResponse } from "next/server";
import type { SpherexObservation } from "@/lib/types";

const IRSA_SIA_URL = "https://irsa.ipac.caltech.edu/SIA";
const ALLOWED_COLLECTIONS = new Set([
  "spherex_dr1",
  "spherex_dr1_deep",
  "spherex_qr3",
  "spherex_qr2",
]);

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function toFloat(val: string | undefined): number | null {
  if (!val) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function toMicrons(val: string | undefined): number | null {
  const m = toFloat(val);
  return m !== null ? Number((m * 1e6).toFixed(3)) : null;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const ra = Number(sp.get("ra"));
  const dec = Number(sp.get("dec"));
  const radius = Number(sp.get("radius") ?? "0.05");
  const collection = sp.get("collection") ?? "spherex_dr1";
  const band = (sp.get("band") ?? "all").toUpperCase();
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? "60")));

  if (!Number.isFinite(ra) || ra < 0 || ra > 360) {
    return NextResponse.json({ detail: "RA debe estar entre 0° y 360°." }, { status: 400 });
  }
  if (!Number.isFinite(dec) || dec < -90 || dec > 90) {
    return NextResponse.json({ detail: "Dec debe estar entre -90° y +90°." }, { status: 400 });
  }
  if (!Number.isFinite(radius) || radius <= 0 || radius > 2) {
    return NextResponse.json({ detail: "Radio debe estar entre 0° y 2°." }, { status: 400 });
  }
  if (!ALLOWED_COLLECTIONS.has(collection)) {
    return NextResponse.json({ detail: `Colección no válida: ${collection}` }, { status: 400 });
  }

  const params = new URLSearchParams({
    COLLECTION: collection,
    POS: `circle ${ra} ${dec} ${radius}`,
    RESPONSEFORMAT: "CSV",
  });
  const siaUrl = `${IRSA_SIA_URL}?${params.toString()}`;

  try {
    const res = await fetch(siaUrl, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      return NextResponse.json(
        { detail: `IRSA SIA devolvió HTTP ${res.status}` },
        { status: 502 }
      );
    }
    const csvText = await res.text();
    const rows = parseCsvRows(csvText);

    const observations: SpherexObservation[] = [];
    for (const row of rows) {
      const accessUrl = (row.access_url ?? "").trim();
      if (!accessUrl) continue;

      const bandpass = (row.energy_bandpassname ?? "").trim();
      if (band !== "ALL" && !bandpass.toUpperCase().endsWith(band)) {
        continue;
      }

      observations.push({
        obs_id: row.obs_id ?? "",
        bandpass,
        em_min_um: toMicrons(row.em_min),
        em_max_um: toMicrons(row.em_max),
        s_ra: toFloat(row.s_ra),
        s_dec: toFloat(row.s_dec),
        t_exptime: toFloat(row.t_exptime),
        obs_release_date: row.obs_release_date ?? "",
        obs_collection: row.obs_collection || collection,
        s_pixel_scale: toFloat(row.s_pixel_scale),
        access_url: accessUrl,
      });
    }

    observations.sort((a, b) =>
      `${a.bandpass}:${a.obs_id}`.localeCompare(`${b.bandpass}:${b.obs_id}`)
    );

    return NextResponse.json({
      query: { ra, dec, radius, collection, band },
      sia_url: siaUrl,
      total_found: observations.length,
      observations: observations.slice(0, limit),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `Error consultando IRSA SIA: ${msg}` }, { status: 502 });
  }
}
