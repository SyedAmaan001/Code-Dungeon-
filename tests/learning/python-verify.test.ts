/**
 * These tests run a REAL Python interpreter (python3, or $PYTHON). They fail — they do
 * not skip — when Python is unavailable, because verified examples are a content
 * quality requirement (docs/CONTENT_QUALITY_STANDARD.md).
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RUN_OPTIONS,
  collectSnippets,
  normalizeOutput,
  pythonVersion,
  runPython,
  verifySnippet,
  versionAtLeast,
} from "@/learning/python-verify";
import { loadOrThrow, VALID_SMALL } from "../support/packs";

describe("real Python interpreter", () => {
  it("is available and at least Python 3.10", () => {
    const version = pythonVersion();
    expect(version, `${DEFAULT_RUN_OPTIONS.python} not found`).toBeDefined();
    expect(versionAtLeast(version!, "3.10")).toBe(true);
  });

  it("verifies every snippet in the valid fixture", () => {
    const snippets = collectSnippets(loadOrThrow(VALID_SMALL));
    expect(snippets.map((s) => s.label)).toEqual([
      "levels/L001-output.yaml › fx.L001 lesson example",
      "levels/L001-output.yaml › fx.L001.c1 (predict_output answer)",
      "levels/L002-structures.yaml › fx.L002 lesson example",
    ]);
    for (const s of snippets) expect(verifySnippet(s)).toEqual({ snippet: s, ok: true });
  });

  it("fails when the authored output is wrong", () => {
    const result = verifySnippet({ label: "t", code: 'print("2" + "3")', expectedOutput: "5" });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("output mismatch");
  });

  it("checks the exception class for examples that are meant to fail", () => {
    expect(
      verifySnippet({ label: "t", code: "int('x')", expectedException: "ValueError" }).ok,
    ).toBe(true);
    expect(
      verifySnippet({ label: "t", code: "int('x')", expectedException: "TypeError" }).reason,
    ).toContain("ValueError");
    expect(
      verifySnippet({ label: "t", code: "print(1)", expectedException: "ValueError" }).ok,
    ).toBe(false);
  });

  it("fails a snippet that crashes unexpectedly", () => {
    const result = verifySnippet({ label: "t", code: "print(undefined_name)", expectedOutput: "" });
    expect(result.reason).toContain("NameError");
  });

  it("feeds stdin to input()", () => {
    const result = verifySnippet({
      label: "t",
      code: "name = input()\nprint('Hi', name)",
      stdin: "Ada\n",
      expectedOutput: "Hi Ada",
    });
    expect(result.ok).toBe(true);
  });

  it("kills runaway programs at the timeout", () => {
    const result = verifySnippet(
      { label: "t", code: "while True:\n    pass", expectedOutput: "" },
      { ...DEFAULT_RUN_OPTIONS, timeoutMs: 1_000 },
    );
    expect(result).toMatchObject({ ok: false, reason: "timed out after 1000 ms" });
  });

  it("caps output size", () => {
    const run = runPython("print('x' * 1_000_000)", "", {
      ...DEFAULT_RUN_OPTIONS,
      maxOutputBytes: 1024,
    });
    expect(run.exitCode).toBeNull();
    expect(run.stderr).toContain("output exceeded");
  });

  it("runs isolated from the repository and from PYTHON* environment variables", () => {
    const run = runPython("import os, sys; print(os.getcwd() != '' and sys.flags.isolated)");
    expect(run.stdout.trim()).toBe("1");
  });

  it("reports a missing interpreter instead of passing", () => {
    const result = verifySnippet(
      { label: "t", code: "print(1)", expectedOutput: "1" },
      { ...DEFAULT_RUN_OPTIONS, python: "definitely-not-python" },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("could not run");
  });
});

describe("helpers", () => {
  it("normalises trailing whitespace and blank lines only", () => {
    expect(normalizeOutput("a  \nb\n\n")).toBe("a\nb");
    expect(normalizeOutput(" a")).toBe(" a");
  });

  it("compares versions numerically", () => {
    expect(versionAtLeast("3.13.16", "3.10")).toBe(true);
    expect(versionAtLeast("3.9.18", "3.10")).toBe(false);
  });
});
