export type TestFramework = "playwright" | "vitest" | "junit" | "text";

export type FailureKind =
  | "assertion"
  | "timeout"
  | "network"
  | "build"
  | "syntax"
  | "environment"
  | "unknown";

export type FailureStatus =
  | "failed"
  | "skipped"
  | "timed-out"
  | "errored"
  | "passed";

export interface SourceLocation {
  file?: string;
  line?: number;
  column?: number;
  testName?: string;
  suiteName?: string;
}

export interface NormalizedFailure {
  id: string;
  framework: TestFramework;
  testName: string;
  suiteName?: string;
  status: FailureStatus;
  kind: FailureKind;
  message: string;
  stack?: string;
  location?: SourceLocation;
  durationMs?: number;
  attempt?: number;
  metadata: Record<string, string | number | boolean>;
  evidenceIds: string[];
  fingerprint: string;
}
