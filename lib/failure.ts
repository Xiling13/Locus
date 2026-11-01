/**
 * Why a photo couldn't be read. Each kind gets its own copy and recovery on the
 * failure screen; `code` is the short technical tag shown in small print.
 */
export type FailureKind = "offline" | "slow" | "server" | "setup" | "crash";

export type Failure = { kind: FailureKind; code: string };

export class VisionError extends Error {
  constructor(
    readonly kind: FailureKind,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "VisionError";
  }
}

export function failureOf(err: unknown): Failure {
  if (err instanceof VisionError) return { kind: err.kind, code: err.code };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { kind: "offline", code: "OFFLINE" };
  return { kind: "server", code: "ERROR" };
}
