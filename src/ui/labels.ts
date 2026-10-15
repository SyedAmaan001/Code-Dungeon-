/** Human-readable labels for content and game states (presentation only). */

export const CHALLENGE_TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Multiple choice",
  predict_output: "Predict the output",
  fill_blank: "Fill in the blanks",
  order_lines: "Arrange the lines",
  trace: "Trace the values",
  find_fix_bug: "Find and fix the bug",
  code_write: "Write code",
};

export const LEVEL_KIND_LABEL: Record<string, string> = {
  standard: "Room",
  checkpoint: "Checkpoint",
  major: "Major encounter",
  boss: "Boss",
};

export const LEVEL_STATUS_LABEL: Record<string, string> = {
  locked: "Locked",
  available: "Open",
  in_progress: "In progress",
  completed: "Complete",
};

/** Never presents AI review as approval (DEC-011). */
export const REVIEW_LABEL: Record<string, string> = {
  human: "Human-reviewed",
  agent: "AI-reviewed · human review pending",
  none: "Not reviewed",
};

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatXp(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
