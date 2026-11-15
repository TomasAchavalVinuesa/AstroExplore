export type NasaApiTarget = "map1" | "map2";

export class NasaApiDownError extends Error {
  readonly target: NasaApiTarget;
  readonly httpStatus?: number;

  constructor(target: NasaApiTarget, message: string, httpStatus?: number) {
    super(message);
    this.name = "NasaApiDownError";
    this.target = target;
    this.httpStatus = httpStatus;
  }
}

export function isTimeoutOrAbortError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === "TimeoutError" || err.name === "AbortError";
  }
  if (err instanceof Error) {
    return err.name === "TimeoutError" || err.name === "AbortError";
  }
  return false;
}

export function isApiDownHttpStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

export function isNetworkDownError(err: unknown): boolean {
  if (isTimeoutOrAbortError(err)) return false;
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network error") ||
      msg.includes("load failed") ||
      msg.includes("err_connection") ||
      msg.includes("err_name_not_resolved")
    );
  }
  return false;
}
