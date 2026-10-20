import type { Evidence, NormalizedFailure, SourceLocation } from "../contracts";
import { asNumber, finishFailure, inferKind, makeEvidence, parseJson, DEFAULT_MAX_EVIDENCE_CHARS } from "./common";
import type { IngestResult } from "./types";

const list = (value: unknown): any[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === "string" ? value : value == null ? "" : String(value);

function normalizeStatus(status: unknown, expected?: unknown): NormalizedFailure["status"] {
  const value = text(status).toLowerCase();
  if (value === "timedout" || value === "timed-out" || value === "timeout") return "timed-out";
  if (["skipped", "skip", "pending", "disabled"].includes(value)) return "skipped";
  if (["passed", "pass", "expected"].includes(value) || (!value && expected === "skipped")) return "passed";
  if (["failed", "unexpected", "error", "errored"].includes(value)) return "failed";
  return value ? "errored" : "passed";
}

function collectSuite(suite: any, parentSuite: string, evidence: Evidence[], failures: NormalizedFailure[], source: string | undefined, max: number): void {
  const suiteName = [parentSuite, text(suite?.title || suite?.name)].filter(Boolean).join(" > ");
  const file = text(suite?.file) || undefined;
  for (const spec of list(suite?.specs)) {
    const specName = text(spec?.title || spec?.name);
    const location: SourceLocation = { file: text(spec?.file) || file, line: asNumber(spec?.line), column: asNumber(spec?.column), testName: specName || undefined, suiteName: suiteName || undefined };
    for (const test of list(spec?.tests)) {
      const testName = text(test?.title || test?.name || specName || "Unnamed test");
      const results = list(test?.results);
      const attempts = results.length ? results : [test];
      attempts.forEach((result: any, attemptIndex) => {
        const error = result?.error ?? (Array.isArray(result?.errors) ? result.errors[0] : undefined);
        const message = text(error?.message || result?.message || (normalizeStatus(result?.status, test?.expectedStatus) === "failed" ? "Test failed" : ""));
        const stack = text(error?.stack || result?.stack);
        const evidenceIds: string[] = [];
        const messageId = makeEvidence(evidence, "error-message", `${testName} message`, message, source, max); if (messageId) evidenceIds.push(messageId);
        const stackId = makeEvidence(evidence, "stack-trace", `${testName} stack`, stack, source, max); if (stackId) evidenceIds.push(stackId);
        const stdoutId = makeEvidence(evidence, "stdout", `${testName} stdout`, result?.stdout, source, max); if (stdoutId) evidenceIds.push(stdoutId);
        const stderrId = makeEvidence(evidence, "stderr", `${testName} stderr`, result?.stderr, source, max); if (stderrId) evidenceIds.push(stderrId);
        for (const attachment of list(result?.attachments)) {
          const content = attachment?.body ?? attachment?.path;
          const attachmentId = makeEvidence(evidence, "attachment", `${testName} attachment ${text(attachment?.name || "")}`.trim(), content, source, max); if (attachmentId) evidenceIds.push(attachmentId);
        }
        const status = normalizeStatus(result?.status, test?.expectedStatus);
        failures.push(finishFailure({ framework: "playwright", index: failures.length, testName, suiteName: suiteName || undefined, status, kind: inferKind(message, status, stack), message, stack: stack || undefined, location, durationMs: asNumber(result?.duration), attempt: asNumber(result?.retry) ?? attemptIndex, metadata: { expectedStatus: text(test?.expectedStatus || "expected"), worker: text(result?.workerIndex || "") }, evidenceIds }));
      });
    }
  }
  for (const child of list(suite?.suites)) collectSuite(child, suiteName, evidence, failures, source, max);
}

export function parsePlaywrightJson(input: string | object, options: { source?: string; maxEvidenceChars?: number } = {}): IngestResult {
  const evidence: Evidence[] = []; const failures: NormalizedFailure[] = []; const max = options.maxEvidenceChars ?? DEFAULT_MAX_EVIDENCE_CHARS;
  let data: any;
  try { data = parseJson(input); } catch (error) { return { framework: "playwright", failures, evidence, warnings: [`Invalid Playwright JSON: ${error instanceof Error ? error.message : "parse error"}`] }; }
  for (const suite of list(data?.suites)) collectSuite(suite, "", evidence, failures, options.source, max);
  return { framework: "playwright", failures, evidence, warnings: failures.length ? [] : ["No Playwright suites were found"] };
}

export const parsePlaywright = parsePlaywrightJson;
