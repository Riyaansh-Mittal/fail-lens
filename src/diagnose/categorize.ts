import type { FailureKind, NormalizedFailure } from "../contracts";

const patterns: Array<[FailureKind, RegExp[]]> = [
  ["timeout", [/timeout/i, /timed out/i, /exceeded.*(?:ms|seconds?)/i, /deadline/i]],
  ["network", [/econnrefused/i, /enotfound/i, /connection (?:reset|refused|closed)/i, /network/i, /fetch failed/i, /http request/i, /\b(?:502|503|504)\b/]],
  ["syntax", [/syntaxerror/i, /parse error/i, /unexpected token/i, /expected .* but found/i]],
  ["build", [/compil(?:e|ation) (?:error|failed)/i, /build failed/i, /ts\d{3,4}/i, /module not found/i, /cannot find module/i]],
  ["environment", [/permission denied/i, /enoent/i, /not installed/i, /command not found/i, /browser.*(?:missing|not found)/i, /environment/i]],
  ["assertion", [/assert(?:ion|ed)/i, /expected .* (?:to|but)/i, /to equal/i, /to be/i, /received/i, /deep equal/i]],
];

/** Categorize from explicit parser output first, then conservative message/stack signals. */
export function categorizeFailure(failure: Pick<NormalizedFailure, "kind" | "message" | "stack" | "status">): FailureKind {
  if (failure.kind !== "unknown") return failure.kind;
  const text = `${failure.message}\n${failure.stack ?? ""}`;
  for (const [kind, regexes] of patterns) if (regexes.some((regex) => regex.test(text))) return kind;
  if (failure.status === "timed-out") return "timeout";
  return "unknown";
}

export const classifyFailure = categorizeFailure;
