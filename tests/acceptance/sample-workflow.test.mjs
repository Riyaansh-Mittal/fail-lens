import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { runCli } from "../support/cli.mjs";

const sample = join(new URL("../..", import.meta.url).pathname, "examples/sample-failure.json");

test("canonical Playwright sample produces cross-domain diagnostics", async () => {
  const result = await runCli(["--input", sample, "--format", "json"]);

  assert.equal(result.code, 0, `CLI failed:\n${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, "1");
  assert.ok(Array.isArray(report.failures));
  assert.ok(Array.isArray(report.evidence));
  assert.ok(Array.isArray(report.diagnostics));
  assert.ok(report.failures.length > 1, "the sample should contain multiple test records");
  const failed = report.failures.filter((failure) => ["failed", "timed-out", "errored"].includes(failure.status));
  assert.ok(failed.length > 1, "the sample should contain multiple failures");
  assert.ok(report.diagnostics.length >= 4, "the sample should produce at least four diagnostics");

  const failureNames = failed
    .map((failure) => `${failure.suiteName ?? ""} ${failure.testName}`.toLowerCase())
    .join("\n");
  for (const domain of ["checkout", "auth", "search", "reporting"]) {
    assert.match(failureNames, new RegExp(domain), `expected a ${domain} failure`);
  }
});
