# FailLens

FailLens is an open-source TypeScript CLI that turns terminal output or Playwright, Vitest, and JUnit results into a stable, evidence-backed failure report. The core is deterministic and works without an AI API key.

## Usage

```sh
# Install and build from a checkout
npm install
npm run build

# Analyze the bundled example as Markdown
node dist/cli.js examples/sample-failure.txt

# Emit machine-readable JSON
node dist/cli.js --format json examples/sample-failure.txt

# Read JSON from stdin and save a report
cat failures.json | node dist/cli.js --format json --output report.json
```

After installing the published package, use the `fail-lens` command directly:

```sh
fail-lens examples/sample-failure.txt
```

Input JSON may be one failure object, an array of failure objects, or an object with a `failures` array. Failure objects can provide `testName`, `message`, `stack`, `framework`, `kind`, `status`, `attempt`, and `metadata`.

`--help` prints usage and exits 0. Invalid options or unreadable files print an error and exit 2. Reproduction commands are generated from the framework and test name, with shell quoting and stable de-duplication.
