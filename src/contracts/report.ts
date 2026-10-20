import type { Diagnostic, RetryComparison } from "./diagnostic";
import type { Evidence } from "./evidence";
import type { NormalizedFailure } from "./failure";

export interface FailureReport {
  schemaVersion: "1";
  generatedAt: string;
  inputFiles: string[];
  failures: NormalizedFailure[];
  evidence: Evidence[];
  diagnostics: Diagnostic[];
  retryComparisons: RetryComparison[];
  summary: {
    total: number;
    failed: number;
    flaky: number;
    diagnosticCount: number;
  };
}
