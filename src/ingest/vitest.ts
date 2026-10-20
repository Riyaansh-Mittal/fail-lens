import type { Evidence, NormalizedFailure, SourceLocation } from "../contracts";
import { asNumber, finishFailure, inferKind, makeEvidence, parseJson, DEFAULT_MAX_EVIDENCE_CHARS } from "./common";
import type { IngestResult } from "./types";

const list = (value: unknown): any[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === "string" ? value : value == null ? "" : String(value);

function statusOf(value: unknown): NormalizedFailure["status"] {
  const status = text(value).toLowerCase();
  if (["skip", "skipped", "todo", "pending", "disabled"].includes(status)) return "skipped";
  if (["fail", "failed", "error", "errored"].includes(status)) return "failed";
  if (["timedout", "timed-out", "timeout"].includes(status)) return "timed-out";
  return "passed";
}

export function parseVitestJson(input: string | object, options: { source?: string; maxEvidenceChars?: number } = {}): IngestResult {
  const evidence: Evidence[] = []; const failures: NormalizedFailure[] = []; const max = options.maxEvidenceChars ?? DEFAULT_MAX_EVIDENCE_CHARS;
  let data: any;
  try { data = parseJson(input); } catch (error) { return { framework: "vitest", failures, evidence, warnings: [`Invalid Vitest JSON: ${error instanceof Error ? error.message : "parse error"}`] }; }
  const files = list(data?.testResults).length ? list(data.testResults) : list(data?.testResults ?? data?.files);
  for (const file of files) {
    const filePath = text(file?.testFilePath || file?.filepath || file?.file || file?.name) || undefined;
    const assertions = list(file?.assertionResults).length ? list(file.assertionResults) : list(file?.tests || file?.testResults);
    for (const assertion of assertions) {
      const ancestors = list(assertion?.ancestorTitles).map(text).filter(Boolean);
      const testName = text(assertion?.fullName || assertion?.name || assertion?.title || "Unnamed test");
      const suiteName = ancestors.join(" > ") || text(assertion?.suiteName) || undefined;
      const location: SourceLocation = { file: text(assertion?.location?.file || filePath) || undefined, line: asNumber(assertion?.location?.line), column: asNumber(assertion?.location?.column), testName, suiteName };
      const messages = list(assertion?.failureMessages).map(text).filter(Boolean);
      if (!messages.length && assertion?.failureMessage) messages.push(text(assertion.failureMessage));
      const message = messages.join("\n") || (statusOf(assertion?.status) === "failed" ? "Test failed" : "");
      const stack = messages.join("\n"); const evidenceIds: string[] = [];
      const messageId = makeEvidence(evidence, "error-message", `${testName} message`, message, options.source, max); if (messageId) evidenceIds.push(messageId);
      const stackId = makeEvidence(evidence, "stack-trace", `${testName} stack`, stack, options.source, max); if (stackId && stackId !== messageId) evidenceIds.push(stackId);
      for (const output of [assertion?.stdout, assertion?.stderr]) {
        const id = makeEvidence(evidence, output === assertion?.stdout ? "stdout" : "stderr", `${testName} output`, output, options.source, max); if (id) evidenceIds.push(id);
      }
      const status = statusOf(assertion?.status || assertion?.state);
      failures.push(finishFailure({ framework: "vitest", index: failures.length, testName, suiteName, status, kind: inferKind(message, status, stack), message, stack: stack || undefined, location, durationMs: asNumber(assertion?.duration), attempt: asNumber(assertion?.attempt) ?? 0, metadata: { file: filePath || "" }, evidenceIds }));
    }
  }
  return { framework: "vitest", failures, evidence, warnings: failures.length ? [] : ["No Vitest test results were found"] };
}

export const parseVitest = parseVitestJson;
