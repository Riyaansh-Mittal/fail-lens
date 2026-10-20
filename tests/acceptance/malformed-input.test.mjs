import assert from "node:assert/strict";
import { test } from "node:test";
import { runCli, tempCase } from "../support/cli.mjs";

for (const [name, contents] of [
  ["malformed JSON", "{\"tests\":["],
  ["empty input", ""],
  ["wrong top-level type", "42"],
]) {
  test(`rejects ${name} with a useful error`, async () => {
    const files = await tempCase();
    const input = await files.input("bad-input.json", contents);
    const result = await runCli(["--input", input, "--format", "json"]);
    const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();

    assert.notEqual(result.code, 0, "malformed input must not be reported as a successful run");
    assert.match(combined, /invalid|malformed|parse|input|empty|expected/);
  });
}
