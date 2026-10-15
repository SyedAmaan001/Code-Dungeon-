export type IssueSeverity = "error" | "warning";

export interface ContentIssue {
  severity: IssueSeverity;
  /** File the issue relates to, relative to the pack directory when known. */
  file?: string;
  /** Level id the issue belongs to, when it concerns a level. */
  level?: string;
  /** Field inside the file or entity, e.g. `challenges[0] (py.L003.c1).hints`. */
  at?: string;
  message: string;
}

/** e.g. `ERROR levels/L003-variables.yaml › py.L003 › challenges[1] (py.L003.c2).hints: …` */
export function formatIssue(issue: ContentIssue): string {
  const where = [issue.file, issue.level, issue.at].filter(Boolean).join(" › ");
  return `${issue.severity.toUpperCase()}${where ? ` ${where}` : ""}: ${issue.message}`;
}

export function hasErrors(issues: readonly ContentIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
