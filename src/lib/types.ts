export type SpherexCollectionId = "spherex_dr1";
export type CollectionQueryMode = SpherexCollectionId;

export interface SpherexObservation {
  obs_id: string;
  bandpass: string;
  em_min_um: number | null;
  em_max_um: number | null;
  s_ra: number | null;
  s_dec: number | null;
  t_exptime: number | null;
  t_min: number | null;
  t_max: number | null;
  epoch_date: string | null;
  epoch_datetime: string | null;
  obs_release_date: string;
  obs_collection: string;
  s_pixel_scale: number | null;
  access_url: string;
  s_region?: string;
}

export interface SearchResponse {
  query: {
    ra: number;
    dec: number;
    radius: number;
    collection: string;
    band: string;
  };
  sia_url: string;
  total_found: number;
  observations: SpherexObservation[];
}

export interface CollectionVersionData {
  collection: SpherexCollectionId;
  sia_url: string;
  total_found: number;
  observations: SpherexObservation[];
  bandsAvailable: string[];
}

export interface MultiVersionSearchResponse {
  query: {
    ra: number;
    dec: number;
    radius: number;
    collectionMode: CollectionQueryMode;
    band: string;
  };
  versions: Record<SpherexCollectionId, CollectionVersionData>;
  totalAcrossVersions: number;
  availableCollections: SpherexCollectionId[];
  recommendedCollection: SpherexCollectionId;
}

export interface CutoutStats {
  min: number;
  max: number;
  median: number;
  mean: number;
  unit: string;
  detector: string;
  shape: [number, number];
  has_zodi: boolean;
}

export interface FitsWcs {
  crval1: number;
  crval2: number;
  crpix1: number;
  crpix2: number;
  cd1_1: number;
  cd1_2: number;
  cd2_1: number;
  cd2_2: number;
}

export interface RenderedCutout {
  imageData: ImageData;
  dataUrl: string;
  width: number;
  height: number;
  stats: CutoutStats;
  wcs: FitsWcs | null;
  fits_cutout_url: string;
}

export type StretchMode = "asinh" | "log" | "sqrt" | "linear";
export type ColormapName = "inferno" | "viridis" | "plasma" | "magma" | "gray";

export interface TargetPreset {
  id: string;
  label: string;
  queryName: string;
  category: string;
  ra: string;
  dec: string;
  collection: CollectionQueryMode;
  description: string;
}

export interface ResolvedCelestialObject {
  query: string;
  canonicalName: string;
  otype: string;
  raDeg: number;
  decDeg: number;
  raHms: string;
  decDms: string;
  pmRa: number | null;
  pmDec: number | null;
  aliases: string[];
  resolverSource: string;
}
