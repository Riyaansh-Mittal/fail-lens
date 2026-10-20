import { createHash } from "node:crypto";
import type { Evidence, FailureKind, FailureReport, NormalizedFailure } from "../contracts";
import { ingest } from "../ingest";
import { buildDiagnostics, compareRetries } from "../diagnose";

export const MAX_INPUT_LENGTH = 100_000;

export interface AnalyzeInput { text: string; source?: string; format?: "text" | "json"; }
export interface AnalyzeOptions { inputFiles?: string[]; generatedAt?: string; }

const id = (prefix: string, value: string) => `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;

function redact(value: string): string {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]")
    .replace(/(token|api[-_]?key|password|secret)\s*[:=]\s*([^\s,;]+)/gi, "$1=[REDACTED]")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{12,}\b/gi, "[REDACTED]")
    .replace(/(https?:\/\/[^\s/@]+):[^\s/@]+@/gi, "$1:[REDACTED]@");
}

function bounded(value: string): { content: string; truncated: boolean } {
  const redacted = redact(value);
  if (redacted.length <= MAX_INPUT_LENGTH) return { content: redacted, truncated: false };
  return { content: `${redacted.slice(0, MAX_INPUT_LENGTH - 17)}\n...[truncated]`, truncated: true };
}

function inferKind(message: string): FailureKind {
  const lower = message.toLowerCase();
  if (/timeout|timed out|deadline/.test(lower)) return "timeout";
  if (/assert|expect|expected|received/.test(lower)) return "assertion";
  if (/network|econn|fetch failed|socket|connection refused/.test(lower)) return "network";
  if (/syntaxerror|parse error|unexpected token/.test(lower)) return "syntax";
  if (/module not found|cannot find module|build failed|compil/.test(lower)) return "build";
  if (/permission denied|enoent|environment|not defined/.test(lower)) return "environment";
  return "unknown";
}

function textFailure(text: string, source?: string) {
  const value = bounded(text);
  if (!value.content.trim()) throw new Error("input is empty");
  const lines = value.content.split("\n");
  const message = lines.find((line) => /error|failed|failure|timeout|assert|expected|received|exception/i.test(line))?.trim() ?? lines[0].trim();
  const testName = lines.find((line) => /(?:✘|×|failed)/i.test(line))?.replace(/^\s*(?:✘|×)\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").trim() || "unnamed failure";
  const failure: NormalizedFailure = {
    id: id("failure", `${source ?? "stdin"}|${testName}|${message}`), framework: "text", testName,
    status: "failed", kind: inferKind(message), message: redact(message), metadata: {}, evidenceIds: [],
    fingerprint: id("fp", `${testName}|${message.toLowerCase().replace(/\d+/g, "#")}`),
  };
  const evidence: Evidence = { id: id("evidence", value.content), kind: "stderr", label: source ?? "terminal output", content: value.content, source, redacted: value.content !== text, truncated: value.truncated };
  failure.evidenceIds.push(evidence.id);
  return { failures: [failure], evidence };
}

function genericStructured(value: Record<string, unknown>, source?: string) {
  const raw = Array.isArray(value.failures) ? value.failures : [];
  const failures: NormalizedFailure[] = [];
  const evidence: Evidence[] = [];
  for (const [index, item] of raw.entries()) {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : { message: String(item) };
    const rawMessage = String(row.message ?? row.error ?? "Test failed");
    const boundedMessage = bounded(rawMessage);
    const message = boundedMessage.content;
    const testName = String(row.testName ?? row.name ?? "unnamed failure");
    const status = row.status === "passed" ? "passed" : row.status === "skipped" ? "skipped" : "failed";
    const rawStack = row.stack == null ? undefined : String(row.stack);
    const stack = rawStack == null ? undefined : redact(rawStack);
    const boundedStack = stack == null ? undefined : bounded(stack);
    const evidenceContent = boundedStack?.content ?? message;
    const ev: Evidence = { id: id("evidence", `${index}|${evidenceContent}`), kind: stack ? "stack-trace" : "error-message", label: `failure ${index + 1}`, content: evidenceContent, source, redacted: evidenceContent !== (rawStack ?? rawMessage), truncated: boundedStack?.truncated ?? boundedMessage.truncated };
    evidence.push(ev);
    failures.push({ id: id("failure", `${source}|${index}|${testName}`), framework: "text", testName, suiteName: row.suite == null ? undefined : String(row.suite), status, kind: inferKind(message), message, stack, durationMs: typeof row.durationMs === "number" ? row.durationMs : undefined, metadata: {}, evidenceIds: [ev.id], fingerprint: id("fp", `${testName}|${message}`) });
  }
  return { failures, evidence };
}

export function buildReport(inputs: AnalyzeInput[], options: AnalyzeOptions = {}): FailureReport {
  const failures: NormalizedFailure[] = [];
  const evidence: Evidence[] = [];
  for (const input of inputs) {
    const isXml = /\.xml$/i.test(input.source ?? "") || /^\s*<\s*(?:testsuites?|testcase)\b/i.test(input.text);
    const isStructured = input.format === "json" || /\.json$/i.test(input.source ?? "") || /^\s*[\[{]/.test(input.text);
    if (isXml) {
      const result = ingest(input.text, { fileName: input.source, maxEvidenceChars: MAX_INPUT_LENGTH });
      if (!result.failures.length) throw new Error(`invalid XML input${input.source ? `: ${input.source}` : ""}: no failures found`);
      failures.push(...result.failures); evidence.push(...result.evidence);
      continue;
    }
    if (isStructured) {
      let parsed: unknown;
      try { parsed = JSON.parse(input.text); } catch { throw new Error(`invalid JSON input${input.source ? `: ${input.source}` : ""}`); }
      if (parsed === null || typeof parsed !== "object") throw new Error("invalid input: expected a JSON object or array");
      const result = ingest(parsed as object, { fileName: input.source, maxEvidenceChars: MAX_INPUT_LENGTH });
      const fallback = result.failures.length ? result : genericStructured(parsed as Record<string, unknown>, input.source);
      if (!fallback.failures.length) throw new Error(`invalid input${input.source ? `: ${input.source}` : ""}: no failures found`);
      failures.push(...fallback.failures); evidence.push(...fallback.evidence);
    } else {
      const result = textFailure(input.text, input.source);
      failures.push(...result.failures); evidence.push(result.evidence);
    }
  }
  const diagnostics = buildDiagnostics({ failures, evidence });
  const retryComparisons = compareRetries(failures);
  return {
    schemaVersion: "1", generatedAt: options.generatedAt ?? new Date().toISOString(),
    inputFiles: options.inputFiles ?? inputs.map((input) => input.source).filter((value): value is string => Boolean(value)),
    failures, evidence, diagnostics, retryComparisons,
    summary: { total: failures.length, failed: failures.filter((f) => ["failed", "errored", "timed-out"].includes(f.status)).length, flaky: retryComparisons.filter((r) => r.classification === "flaky").length, diagnosticCount: diagnostics.length },
  };
}

export const analyze = buildReport;
