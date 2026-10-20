import type { TestFramework } from "../contracts";
import { parseJson } from "./common";
import { parseJUnitXml } from "./junit";
import { parsePlaywrightJson } from "./playwright";
import { parseVitestJson } from "./vitest";
import type { IngestInput, IngestOptions, IngestResult } from "./types";

export * from "./types";
export * from "./common";
export * from "./playwright";
export * from "./vitest";
export * from "./junit";

export function detectInput(input: IngestInput, fileName?: string): TestFramework {
  const name = (fileName || "").toLowerCase();
  if (/\.xml$/.test(name) || /<\s*(?:testsuites?|testcase)\b/i.test(typeof input === "string" ? input.slice(0, 8192) : "")) return "junit";
  let data: any;
  try { data = parseJson(input); } catch { return "text"; }
  if (data && (Array.isArray(data.suites) || data.config?.projects || data.config?.workers !== undefined)) return "playwright";
  if (data && (Array.isArray(data.testResults) || Array.isArray(data.files) || data.numTotalTests !== undefined || data.numTotalTestSuites !== undefined)) return "vitest";
  return "text";
}

export function ingest(input: IngestInput, options: IngestOptions = {}): IngestResult {
  const framework = detectInput(input, options.fileName);
  if (framework === "junit") return parseJUnitXml(String(input), { source: options.fileName, maxEvidenceChars: options.maxEvidenceChars });
  if (framework === "playwright") return parsePlaywrightJson(input, { source: options.fileName, maxEvidenceChars: options.maxEvidenceChars });
  if (framework === "vitest") return parseVitestJson(input, { source: options.fileName, maxEvidenceChars: options.maxEvidenceChars });
  return { framework: "text", failures: [], evidence: [], warnings: ["Unsupported or undetected test report format"] };
}

export const parseInput = ingest;
export const detectFramework = detectInput;
