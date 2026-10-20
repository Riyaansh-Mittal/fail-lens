import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runCli, tempCase } from "../support/cli.mjs";

const secrets = {
  token: "ghp_0123456789abcdefghijklmnopqrstuvwxyzABCD",
  bearer: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret.payload",
  password: "password=correct-horse-battery-staple",
};

test("report redacts credentials and marks redacted evidence", async () => {
  const files = await tempCase();
  const input = await files.input(
    "secret-run.json",
    JSON.stringify({
      framework: "text",
      failures: [{
        name: "secret-bearing failure",
        status: "failed",
        message: `request failed: ${secrets.token}`,
        stack: `${secrets.bearer}\n${secrets.password}\ncontact person@example.test`,
      }],
    }),
  );
  const output = files.output();
  const result = await runCli(["--input", input, "--output", output, "--format", "json"]);
  assert.equal(result.code, 0, `CLI failed:\n${result.stderr}`);

  const serialized = await readFile(output, "utf8");
  for (const secret of Object.values(secrets)) assert.ok(!serialized.includes(secret));
  const report = JSON.parse(serialized);
  assert.ok(report.evidence.some((evidence) => evidence.redacted === true));
  assert.ok(report.evidence.every((evidence) => evidence.content.length <= 100_000));
});
