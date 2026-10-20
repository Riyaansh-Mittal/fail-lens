import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runCli, tempCase } from "../support/cli.mjs";

test("untrusted evidence is bounded before it reaches the report", async () => {
  const files = await tempCase();
  const oversized = "x".repeat(250_000);
  const input = await files.input("oversized.json", JSON.stringify({
    framework: "text",
    failures: [{ name: "large failure", status: "failed", message: oversized }],
  }));
  const output = files.output();
  const result = await runCli(["--input", input, "--output", output, "--format", "json"]);
  assert.equal(result.code, 0, `CLI failed:\n${result.stderr}`);
  const report = JSON.parse(await readFile(output, "utf8"));
  assert.ok(report.evidence.length > 0);
  assert.ok(report.evidence.every((evidence) => evidence.content.length <= 100_000));
  assert.ok(report.evidence.some((evidence) => evidence.truncated === true));
});
