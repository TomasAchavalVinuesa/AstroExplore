import { renderFitsBuffer, rgbaToRenderedCutout } from "./fits";
import type { FitsWorkerRequest, FitsWorkerResponse } from "./fitsWorker";
import type { ColormapName, RenderedCutout, StretchMode } from "./types";

interface PendingJob {
  resolve: (cutout: RenderedCutout) => void;
  reject: (err: unknown) => void;
}

let workerInstance: Worker | null = null;
let workerFailed = false;
let nextJobId = 1;
const pendingJobs = new Map<number, PendingJob>();

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === "undefined") {
    return null;
  }
  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL("./fitsWorker.ts", import.meta.url), {
        type: "module",
      });
      workerInstance.onmessage = (event: MessageEvent<FitsWorkerResponse>) => {
        const msg = event.data;
        const job = pendingJobs.get(msg.id);
        if (!job) return;
        pendingJobs.delete(msg.id);

        if (msg.ok) {
          try {
            job.resolve(rgbaToRenderedCutout(msg.result));
          } catch (err) {
            job.reject(err);
          }
        } else {
          job.reject(new Error(msg.error));
        }
      };
      workerInstance.onerror = () => {
        workerFailed = true;
        for (const [, job] of pendingJobs) {
          job.reject(new Error("Web Worker FITS falló inesperadamente."));
        }
        pendingJobs.clear();
        workerInstance?.terminate();
        workerInstance = null;
      };
    } catch {
      workerFailed = true;
      return null;
    }
  }
  return workerInstance;
}

/**
 * Decodifica y renderiza un buffer FITS fuera del hilo principal usando un Web Worker,
 * con fallback síncrono automático si Workers no están disponibles.
 */
export function renderFitsBufferAsync(
  rawBuffer: ArrayBuffer,
  options: {
    stretch: StretchMode;
    colormap: ColormapName;
    subtractZodi: boolean;
    fitsCutoutUrl: string;
  },
  signal?: AbortSignal
): Promise<RenderedCutout> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  const worker = getWorker();
  if (!worker) {
    return Promise.resolve(renderFitsBuffer(rawBuffer, options));
  }

  return new Promise<RenderedCutout>((resolve, reject) => {
    const id = nextJobId++;

    const onAbort = () => {
      if (pendingJobs.delete(id)) {
        reject(new DOMException("Aborted", "AbortError"));
      }
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    pendingJobs.set(id, {
      resolve: (cutout) => {
        signal?.removeEventListener("abort", onAbort);
        resolve(cutout);
      },
      reject: (err) => {
        signal?.removeEventListener("abort", onAbort);
        reject(err);
      },
    });

    // Copiar slice para transferir al worker sin invalidar el ArrayBuffer guardado en caché
    const bufferCopy = rawBuffer.slice(0);
    const req: FitsWorkerRequest = { id, buffer: bufferCopy, options };
    worker.postMessage(req, [bufferCopy]);
  });
}
