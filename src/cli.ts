#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { buildReport } from "./report/analyze";
import { renderJson } from "./report/json";
import { renderMarkdown } from "./report/markdown";

export const HELP = `Usage: fail-lens [options] [input ...]

Analyze terminal output or structured JSON failures.

Options:
  -i, --input <file>   Read an input file (repeatable; default: stdin)
  -f, --format <kind>  Output format: markdown (default) or json
  -o, --output <file>  Write the report to a file instead of stdout
  -h, --help           Show this help
  -v, --version        Show the version
`;

export interface CliOptions { inputs: string[]; format: "markdown" | "json"; output?: string; help?: boolean; version?: boolean; }
export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { inputs: [], format: "markdown" };
  for (let i = 0; i < args.length; i += 1) { const arg = args[i]; if (arg === "-h" || arg === "--help") options.help = true; else if (arg === "-v" || arg === "--version") options.version = true; else if (arg === "-i" || arg === "--input") { if (!args[++i]) throw new Error("--input requires a file"); options.inputs.push(args[i]); } else if (arg === "-f" || arg === "--format") { const format = args[++i]; if (format !== "json" && format !== "markdown") throw new Error("--format must be markdown or json"); options.format = format; } else if (arg === "-o" || arg === "--output") { if (!args[++i]) throw new Error("--output requires a file"); options.output = args[i]; } else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`); else options.inputs.push(arg); }
  return options;
}

export async function runCli(args: string[], stdin = process.stdin): Promise<{ code: number; output: string }> {
  try {
    const options = parseArgs(args);
    if (options.help) return { code: 0, output: HELP };
    if (options.version) return { code: 0, output: "fail-lens 0.1.0\n" };
    const inputs = options.inputs.length ? await Promise.all(options.inputs.map(async (path) => ({ text: await readFile(path, "utf8"), source: path }))) : [{ text: await readStdin(stdin), source: "stdin" }];
    const report = buildReport(inputs, { inputFiles: inputs.map((input) => input.source) });
    const output = options.format === "json" ? renderJson(report) : renderMarkdown(report);
    if (options.output) await writeFile(options.output, output, "utf8");
    return { code: 0, output: options.output ? "" : output };
  } catch (error) { return { code: 2, output: `error: ${error instanceof Error ? error.message : String(error)}\n${HELP}` }; }
}

async function readStdin(stream: NodeJS.ReadableStream): Promise<string> { let value = ""; for await (const chunk of stream) value += String(chunk); return value; }

if (require.main === module) {
  runCli(process.argv.slice(2)).then((result) => { process.stdout.write(result.output); process.exitCode = result.code; });
}
