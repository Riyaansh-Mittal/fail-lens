import type { Evidence, NormalizedFailure, SourceLocation } from "../contracts";
import { asNumber, finishFailure, inferKind, makeEvidence, DEFAULT_MAX_EVIDENCE_CHARS } from "./common";
import type { IngestResult } from "./types";

const attr = (attrs: string, name: string): string | undefined => {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i").exec(attrs);
  return match?.[2];
};
const decode = (value: string | undefined): string => (value || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const bodyText = (body: string, tag: string): string => {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(body);
  return decode((match?.[1] || "").replace(/<[^>]+>/g, "").trim());
};
const listCases = (xml: string): Array<{ attrs: string; body: string }> => {
  const cases: Array<{ attrs: string; body: string }> = [];
  const pattern = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase\s*>)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) cases.push({ attrs: match[1], body: match[2] || "" });
  return cases;
};

function suiteFor(xml: string, offset: number, classname?: string): string | undefined {
  // Prefer the nearest enclosing suite, while supporting JUnit's classname-only output.
  const prefix = xml.slice(0, offset);
  const starts = [...prefix.matchAll(/<testsuite\b([^>]*)>/gi)];
  const ends = [...prefix.matchAll(/<\/testsuite\s*>/gi)].length;
  if (starts.length > ends) return attr(starts[starts.length - 1][1], "name") || classname;
  return classname;
}

export function parseJUnitXml(input: string, options: { source?: string; maxEvidenceChars?: number } = {}): IngestResult {
  const xml = String(input).replace(/^\uFEFF/, "");
  const evidence: Evidence[] = []; const failures: NormalizedFailure[] = []; const max = options.maxEvidenceChars ?? DEFAULT_MAX_EVIDENCE_CHARS;
  const cases = listCases(xml);
  for (const item of cases) {
    const { attrs, body } = item;
    const name = decode(attr(attrs, "name") || "Unnamed test");
    const classname = decode(attr(attrs, "classname") || attr(attrs, "class"));
    const file = decode(attr(attrs, "file") || "") || undefined;
    const suiteName = suiteFor(xml, xml.indexOf(`<testcase${attrs}`), classname);
    const location: SourceLocation = { file, testName: name, suiteName };
    const skipped = /<skipped(?:\s[^>]*)?\s*\/?>(?:[\s\S]*?<\/skipped>)?/i.test(body);
    const failureTag = /<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1\s*>/i.exec(body) || /<(failure|error)\b([^>]*)\s*\/>/i.exec(body);
    const failureKind = failureTag?.[1]?.toLowerCase();
    const detail = failureTag ? decode((failureTag[3] || "").trim()) : "";
    const tagMessage = failureTag ? decode(attr(failureTag[2], "message") || attr(failureTag[2], "type") || "") : "";
    const message = tagMessage || detail || (failureKind ? `${failureKind} in ${name}` : skipped ? bodyText(body, "skipped") : "");
    const stack = detail && detail !== message ? detail : "";
    const status: NormalizedFailure["status"] = skipped ? "skipped" : failureKind === "error" ? "errored" : failureKind === "failure" ? "failed" : "passed";
    const evidenceIds: string[] = [];
    const messageId = makeEvidence(evidence, "error-message", `${name} message`, message, options.source, max); if (messageId) evidenceIds.push(messageId);
    const stackId = makeEvidence(evidence, "stack-trace", `${name} stack`, stack, options.source, max); if (stackId && stackId !== messageId) evidenceIds.push(stackId);
    const stdout = bodyText(body, "system-out"); const stderr = bodyText(body, "system-err");
    const stdoutId = makeEvidence(evidence, "stdout", `${name} stdout`, stdout, options.source, max); if (stdoutId) evidenceIds.push(stdoutId);
    const stderrId = makeEvidence(evidence, "stderr", `${name} stderr`, stderr, options.source, max); if (stderrId) evidenceIds.push(stderrId);
    const seconds = asNumber(attr(attrs, "time"));
    failures.push(finishFailure({ framework: "junit", index: failures.length, testName: name, suiteName, status, kind: inferKind(message, status, stack), message, stack: stack || undefined, location, durationMs: seconds == null ? undefined : seconds * 1000, attempt: 0, metadata: { classname: classname || "" }, evidenceIds }));
  }
  const warnings: string[] = [];
  if (!cases.length) warnings.push("No JUnit testcase elements were found");
  if (!/<\/?testsuite\b/i.test(xml)) warnings.push("Input does not contain a testsuite element");
  return { framework: "junit", failures, evidence, warnings };
}

export const parseJUnit = parseJUnitXml;
