import assert from "node:assert/strict";
import test from "node:test";
import { buildReport } from "../../src/report/analyze";
import { renderJson } from "../../src/report/json";
import { renderMarkdown } from "../../src/report/markdown";

test("analyzes terminal output into a diagnostic report", () => {
  const report = buildReport([{ source: "sample.txt", text: "✘ login (tests/login.spec.ts:8:2)\nError: expect(received).toBe(expected)" }], { generatedAt: "2024-01-01T00:00:00.000Z" });
  assert.equal(report.summary.total, 1);
  assert.equal(report.failures[0].testName, "login");
  assert.equal(report.failures[0].kind, "assertion");
  assert.match(renderMarkdown(report), /# Failure report/);
  assert.equal(JSON.parse(renderJson(report)).schemaVersion, "1");
});

test("bounds and redacts untrusted structured input", () => {
  const report = buildReport([{ format: "json", text: JSON.stringify({ failures: [{ testName: "secret", message: "token=abc123", stack: "x".repeat(120_000) }] }) }]);
  assert.match(report.failures[0].message, /REDACTED/);
  assert.equal(report.evidence[0].truncated, true);
  assert.equal(report.evidence[0].content.includes("abc123"), false);
});
