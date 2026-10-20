import type { FailureReport } from "../contracts";

export function renderJson(report: FailureReport): string { return `${JSON.stringify(report, null, 2)}\n`; }
export const renderJsonReport = renderJson;
