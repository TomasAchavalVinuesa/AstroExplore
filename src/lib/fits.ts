import zlib from "node:zlib";
import type { ColormapName, CutoutStats, StretchMode } from "./types";

interface FitsHdu {
  name: string;
  header: Record<string, string>;
  bitpix: number;
  naxis: number;
  naxis1: number;
  naxis2: number;
  bscale: number;
  bzero: number;
  dataOffset: number;
  dataBytes: number;
}

const FITS_BLOCK = 2880;

function parseHeaderCard(card: string): { key: string; value: string } | null {
  const key = card.slice(0, 8).trim();
  if (!key || key === "COMMENT" || key === "HISTORY" || key === "END") return null;
  if (card[8] !== "=") return null;

  let raw = card.slice(10).trim();
  if (raw.startsWith("'")) {
    const endQuote = raw.indexOf("'", 1);
    if (endQuote !== -1) {
      return { key, value: raw.slice(1, endQuote).trim() };
    }
  }
  const slashIdx = raw.indexOf("/");
  if (slashIdx !== -1) {
    raw = raw.slice(0, slashIdx).trim();
  }
  return { key, value: raw };
}

function parseFitsHdus(buf: Buffer): FitsHdu[] {
  const hdus: FitsHdu[] = [];
  let offset = 0;

  while (offset + FITS_BLOCK <= buf.length) {
    const header: Record<string, string> = {};
    let foundEnd = false;
    let headerOffset = offset;

    while (headerOffset + FITS_BLOCK <= buf.length) {
      const block = buf.subarray(headerOffset, headerOffset + FITS_BLOCK).toString("ascii");
      for (let i = 0; i < 36; i++) {
        const card = block.slice(i * 80, (i + 1) * 80);
        if (card.slice(0, 8).trim() === "END") {
          foundEnd = true;
          break;
        }
        const parsed = parseHeaderCard(card);
        if (parsed) {
          header[parsed.key] = parsed.value;
        }
      }
      headerOffset += FITS_BLOCK;
      if (foundEnd) break;
    }

    if (!foundEnd) break;

    const bitpix = Number(header["BITPIX"] ?? 8);
    const naxis = Number(header["NAXIS"] ?? 0);
    const gcount = Number(header["GCOUNT"] ?? 1);
    const pcount = Number(header["PCOUNT"] ?? 0);

    let axisProduct = naxis > 0 ? 1 : 0;
    for (let a = 1; a <= naxis; a++) {
      axisProduct *= Number(header[`NAXIS${a}`] ?? 0);
    }

    const rawDataBytes = Math.floor((Math.abs(bitpix) / 8) * gcount * (pcount + axisProduct));
    const paddedDataBytes =
      rawDataBytes === 0 ? 0 : Math.ceil(rawDataBytes / FITS_BLOCK) * FITS_BLOCK;

    hdus.push({
      name: (header["EXTNAME"] ?? (hdus.length === 0 ? "PRIMARY" : "")).toUpperCase(),
      header,
      bitpix,
      naxis,
      naxis1: Number(header["NAXIS1"] ?? 0),
      naxis2: Number(header["NAXIS2"] ?? 0),
      bscale: Number(header["BSCALE"] ?? 1),
      bzero: Number(header["BZERO"] ?? 0),
      dataOffset: headerOffset,
      dataBytes: rawDataBytes,
    });

    offset = headerOffset + paddedDataBytes;
  }

  return hdus;
}

function readImagePixels(buf: Buffer, hdu: FitsHdu): Float64Array {
  const count = hdu.naxis1 * hdu.naxis2;
  const out = new Float64Array(count);
  const bscale = hdu.bscale;
  const bzero = hdu.bzero;
  const start = hdu.dataOffset;

  for (let i = 0; i < count; i++) {
    let val: number;
    switch (hdu.bitpix) {
      case -32:
        val = buf.readFloatBE(start + i * 4);
        break;
      case -64:
        val = buf.readDoubleBE(start + i * 8);
        break;
      case 32:
        val = buf.readInt32BE(start + i * 4);
        break;
      case 16:
        val = buf.readInt16BE(start + i * 2);
        break;
      case 8:
        val = buf.readUInt8(start + i);
        break;
      default:
        val = Number.NaN;
    }
    out[i] = Number.isFinite(val) ? val * bscale + bzero : Number.NaN;
  }
  return out;
}

type RGB = [number, number, number];

const CMAP_STOPS: Record<ColormapName, RGB[]> = {
  inferno: [
    [0, 0, 4],
    [87, 16, 110],
    [188, 55, 84],
    [249, 142, 9],
    [252, 255, 164],
  ],
  viridis: [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 98],
    [253, 231, 37],
  ],
  plasma: [
    [13, 8, 135],
    [126, 3, 168],
    [204, 71, 120],
    [248, 149, 64],
    [240, 249, 33],
  ],
  magma: [
    [0, 0, 4],
    [81, 18, 124],
    [183, 55, 121],
    [252, 137, 97],
    [252, 253, 191],
  ],
  gray: [
    [0, 0, 0],
    [64, 64, 64],
    [128, 128, 128],
    [192, 192, 192],
    [255, 255, 255],
  ],
};

function buildLut(name: ColormapName): Uint8Array {
  const stops = CMAP_STOPS[name] ?? CMAP_STOPS.inferno;
  const lut = new Uint8Array(256 * 3);
  const segments = stops.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * segments;
    const idx = Math.min(segments - 1, Math.floor(t));
    const frac = t - idx;
    const c0 = stops[idx];
    const c1 = stops[idx + 1];
    lut[i * 3] = Math.round(c0[0] + (c1[0] - c0[0]) * frac);
    lut[i * 3 + 1] = Math.round(c0[1] + (c1[1] - c0[1]) * frac);
    lut[i * 3 + 2] = Math.round(c0[2] + (c1[2] - c0[2]) * frac);
  }
  return lut;
}

const LUTS: Record<ColormapName, Uint8Array> = {
  inferno: buildLut("inferno"),
  viridis: buildLut("viridis"),
  plasma: buildLut("plasma"),
  magma: buildLut("magma"),
  gray: buildLut("gray"),
};

function applyStretch(norm: number, mode: StretchMode): number {
  switch (mode) {
    case "asinh": {
      const a = 0.1;
      return Math.asinh(norm / a) / Math.asinh(1 / a);
    }
    case "log": {
      const a = 100.0;
      return Math.log(1 + a * norm) / Math.log(1 + a);
    }
    case "sqrt":
      return Math.sqrt(norm);
    case "linear":
    default:
      return norm;
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePngRgb(width: number, height: number, rgb: Uint8Array): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type None
    raw.set(rgb.subarray(y * stride, (y + 1) * stride), rowStart + 1);
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function renderFitsCutout(
  fitsBuffer: Buffer,
  options: {
    stretch: StretchMode;
    colormap: ColormapName;
    subtractZodi: boolean;
  }
): { pngBase64: string; width: number; height: number; stats: CutoutStats } {
  const hdus = parseFitsHdus(fitsBuffer);
  const imageHdu = hdus.find((h) => h.name === "IMAGE" && h.naxis === 2);
  if (!imageHdu) {
    throw new Error("El archivo FITS no contiene extensión IMAGE 2D.");
  }

  const width = imageHdu.naxis1;
  const height = imageHdu.naxis2;
  if (width <= 0 || height <= 0) {
    throw new Error("Dimensiones de imagen FITS inválidas.");
  }

  const data = readImagePixels(fitsBuffer, imageHdu);
  const zodiHdu = hdus.find((h) => h.name === "ZODI" && h.naxis === 2);
  const hasZodi = Boolean(zodiHdu && zodiHdu.naxis1 === width && zodiHdu.naxis2 === height);

  if (options.subtractZodi && hasZodi && zodiHdu) {
    const zodi = readImagePixels(fitsBuffer, zodiHdu);
    for (let i = 0; i < data.length; i++) {
      data[i] = data[i] - zodi[i];
    }
  }

  const finiteVals: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (Number.isFinite(data[i])) finiteVals.push(data[i]);
  }
  if (finiteVals.length === 0) {
    throw new Error("Todos los píxeles del recorte son NaN/Inf.");
  }

  finiteVals.sort((a, b) => a - b);
  const n = finiteVals.length;
  const min = finiteVals[0];
  const max = finiteVals[n - 1];
  const median = n % 2 === 1 ? finiteVals[(n - 1) / 2] : (finiteVals[n / 2 - 1] + finiteVals[n / 2]) / 2;
  const sum = finiteVals.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  // PercentileInterval(99.5): [0.25%, 99.75%]
  const vmin = finiteVals[Math.max(0, Math.floor(0.0025 * (n - 1)))];
  const vmax = finiteVals[Math.min(n - 1, Math.floor(0.9975 * (n - 1)))];
  const span = vmax > vmin ? vmax - vmin : 1;

  const lut = LUTS[options.colormap] ?? LUTS.inferno;
  const maxDim = Math.max(width, height);
  const scale = maxDim < 512 ? Math.max(1, Math.floor(512 / maxDim)) : 1;
  const outW = width * scale;
  const outH = height * scale;
  const rgb = new Uint8Array(outW * outH * 3);

  for (let y = 0; y < height; y++) {
    // Flip vertically so FITS origin matches astronomical North-up display
    const srcRow = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const val = data[srcRow * width + x];
      let r = 15;
      let g = 23;
      let b = 42;

      if (Number.isFinite(val)) {
        const norm = vmax > vmin ? Math.min(1, Math.max(0, (val - vmin) / span)) : 0;
        const stretched = applyStretch(norm, options.stretch);
        const idx = Math.min(255, Math.max(0, Math.round(stretched * 255)));
        r = lut[idx * 3];
        g = lut[idx * 3 + 1];
        b = lut[idx * 3 + 2];
      }

      for (let sy = 0; sy < scale; sy++) {
        const py = y * scale + sy;
        for (let sx = 0; sx < scale; sx++) {
          const px = x * scale + sx;
          const outIdx = (py * outW + px) * 3;
          rgb[outIdx] = r;
          rgb[outIdx + 1] = g;
          rgb[outIdx + 2] = b;
        }
      }
    }
  }

  const png = encodePngRgb(outW, outH, rgb);
  return {
    pngBase64: png.toString("base64"),
    width,
    height,
    stats: {
      min: Number(min.toFixed(4)),
      max: Number(max.toFixed(4)),
      median: Number(median.toFixed(4)),
      mean: Number(mean.toFixed(4)),
      unit: imageHdu.header["BUNIT"] ?? "MJy/sr",
      detector: imageHdu.header["DETECTOR"] ?? "",
      shape: [width, height],
      has_zodi: hasZodi,
    },
  };
}
