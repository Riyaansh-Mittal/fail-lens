import type { Evidence, FailureKind, NormalizedFailure, SourceLocation, TestFramework } from "../contracts";

export const DEFAULT_MAX_EVIDENCE_CHARS = 16_384;

function stableHash(value: string): string {
  // FNV-1a is small, deterministic, and does not require a runtime crypto API.
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Redact credentials and tokens before untrusted reporter text becomes evidence. */
export function redact(value: unknown): string {
  let text = value == null ? "" : String(value);
  text = text.replace(/(authorization\s*:\s*(?:bearer\s+)?|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[=:]\s*)([^\s,;]+)/gi, "$1[REDACTED]");
  text = text.replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED]");
  text = text.replace(/\bgh[pousr]_[A-Za-z0-9]{12,}\b/gi, "[REDACTED]");
  text = text.replace(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g, "[REDACTED]");
  return text;
}

export function bounded(value: unknown, maxChars = DEFAULT_MAX_EVIDENCE_CHARS): { content: string; truncated: boolean } {
  const text = redact(value);
  if (text.length <= maxChars) return { content: text, truncated: false };
  const suffix = "\n...[truncated]";
  return { content: `${text.slice(0, Math.max(0, maxChars - suffix.length))}${suffix}`, truncated: true };
}

export function makeEvidence(
  evidence: Evidence[], kind: Evidence["kind"], label: string, value: unknown,
  source: string | undefined, maxChars: number,
): string | undefined {
  if (value == null || String(value).trim() === "") return undefined;
  const result = bounded(value, maxChars);
  const id = `e-${stableHash(`${kind}|${label}|${result.content}`)}`;
  if (!evidence.some((item) => item.id === id)) {
    evidence.push({ id, kind, label, content: result.content, source, redacted: result.content !== String(value), truncated: result.truncated });
  }
  return id;
}

export function failureFingerprint(framework: TestFramework, testName: string, message: string, location?: SourceLocation): string {
  return stableHash([framework, location?.file ?? "", location?.suiteName ?? "", testName, message.trim()].join("\n"));
}

export function failureId(framework: TestFramework, index: number, fingerprint: string): string {
  return `${framework}-${index + 1}-${fingerprint}`;
}

export function inferKind(message: string, status: NormalizedFailure["status"], stack = ""): FailureKind {
  const text = `${message}\n${stack}`.toLowerCase();
  if (status === "timed-out" || /timeout|timed out|exceeded .*ms/.test(text)) return "timeout";
  if (/network|econn|enotfound|fetch failed|socket|http [45]\d\d|connection/.test(text)) return "network";
  if (/syntaxerror|parse error|unexpected token|cannot use import/.test(text)) return "syntax";
  if (/module not found|cannot find module|build failed|compilation/.test(text)) return "build";
  if (/permission denied|not found|browser.*launch|executable|environment/.test(text)) return "environment";
  if (/expect|assert|assertion|expected\s*[:=]|received\s*[:=]|to(be|equal|have|contain|match)/.test(text)) return "assertion";
  return "unknown";
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function parseJson(input: string | object): unknown {
  if (typeof input !== "string") return input;
  return JSON.parse(input.replace(/^\uFEFF/, ""));
}

export function finishFailure(
  args: Omit<NormalizedFailure, "id" | "fingerprint"> & { framework: TestFramework; index: number },
): NormalizedFailure {
  const fingerprint = failureFingerprint(args.framework, args.testName, args.message, args.location);
  const { index, framework, ...rest } = args;
  return { ...rest, framework, id: failureId(framework, index, fingerprint), fingerprint };
}
