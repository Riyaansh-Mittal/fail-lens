import type { Evidence, NormalizedFailure, TestFramework } from "../contracts";

export interface IngestResult {
  framework: TestFramework;
  failures: NormalizedFailure[];
  evidence: Evidence[];
  warnings: string[];
}

export type IngestInput = string | object;

export interface IngestOptions {
  /** Name of the input file, used for format detection and metadata. */
  fileName?: string;
  /** Maximum characters retained in any evidence item. Defaults to 16 KiB. */
  maxEvidenceChars?: number;
}
