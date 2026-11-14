import { computeFitsPixels, type FitsPixelResult } from "./fits";
import type { ColormapName, StretchMode } from "./types";

export interface FitsWorkerRequest {
  id: number;
  buffer: ArrayBuffer;
  options: {
    stretch: StretchMode;
    colormap: ColormapName;
    subtractZodi: boolean;
    fitsCutoutUrl: string;
  };
}

export type FitsWorkerResponse =
  | {
      id: number;
      ok: true;
      result: FitsPixelResult;
    }
  | {
      id: number;
      ok: false;
      error: string;
    };

self.onmessage = (event: MessageEvent<FitsWorkerRequest>) => {
  const { id, buffer, options } = event.data;
  try {
    const result = computeFitsPixels(buffer, options);
    const response: FitsWorkerResponse = { id, ok: true, result };
    // Transferir el ArrayBuffer de salida sin copiar memoria
    (self as unknown as Worker).postMessage(response, [result.rgba.buffer]);
  } catch (err) {
    const response: FitsWorkerResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(response);
  }
};
