import { describe, expect, it } from "vitest";
import type { Evidence, NormalizedFailure } from "../../src/contracts";
import { buildDiagnostics, categorizeFailure, compareRetries, createFailureFingerprint, groupFailures } from "../../src/diagnose";

const failure = (overrides: Partial<NormalizedFailure> = {}): NormalizedFailure => ({
  id: "f1",
  framework: "vitest",
  testName: "cart adds an item",
  status: "failed",
  kind: "unknown",
  message: "Expected 2 to equal 3 (OmniRush ref: becd0136)",
  metadata: {},
  evidenceIds: ["e1"],
  fingerprint: "",
  ...overrides,
});

describe("diagnostics", () => {
  it("fingerprints equivalent volatile messages identically", () => {
    expect(createFailureFingerprint("Expected 2 to equal 3 at 2025-01-01T10:00:00Z")).toBe(
      createFailureFingerprint("Expected 9 to equal 8 at 2026-02-02T11:00:00Z"),
    );
  });

  it("groups deterministically and categorizes unknown failures", () => {
    const first = failure({ id: "b", message: "request timed out after 100ms" });
    const second = failure({ id: "a", message: "request timed out after 300ms" });
    expect(categorizeFailure(first)).toBe("timeout");
    expect(groupFailures([first, second]).map((group) => group.failures.map((item) => item.id))).toEqual([["a", "b"]]);
  });

  it("does not overclaim flakiness from only one retry", () => {
    expect(compareRetries([
      failure({ id: "f1", attempt: 1 }),
      failure({ id: "f2", attempt: 2, status: "passed", message: "ok", fingerprint: "fp-ok" }),
    ])).toMatchObject([{ classification: "inconclusive", attempts: [{ attempt: 1 }, { attempt: 2 }] }]);
  });

  it("marks repeated mixed outcomes flaky", () => {
    expect(compareRetries([
      failure({ id: "f1", attempt: 1 }),
      failure({ id: "f2", attempt: 2, status: "passed", message: "ok", fingerprint: "fp-ok" }),
      failure({ id: "f3", attempt: 3 }),
    ])).toMatchObject([{ classification: "flaky" }]);
  });

  it("links recommendations only to supplied evidence", () => {
    const evidence: Evidence = { id: "e1", kind: "error-message", label: "stderr", content: "timed out", redacted: false, truncated: false };
    const report = buildDiagnostics({ failures: [failure({ message: "request timed out" })], evidence: [evidence] });
    expect(report).toHaveLength(1);
    expect(report[0].evidenceIds).toEqual(["e1"]);
    expect(report[0].category).toBe("timeout");
  });
});
