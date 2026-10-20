import type { Evidence } from "./evidence";
import type { FailureKind, NormalizedFailure } from "./failure";

export type DiagnosticConfidence = "high" | "medium" | "low";

export interface ReproductionCommand {
  label: string;
  command: string;
  shell?: "sh" | "bash" | "powershell" | "cmd";
  reason?: string;
}

export interface Diagnostic {
  id: string;
  title: string;
  summary: string;
  category: FailureKind | "flaky" | "duplicate" | "unknown";
  confidence: DiagnosticConfidence;
  ruleId: string;
  failureIds: string[];
  evidenceIds: string[];
  suggestedActions: string[];
  reproduction?: ReproductionCommand[];
}

export interface RetryComparison {
  failureId: string;
  attempts: Array<{
    attempt: number;
    status: NormalizedFailure["status"];
    message?: string;
  }>;
  classification: "stable-failure" | "flaky" | "inconclusive";
}

export interface DiagnosticContext {
  failures: NormalizedFailure[];
  evidence: Evidence[];
}
