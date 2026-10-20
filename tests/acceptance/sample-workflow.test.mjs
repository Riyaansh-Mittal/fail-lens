import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runCli, tempCase } from "../support/cli.mjs";

const fixture = join(new URL("..", import.meta.url).pathname, "fixtures/sample-run.json");

test("sample workflow ingests a run and emits a versioned report", async () => {
  const files = await tempCase();
  const input = await files.input("sample-run.json", await readFile(fixture, "utf8"));
  const output = files.output();
  const result = await runCli(["--input", input, "--output", output, "--format", "json"]);

  assert.equal(result.code, 0, `CLI failed:\n${result.stderr}`);
  const report = await files.readJson(output);
  assert.equal(report.schemaVersion, "1");
  assert.ok(Array.isArray(report.failures));
  assert.ok(Array.isArray(report.evidence));
  assert.ok(Array.isArray(report.diagnostics));
  assert.equal(report.summary.total, report.failures.length);
  assert.equal(report.summary.failed, report.failures.filter((failure) => failure.status === "failed").length);
  assert.ok(report.failures.some((failure) => failure.testName === "checkout rejects an expired card"));
});
