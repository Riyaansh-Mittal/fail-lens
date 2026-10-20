import type { Diagnostic, DiagnosticContext, Evidence, FailureKind, NormalizedFailure } from "../contracts";
import { categorizeFailure } from "./categorize";
import { groupFailures } from "./group";
import { compareRetries } from "./retry";
import { createFailureFingerprint } from "./fingerprint";
import { shellQuote } from "../reproduce";

const actions: Record<FailureKind, string[]> = {
  assertion: ["Compare expected and received values at the reported source location.", "Check whether the test fixture or assertion contract changed."],
  timeout: ["Inspect the slowest operation and increase the timeout only after identifying the bottleneck.", "Check for blocked I/O, deadlocks, or resource contention."],
  network: ["Verify the target service is reachable and inspect request/response logs.", "Retry against a controlled service or deterministic network fixture."],
  build: ["Run the build with the reported toolchain and inspect the first compiler error.", "Check dependency resolution and generated artifacts."],
  syntax: ["Inspect the reported file near the syntax error and validate the parser/toolchain version."],
  environment: ["Compare the failing environment with a known-good runner and verify required tools and permissions."],
  unknown: ["Inspect the attached error and stack evidence, then reproduce the failing test with the same inputs."],
};

function diagnosticId(fingerprint: string, category: string): string {
  return `diag_${fingerprint.replace(/^fp_/, "")}_${category}`;
}

function evidenceFor(group: NormalizedFailure[], all: Evidence[]): Evidence[] {
  const ids = new Set(group.flatMap((failure) => failure.evidenceIds));
  return all.filter((item) => ids.has(item.id)).sort((a, b) => a.id.localeCompare(b.id));
}

function confidence(group: NormalizedFailure[], evidence: Evidence[]): Diagnostic["confidence"] {
  if (evidence.length > 0 && group.some((failure) => failure.location?.file || failure.stack)) return "high";
  if (evidence.length > 0 || group.some((failure) => failure.message)) return "medium";
  return "low";
}

/** Produce deterministic, evidence-linked diagnostics without external services or model calls. */
export function buildDiagnostics(context: DiagnosticContext): Diagnostic[] {
  const groups = groupFailures(context.failures.filter((failure) => failure.status !== "passed" && failure.status !== "skipped"));
  const retries = compareRetries(context.failures);
  const flakyTests = new Set(retries.filter((retry) => retry.classification === "flaky").map((retry) => retry.failureId));
  const diagnostics = groups.map((group) => {
    const first = group.failures[0];
    const category = categorizeFailure(first);
    const evidence = evidenceFor(group.failures, context.evidence);
    const isFlaky = group.failures.some((failure) => flakyTests.has(failure.id));
    const finalCategory: Diagnostic["category"] = isFlaky ? "flaky" : group.failures.length > 1 ? "duplicate" : category;
    const suggestedActions = isFlaky
      ? ["Run the test repeatedly with the same environment and capture the differing attempt evidence.", ...actions[category]]
      : actions[category];
    return {
      id: diagnosticId(group.fingerprint, finalCategory),
      title: isFlaky ? `Flaky test: ${first.testName}` : group.failures.length > 1 ? `Repeated ${category} failure` : `${category[0].toUpperCase()}${category.slice(1)} failure`,
      summary: `${group.failures.length} failure${group.failures.length === 1 ? "" : "s"} with fingerprint ${group.fingerprint}.`,
      category: finalCategory,
      confidence: confidence(group.failures, evidence),
      ruleId: isFlaky ? "retry.flaky" : `failure.${category}`,
      failureIds: group.failures.map((failure) => failure.id).sort(),
      evidenceIds: evidence.map((item) => item.id),
      suggestedActions: [...new Set(suggestedActions)],
       reproduction: first.location?.file ? [{ label: "test", command: `${first.framework} ${shellQuote(first.location.file)}`, reason: "Re-run the source location associated with the failure." }] : undefined,
    } satisfies Diagnostic;
  });
  return diagnostics.sort((a, b) => a.id.localeCompare(b.id));
}

export const diagnose = buildDiagnostics;
export { createFailureFingerprint };
