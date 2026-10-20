import type { FailureReport } from "../contracts";

export function renderMarkdown(report: FailureReport): string {
  const lines = ["# Failure report", "", `Generated: ${report.generatedAt}`, "", "## Summary", "", `- Total: **${report.summary.total}**`, `- Failed: **${report.summary.failed}**`, `- Flaky: **${report.summary.flaky}**`, `- Diagnostics: **${report.summary.diagnosticCount}**`, "", "## Diagnostics", ""];
  if (!report.diagnostics.length) lines.push("No diagnostics were produced.", "");
  for (const diagnostic of report.diagnostics) { lines.push(`### ${diagnostic.title}`, "", diagnostic.summary, "", `- Category: ${diagnostic.category}`, `- Confidence: ${diagnostic.confidence}`, `- Rule: \`${diagnostic.ruleId}\``, "", "Suggested actions:", ...diagnostic.suggestedActions.map((action) => `- ${action}`)); if (diagnostic.reproduction?.length) lines.push("", "Reproduction:", ...diagnostic.reproduction.map((command) => `- \`${command.command}\``)); lines.push(""); }
  lines.push("## Failures", "", "| Test | Framework | Kind | Status | Message |", "| --- | --- | --- | --- | --- |");
  for (const failure of report.failures) lines.push(`| ${escape(failure.testName)} | ${failure.framework} | ${failure.kind} | ${failure.status} | ${escape(failure.message)} |`);
  return `${lines.join("\n")}\n`;
}
function escape(value: string): string { return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " "); }

export const renderMarkdownReport = renderMarkdown;
