import assert from "node:assert/strict";
import test from "node:test";
import { reproductionCommands } from "../../src/reproduce";

test("reproduction commands are stable and de-duplicated", () => {
  const commands = reproductionCommands([
    { id: "d1", title: "x", summary: "x", category: "assertion", confidence: "high", ruleId: "r", failureIds: ["f1"], evidenceIds: [], suggestedActions: [], reproduction: [{ label: "rerun", command: "npx vitest run -t login", shell: "sh" }] },
    { id: "d2", title: "x", summary: "x", category: "assertion", confidence: "high", ruleId: "r", failureIds: ["f2"], evidenceIds: [], suggestedActions: [], reproduction: [{ label: "rerun", command: "npx vitest run -t login", shell: "sh" }] },
  ]);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].command, "npx vitest run -t login");
});
