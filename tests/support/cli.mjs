import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const ROOT = new URL("../..", import.meta.url).pathname;

async function firstExisting(paths) {
  for (const path of paths) {
    try {
      await access(join(ROOT, path));
      return join(ROOT, path);
    } catch {
      // Keep looking: the source entry point may be replaced by a build output.
    }
  }
  return undefined;
}

/**
 * Run the built CLI. OMNIRUSH_CLI may be set to a JSON array by a release job
 * when the project is packaged rather than run from the repository checkout.
 */
export async function runCli(args, options = {}) {
  const command = process.env.OMNIRUSH_CLI
    ? JSON.parse(process.env.OMNIRUSH_CLI)
    : undefined;
  const builtCli = command ? undefined : await firstExisting(["dist/cli.js"]);
  const executable = command ?? (builtCli ? ["node", builtCli] : undefined);
  if (!executable[1]) {
    throw new Error(
      "Built CLI not found at dist/cli.js; run npm run build before acceptance tests",
    );
  }

  const cwd = options.cwd ?? ROOT;
  const child = spawn(executable[0], [...executable.slice(1), ...args], {
    cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (options.stdin !== undefined) child.stdin.end(options.stdin);
  else child.stdin.end();
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return {
    code,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
  };
}

export async function tempCase(prefix = "omnirush-qa-") {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  return {
    directory,
    input: async (name, value) => {
      const path = join(directory, name);
      await writeFile(path, value, "utf8");
      return path;
    },
    output: (name = "report.json") => join(directory, name),
    readJson: async (path) => JSON.parse(await readFile(path, "utf8")),
  };
}
