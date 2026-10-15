/**
 * Verifies author-written Python in content packs against a real CPython interpreter.
 *
 * Scope: this runs REVIEWED CURRICULUM CODE from the repository in a development/CI
 * process (docs/EXECUTION.md Phase 2). It is not, and must never become, a way to
 * run learner-submitted code — that requires a sandboxed CodeRunner (src/runner).
 *
 * Bounds: isolated mode (-I: no user site-packages, no PYTHON* env vars, script dir
 * not on sys.path), minimal environment, fresh temporary working directory,
 * wall-clock timeout with SIGKILL, and capped output.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContentPack } from "./schema";

export interface PythonSnippet {
  /** Human-readable location, e.g. `levels/L001.yaml › py.L001 lesson example`. */
  label: string;
  code: string;
  stdin?: string;
  expectedOutput?: string;
  expectedException?: string;
}

export interface RunOptions {
  python: string;
  timeoutMs: number;
  maxOutputBytes: number;
}

export const DEFAULT_RUN_OPTIONS: RunOptions = {
  python: process.env.PYTHON || "python3",
  timeoutMs: 5_000,
  maxOutputBytes: 64 * 1024,
};

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  /** Set when the interpreter could not be started at all. */
  spawnError?: string;
}

export interface SnippetResult {
  snippet: PythonSnippet;
  ok: boolean;
  reason?: string;
}

export function collectSnippets(pack: ContentPack): PythonSnippet[] {
  const snippets: PythonSnippet[] = [];
  if (pack.meta.path.language && pack.meta.path.language !== "python") return snippets;
  for (const level of pack.levels) {
    const file = pack.levelFiles[level.id] ?? level.id;
    const ex = level.lesson?.example;
    if (ex) {
      snippets.push({
        label: `${file} › ${level.id} lesson example`,
        code: ex.code,
        ...(ex.stdin !== undefined && { stdin: ex.stdin }),
        ...(ex.expectedOutput !== undefined && { expectedOutput: ex.expectedOutput }),
        ...(ex.expectedException !== undefined && { expectedException: ex.expectedException }),
      });
    }
    for (const c of level.challenges) {
      if (c.type === "predict_output" && c.language === "python") {
        snippets.push({
          label: `${file} › ${c.id} (predict_output answer)`,
          code: c.code,
          ...(c.stdin !== undefined && { stdin: c.stdin }),
          expectedOutput: c.answer.output,
        });
      }
    }
  }
  return snippets;
}

export function runPython(
  code: string,
  stdin = "",
  options: RunOptions = DEFAULT_RUN_OPTIONS,
): RunResult {
  const cwd = mkdtempSync(join(tmpdir(), "code-dungeon-verify-"));
  try {
    const res = spawnSync(options.python, ["-I", "-X", "utf8", "-c", code], {
      cwd,
      input: stdin,
      encoding: "utf8",
      timeout: options.timeoutMs,
      killSignal: "SIGKILL",
      maxBuffer: options.maxOutputBytes,
      // Minimal environment: only PATH and locale (NODE_ENV is required by the typings; -I ignores it).
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        LANG: "C.UTF-8",
        NODE_ENV: process.env.NODE_ENV,
      },
    });
    const timedOut = (res.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
    const overflow = (res.error as NodeJS.ErrnoException | undefined)?.code === "ENOBUFS";
    const spawnError =
      res.error && !timedOut && !overflow
        ? `could not run ${options.python}: ${res.error.message}`
        : undefined;
    return {
      stdout: res.stdout ?? "",
      stderr: overflow ? `output exceeded ${options.maxOutputBytes} bytes` : (res.stderr ?? ""),
      exitCode: overflow ? null : res.status,
      timedOut,
      ...(spawnError && { spawnError }),
    };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** Ignore trailing whitespace on each line and trailing blank lines; everything else is exact. */
export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}

export function verifySnippet(
  snippet: PythonSnippet,
  options: RunOptions = DEFAULT_RUN_OPTIONS,
): SnippetResult {
  const run = runPython(snippet.code, snippet.stdin ?? "", options);
  const fail = (reason: string): SnippetResult => ({ snippet, ok: false, reason });

  if (run.spawnError) return fail(run.spawnError);
  if (run.timedOut) return fail(`timed out after ${options.timeoutMs} ms`);
  if (run.exitCode === null) return fail(run.stderr || "terminated without an exit code");

  if (snippet.expectedException !== undefined) {
    if (run.exitCode === 0)
      return fail(`expected ${snippet.expectedException} but the program succeeded`);
    const lastLine = normalizeOutput(run.stderr).split("\n").pop() ?? "";
    const raised = lastLine.split(":")[0]!.trim();
    return raised === snippet.expectedException
      ? { snippet, ok: true }
      : fail(`expected ${snippet.expectedException}, got: ${lastLine}`);
  }

  if (run.exitCode !== 0) {
    const lastLine = normalizeOutput(run.stderr).split("\n").pop();
    return fail(`exited with code ${run.exitCode}: ${lastLine}`);
  }
  const actual = normalizeOutput(run.stdout);
  const expected = normalizeOutput(snippet.expectedOutput ?? "");
  return actual === expected
    ? { snippet, ok: true }
    : fail(
        `output mismatch\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
      );
}

export function pythonVersion(python = DEFAULT_RUN_OPTIONS.python): string | undefined {
  const res = spawnSync(
    python,
    ["-I", "-c", "import sys; print('%d.%d.%d' % sys.version_info[:3])"],
    {
      encoding: "utf8",
      timeout: 5_000,
    },
  );
  return res.status === 0 ? res.stdout.trim() : undefined;
}

/** Compare dotted versions numerically: returns true when `actual` >= `minimum`. */
export function versionAtLeast(actual: string, minimum: string): boolean {
  const a = actual.split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}
