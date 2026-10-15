/**
 * Answer normalisation. Only differences that never change meaning are removed.
 *
 * - Case is always preserved (Python names, strings and output are case-sensitive).
 * - Leading and internal whitespace in program output is preserved (it is visible output).
 * - Internal whitespace in code tokens is preserved (`"a  b"` differs from `"a b"`);
 *   formatting variants such as `x+1` vs `x + 1` must be listed as accepted answers.
 */

/**
 * Program output: unify line endings, drop trailing spaces on each line and trailing
 * blank lines (invisible in a console). Identical to how content:verify-python compares.
 */
export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}

/** A single token, expression or value typed into a box: trim the ends only. */
export function normalizeToken(text: string): string {
  return text.trim();
}
