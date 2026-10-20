export type EvidenceKind =
  | "error-message"
  | "stack-trace"
  | "stdout"
  | "stderr"
  | "attachment"
  | "source-location"
  | "retry-result"
  | "metadata";

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  label: string;
  content: string;
  source?: string;
  redacted: boolean;
  truncated: boolean;
}
