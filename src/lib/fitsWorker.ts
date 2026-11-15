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
    skipRender?: boolean;
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
    // Transferir los ArrayBuffer de salida sin copiar memoria
    const transferables: Transferable[] = [result.rgba.buffer, result.fluxData.buffer];
    if (result.varianceData) {
      transferables.push(result.varianceData.buffer);
    }
    (self as unknown as Worker).postMessage(response, transferables);
  } catch (err) {
    const response: FitsWorkerResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(response);
  }
};
