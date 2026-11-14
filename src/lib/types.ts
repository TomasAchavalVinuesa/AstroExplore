export interface SpherexObservation {
  obs_id: string;
  bandpass: string;
  em_min_um: number | null;
  em_max_um: number | null;
  s_ra: number | null;
  s_dec: number | null;
  t_exptime: number | null;
  obs_release_date: string;
  obs_collection: string;
  s_pixel_scale: number | null;
  access_url: string;
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

export interface CutoutResponse {
  image_base64: string;
  width: number;
  height: number;
  stats: CutoutStats;
  fits_cutout_url: string;
}

export type StretchMode = "asinh" | "log" | "sqrt" | "linear";
export type ColormapName = "inferno" | "viridis" | "plasma" | "magma" | "gray";
