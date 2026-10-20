import type { Diagnostic, NormalizedFailure, ReproductionCommand } from "../contracts";

/** Return stable, de-duplicated commands in diagnostic order. */
export function reproductionCommands(diagnostics: Diagnostic[], failures: NormalizedFailure[] = []): ReproductionCommand[] {
  const commands = diagnostics.flatMap((diagnostic) => diagnostic.reproduction ?? []);
  const seen = new Set<string>();
  for (const failure of failures) {
    if (seen.has(failure.testName)) continue;
    seen.add(failure.testName);
    if (!commands.some((command) => command.command.includes(failure.testName))) commands.push({ label: "rerun test", command: `npm test -- --grep '${failure.testName.replace(/'/g, "'\\''")}'`, shell: "sh", reason: "Fallback command for a text failure." });
  }
  return commands.filter((command, index, all) => all.findIndex((candidate) => candidate.command === command.command) === index);
}

export function shellQuote(value: string): string {
  return /^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`;
}

export const getReproductionCommands = reproductionCommands;
