import type { NormalizedFailure } from "../contracts";
import { createFailureFingerprint } from "./fingerprint";

export interface FailureGroup {
  fingerprint: string;
  failures: NormalizedFailure[];
}

/** Group by stable fingerprint and sort both groups and members for repeatable output. */
export function groupFailures(failures: NormalizedFailure[]): FailureGroup[] {
  const groups = new Map<string, NormalizedFailure[]>();
  for (const failure of failures) {
    const fingerprint = failure.fingerprint || createFailureFingerprint(failure);
    const current = groups.get(fingerprint) ?? [];
    current.push({ ...failure, fingerprint });
    groups.set(fingerprint, current);
  }
  return [...groups.entries()]
    .map(([fingerprint, grouped]) => ({
      fingerprint,
      failures: grouped.sort((a, b) => (a.attempt ?? 0) - (b.attempt ?? 0) || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

export const groupByFingerprint = groupFailures;
