import type { NormalizedFailure, RetryComparison } from "../contracts";

function retryKey(failure: NormalizedFailure): string {
  return [failure.framework, failure.suiteName ?? "", failure.testName].join("\u001f");
}

/** Compare attempts for each test. Two attempts are inconclusive; repeated mixed outcomes support flaky classification. */
export function compareRetries(failures: NormalizedFailure[]): RetryComparison[] {
  const byTest = new Map<string, NormalizedFailure[]>();
  for (const failure of failures) {
    const key = retryKey(failure);
    const current = byTest.get(key) ?? [];
    current.push(failure);
    byTest.set(key, current);
  }
  const result: RetryComparison[] = [];
  for (const attempts of byTest.values()) {
    if (attempts.length < 2) continue;
    attempts.sort((a, b) => (a.attempt ?? Number.MAX_SAFE_INTEGER) - (b.attempt ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
    const statuses = new Set(attempts.map((item) => item.status));
    const hasPass = statuses.has("passed");
    const hasFailure = attempts.some((item) => item.status !== "passed" && item.status !== "skipped");
    const classification: RetryComparison["classification"] = attempts.length < 3
      ? "inconclusive"
      : hasPass && hasFailure
        ? "flaky"
      : hasFailure && !hasPass
        ? "stable-failure"
        : "inconclusive";
    result.push({
      failureId: attempts[0].id,
      attempts: attempts.map((item, index) => ({ attempt: item.attempt ?? index + 1, status: item.status, message: item.message || undefined })),
      classification,
    });
  }
  return result.sort((a, b) => a.failureId.localeCompare(b.failureId));
}

export const classifyRetries = compareRetries;
