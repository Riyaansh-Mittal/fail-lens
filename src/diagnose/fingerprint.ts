import type { FailureKind, NormalizedFailure } from "../contracts";

/** Collapse values which commonly change between two executions. */
export function normalizeFailureText(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "<uuid>")
    .replace(/\b0x[0-9a-f]+\b/gi, "<hex>")
    .replace(/([A-Za-z]:)?[\\/]?(?:[^\s\\/]+[\\/])+[^\s:]+/g, (path) => {
      // Keep a source basename while removing machine-specific checkout paths.
      const parts = path.split(/[\\/]/).filter(Boolean);
      return parts.length > 1 ? `<path>/${parts[parts.length - 1]}` : path;
    })
    .replace(/\b\d{4}-\d\d-\d\d(?:[T ][0-9:.+-]+Z?)?\b/g, "<timestamp>")
    .replace(/\b\d+(?:\.\d+)?ms\b/gi, "<duration>")
    .replace(/\b\d+\b/g, "<number>")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function hash(text: string): string {
  // FNV-1a is small, deterministic, and works in every JS runtime (including
  // browser-only consumers); no process, clock, or crypto provider is needed.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function stackSignature(stack: string | undefined): string {
  return normalizeFailureText(stack)
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 4)
    .join("\n");
}

/** Return the stable, content-derived identity used for retry and duplicate grouping. */
export type FingerprintInput = Pick<NormalizedFailure, "framework" | "kind" | "message" | "stack" | "location"> | {
  message: string;
  stack?: string;
  framework?: NormalizedFailure["framework"];
  kind?: FailureKind;
  location?: NormalizedFailure["location"];
} | string;

export function createFailureFingerprint(input: FingerprintInput): string {
  const failure = typeof input === "string" ? { message: input } : input;
  const location = failure.location
    ? [failure.location.file, failure.location.testName, failure.location.suiteName]
        .map(normalizeFailureText)
        .filter(Boolean)
        .join("|")
    : "";
  const canonical = [failure.framework ?? "text", failure.kind ?? "unknown", normalizeFailureText(failure.message), stackSignature(failure.stack), location].join("\u001f");
  return `fp_${hash(canonical)}`;
}

/** Alias useful to ingestion code which calls this operation "fingerprint". */
export const fingerprintFailure = createFailureFingerprint;

export function failureFingerprintParts(failure: Pick<NormalizedFailure, "framework" | "kind" | "message" | "stack" | "location">): string {
  return [failure.framework, failure.kind, normalizeFailureText(failure.message), stackSignature(failure.stack)].join("\u001f");
}

export function kindFromFingerprintInput(failure: Pick<NormalizedFailure, "kind">): FailureKind {
  return failure.kind;
}
