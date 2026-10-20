import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { detectInput, parseJUnitXml, parsePlaywrightJson, parseVitestJson } from "../../src/ingest";

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

describe("report ingestion", () => {
  it("normalizes Playwright retries, locations and evidence", () => {
    const result = parsePlaywrightJson(fixture("playwright.json"), { source: "playwright.json" });
    assert.equal(result.framework, "playwright");
    assert.equal(result.failures.length, 2);
    assert.equal(result.failures[0].status, "failed");
    assert.equal(result.failures[0].location?.file, "tests/checkout.spec.ts");
    assert.ok(result.failures[0].evidenceIds.length > 0);
  });

  it("normalizes Vitest assertion failures and preserves passed tests", () => {
    const result = parseVitestJson(fixture("vitest.json"));
    assert.equal(result.failures.length, 2);
    assert.equal(result.failures[1].status, "failed");
    assert.equal(result.failures[1].suiteName, "math");
  });

  it("parses JUnit self-closing cases, failures and output", () => {
    const result = parseJUnitXml(fixture("junit.xml"));
    assert.equal(result.failures.length, 2);
    assert.equal(result.failures[0].status, "passed");
    assert.equal(result.failures[1].kind, "assertion");
    assert.ok(result.evidence.some((item) => item.kind === "stdout"));
  });

  it("detects formats by content and extension", () => {
    assert.equal(detectInput(fixture("junit.xml")), "junit");
    assert.equal(detectInput(fixture("playwright.json"), "report.json"), "playwright");
    assert.equal(detectInput(fixture("vitest.json"), "vitest.json"), "vitest");
  });
});
