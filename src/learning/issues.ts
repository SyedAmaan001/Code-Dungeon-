export type IssueSeverity = "error" | "warning";

export interface ContentIssue {
  severity: IssueSeverity;
  /** File the issue relates to, relative to the pack directory when known. */
  file?: string;
  /** Location inside the file or entity, e.g. `challenges[0].answer`. */
  at?: string;
  message: string;
}

export function formatIssue(issue: ContentIssue): string {
  const where = [issue.file, issue.at].filter(Boolean).join(" › ");
  return `${issue.severity.toUpperCase()}${where ? ` ${where}` : ""}: ${issue.message}`;
}

export function hasErrors(issues: readonly ContentIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
