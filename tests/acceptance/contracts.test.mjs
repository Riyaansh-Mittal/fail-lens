import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;

test("frozen contracts remain exported and versioned", async () => {
  const index = await readFile(join(root, "src/contracts/index.ts"), "utf8");
  for (const module of ["failure", "evidence", "diagnostic", "report"]) {
    assert.match(index, new RegExp(`export \\* from [\"']\\./${module}[\"']`));
  }
  const report = await readFile(join(root, "src/contracts/report.ts"), "utf8");
  assert.match(report, /schemaVersion:\s*[\"']1[\"']/);
});

test("release workflow runs the declared typecheck, build, and test checks", async () => {
  const workflow = await readFile(join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /actions\/checkout@v4/);
  assert.match(workflow, /actions\/setup-node@v4/);
  assert.match(workflow, /run: npm run typecheck/);
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /run: npm test/);
  assert.doesNotMatch(workflow, /npx\s/);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/);
});
