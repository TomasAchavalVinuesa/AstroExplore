from __future__ import annotations

import base64
import csv
import io
from collections import OrderedDict
from pathlib import Path
from typing import Literal
from urllib.parse import urlencode

import numpy as np
import requests
from astropy.io import fits
from astropy.visualization import (
    AsinhStretch,
    LinearStretch,
    LogStretch,
    PercentileInterval,
    SqrtStretch,
)
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

IRSA_SIA_URL = "https://irsa.ipac.caltech.edu/SIA"
ALLOWED_IRSA_PREFIX = "https://irsa.ipac.caltech.edu/"
ALLOWED_COLLECTIONS = {"spherex_dr1", "spherex_dr1_deep", "spherex_qr3", "spherex_qr2"}

# Simple in-memory LRU cache for FITS cutout bytes so changing stretch/colormap is instant.
_FITS_CACHE: OrderedDict[tuple[str, float, float, float], bytes] = OrderedDict()
_MAX_CACHE_ITEMS = 24

# 5-stop scientific colormaps (values 0..255 RGB) interpolated to 256-entry LUTs.
_CMAP_STOPS: dict[str, list[tuple[int, int, int]]] = {
    "inferno": [
        (0, 0, 4),
        (87, 16, 110),
        (188, 55, 84),
        (249, 142, 9),
        (252, 255, 164),
    ],
    "viridis": [
        (68, 1, 84),
        (59, 82, 139),
        (33, 145, 140),
        (94, 201, 98),
        (253, 231, 37),
    ],
    "plasma": [
        (13, 8, 135),
        (126, 3, 168),
        (204, 71, 120),
        (248, 149, 64),
        (240, 249, 33),
    ],
    "magma": [
        (0, 0, 4),
        (81, 18, 124),
        (183, 55, 121),
        (252, 137, 97),
        (252, 253, 191),
    ],
    "gray": [
        (0, 0, 0),
        (64, 64, 64),
        (128, 128, 128),
        (192, 192, 192),
        (255, 255, 255),
    ],
}


def _build_lut(name: str) -> np.ndarray:
    stops = _CMAP_STOPS.get(name, _CMAP_STOPS["inferno"])
    xp = np.linspace(0, 255, len(stops))
    x = np.arange(256)
    r = np.interp(x, xp, [s[0] for s in stops])
    g = np.interp(x, xp, [s[1] for s in stops])
    b = np.interp(x, xp, [s[2] for s in stops])
    return np.stack([r, g, b], axis=-1).astype(np.uint8)


_LUTS: dict[str, np.ndarray] = {k: _build_lut(k) for k in _CMAP_STOPS}

app = FastAPI(
    title="SPHEREx IRSA Explorer",
    description="Consulta de imágenes espectrales SPHEREx vía IRSA SIA & IBE Cutouts",
    version="1.0.0",
)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/search")
def search_spherex(
    ra: float = Query(..., ge=0.0, le=360.0, description="Ascensión Recta (grados, 0-360)"),
    dec: float = Query(..., ge=-90.0, le=90.0, description="Declinación (grados, -90 a +90)"),
    radius: float = Query(0.05, gt=0.0, le=2.0, description="Radio de búsqueda en grados"),
    collection: str = Query("spherex_dr1", description="Colección SIA de SPHEREx en IRSA"),
    band: str = Query("all", description="Filtro opcional de banda/detector (D1-D6 o all)"),
    limit: int = Query(60, ge=1, le=200, description="Máximo de observaciones a devolver"),
) -> dict:
    """Consulta el servicio SIAv2 de IRSA para obtener exposiciones SPHEREx que cubren (RA, Dec)."""
    if collection not in ALLOWED_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Colección no válida: {collection}")

    params = {
        "COLLECTION": collection,
        "POS": f"circle {ra} {dec} {radius}",
        "RESPONSEFORMAT": "CSV",
    }
    sia_url = f"{IRSA_SIA_URL}?{urlencode(params)}"

    try:
        resp = requests.get(sia_url, timeout=25)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Error consultando IRSA SIA: {exc}") from exc

    reader = csv.DictReader(io.StringIO(resp.text))
    observations = []
    band_filter = band.upper()

    for row in reader:
        access_url = (row.get("access_url") or "").strip()
        if not access_url:
            continue

        bandpass = (row.get("energy_bandpassname") or "").strip()
        if band_filter != "ALL" and not bandpass.upper().endswith(band_filter):
            continue

        em_min_um = _to_microns(row.get("em_min"))
        em_max_um = _to_microns(row.get("em_max"))

        observations.append(
            {
                "obs_id": row.get("obs_id", ""),
                "bandpass": bandpass,
                "em_min_um": em_min_um,
                "em_max_um": em_max_um,
                "s_ra": _to_float(row.get("s_ra")),
                "s_dec": _to_float(row.get("s_dec")),
                "t_exptime": _to_float(row.get("t_exptime")),
                "obs_release_date": row.get("obs_release_date", ""),
                "obs_collection": row.get("obs_collection", collection),
                "s_pixel_scale": _to_float(row.get("s_pixel_scale")),
                "access_url": access_url,
            }
        )

    observations.sort(key=lambda item: (item["bandpass"], item["obs_id"]))
    total_found = len(observations)

    return {
        "query": {"ra": ra, "dec": dec, "radius": radius, "collection": collection, "band": band},
        "sia_url": sia_url,
        "total_found": total_found,
        "observations": observations[:limit],
    }


@app.get("/api/cutout")
def get_cutout(
    access_url: str = Query(..., description="URL base del archivo FITS en IRSA IBE"),
    ra: float = Query(..., ge=0.0, le=360.0),
    dec: float = Query(..., ge=-90.0, le=90.0),
    size: float = Query(0.15, ge=0.02, le=1.0, description="Tamaño del recorte en grados"),
    stretch: Literal["asinh", "log", "sqrt", "linear"] = Query("asinh"),
    colormap: Literal["inferno", "viridis", "plasma", "magma", "gray"] = Query("inferno"),
    subtract_zodi: bool = Query(False, description="Restar extensión ZODI si está disponible"),
) -> dict:
    """Descarga el recorte FITS desde IRSA IBE y lo renderiza a PNG con estadísticas científicas."""
    if not access_url.startswith(ALLOWED_IRSA_PREFIX):
        raise HTTPException(status_code=400, detail="access_url debe pertenecer a irsa.ipac.caltech.edu")

    cutout_url = f"{access_url}?center={ra},{dec}d&size={size}"
    cache_key = (access_url, round(ra, 6), round(dec, 6), round(size, 4))

    fits_bytes = _FITS_CACHE.get(cache_key)
    if fits_bytes is None:
        try:
            resp = requests.get(cutout_url, timeout=35)
            resp.raise_for_status()
            fits_bytes = resp.content
        except requests.RequestException as exc:
            raise HTTPException(status_code=502, detail=f"Error descargando recorte FITS de IRSA: {exc}") from exc

        _FITS_CACHE[cache_key] = fits_bytes
        if len(_FITS_CACHE) > _MAX_CACHE_ITEMS:
            _FITS_CACHE.popitem(last=False)
    else:
        _FITS_CACHE.move_to_end(cache_key)

    try:
        with fits.open(io.BytesIO(fits_bytes)) as hdul:
            if "IMAGE" not in hdul:
                raise HTTPException(status_code=422, detail="El FITS recibido no contiene extensión IMAGE.")
            img_hdu = hdul["IMAGE"]
            data = np.array(img_hdu.data, dtype=np.float64)
            bunit = str(img_hdu.header.get("BUNIT", "MJy/sr"))
            detector = str(img_hdu.header.get("DETECTOR", ""))

            has_zodi = "ZODI" in hdul and hdul["ZODI"].data is not None
            if subtract_zodi and has_zodi:
                zodi = np.array(hdul["ZODI"].data, dtype=np.float64)
                if zodi.shape == data.shape:
                    data = data - zodi
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"No se pudo decodificar el archivo FITS: {exc}") from exc

    if data.ndim != 2 or data.size == 0:
        raise HTTPException(status_code=422, detail="La imagen FITS está vacía o tiene dimensiones inválidas.")

    finite_mask = np.isfinite(data)
    if not np.any(finite_mask):
        raise HTTPException(status_code=422, detail="Todos los píxeles del recorte son NaN/Inf.")

    finite_vals = data[finite_mask]
    stats = {
        "min": round(float(np.min(finite_vals)), 4),
        "max": round(float(np.max(finite_vals)), 4),
        "median": round(float(np.median(finite_vals)), 4),
        "mean": round(float(np.mean(finite_vals)), 4),
        "unit": bunit,
        "detector": detector,
        "shape": [int(data.shape[1]), int(data.shape[0])],  # [width, height]
        "has_zodi": has_zodi,
    }

    png_bytes = _render_fits_to_png(data, finite_mask, stretch=stretch, colormap=colormap)
    b64 = base64.b64encode(png_bytes).decode("ascii")

    return {
        "image_base64": b64,
        "width": int(data.shape[1]),
        "height": int(data.shape[0]),
        "stats": stats,
        "fits_cutout_url": cutout_url,
    }


def _render_fits_to_png(
    data: np.ndarray,
    finite_mask: np.ndarray,
    stretch: str,
    colormap: str,
) -> bytes:
    filled = np.where(finite_mask, data, np.nanmedian(data[finite_mask]))
    interval = PercentileInterval(99.5)
    vmin, vmax = interval.get_limits(filled)
    if not np.isfinite(vmin) or not np.isfinite(vmax) or vmax <= vmin:
        norm = np.zeros_like(filled, dtype=np.float64)
    else:
        norm = np.clip((filled - vmin) / (vmax - vmin), 0.0, 1.0)

    stretch_map = {
        "asinh": AsinhStretch(a=0.1),
        "log": LogStretch(a=100.0),
        "sqrt": SqrtStretch(),
        "linear": LinearStretch(),
    }
    stretched = stretch_map[stretch](norm)
    indices = np.clip((stretched * 255.0).astype(np.uint8), 0, 255)

    lut = _LUTS.get(colormap, _LUTS["inferno"])
    rgb = lut[indices]
    # Mark masked/NaN pixels in dark slate so missing edges are visually clear
    rgb[~finite_mask] = (15, 23, 42)

    # Flip vertically so North-up / FITS origin matches standard display convention
    rgb = np.flipud(rgb)
    img = Image.fromarray(rgb, mode="RGB")

    # Upscale small cutouts cleanly with nearest-neighbor for sharp astronomical pixels
    max_dim = max(img.width, img.height)
    if max_dim < 512:
        scale = max(1, 512 // max_dim)
        img = img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _to_float(val: str | None) -> float | None:
    if not val:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def _to_microns(val: str | None) -> float | None:
    meters = _to_float(val)
    return round(meters * 1e6, 3) if meters is not None else None


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
