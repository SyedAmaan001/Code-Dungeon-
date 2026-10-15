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
import { normalizeOutput } from "./evaluation/normalize";
import type { Challenge, ContentPack, Expectation } from "./schema";

export { normalizeOutput };

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

const INDENT = "    ";

function withExpectation(label: string, code: string, e: Expectation): PythonSnippet {
  return {
    label,
    code,
    ...(e.stdin !== undefined && { stdin: e.stdin }),
    ...(e.expectedOutput !== undefined && { expectedOutput: e.expectedOutput }),
    ...(e.expectedException !== undefined && { expectedException: e.expectedException }),
  };
}

/** Substitute one accepted value per blank into a fill_blank template. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{blank:([A-Za-z0-9._-]+)\}\}/g, (_, id: string) => values[id] ?? "");
}

/** Assemble an order_lines answer into a program (indent level × 4 spaces). */
export function assembleOrder(
  lines: { id: string; text: string; indent: number }[],
  order: string[],
): string {
  const byId = new Map(lines.map((l) => [l.id, l]));
  return order.map((id) => INDENT.repeat(byId.get(id)!.indent) + byId.get(id)!.text).join("\n");
}

/**
 * Every runnable claim in a challenge, as programs to execute:
 * - predict_output: the code must print the answer key.
 * - fill_blank: every accepted value (one blank varied at a time) must satisfy `check`.
 * - order_lines: every accepted order must satisfy `check`.
 * - find_fix_bug: the buggy code must behave as `buggyBehaviour`; `fixedCode` must satisfy `check`.
 * - trace: after the code runs, each field expression must print an accepted value.
 */
export function challengeSnippets(c: Challenge, where: string): PythonSnippet[] {
  const label = `${where} › ${c.id}`;
  switch (c.type) {
    case "predict_output":
      return [
        {
          label: `${label} (predict_output answer)`,
          code: c.code,
          ...(c.stdin !== undefined && { stdin: c.stdin }),
          expectedOutput: c.answer.output,
        },
      ];
    case "fill_blank": {
      if (!c.check) return [];
      const first = Object.fromEntries(c.blanks.map((b) => [b.id, c.answer.accepted[b.id]![0]!]));
      const variants = [first];
      for (const b of c.blanks)
        for (const v of c.answer.accepted[b.id]!.slice(1)) variants.push({ ...first, [b.id]: v });
      return variants.map((values, i) =>
        withExpectation(
          `${label} (fill_blank accepted answer #${i + 1})`,
          fillTemplate(c.template, values),
          c.check!,
        ),
      );
    }
    case "order_lines":
      if (!c.check) return [];
      return c.answer.orders.map((order, i) =>
        withExpectation(
          `${label} (order_lines accepted order #${i + 1})`,
          assembleOrder(c.lines, order),
          c.check!,
        ),
      );
    case "find_fix_bug": {
      const out: PythonSnippet[] = [];
      if (c.buggyBehaviour)
        out.push(withExpectation(`${label} (buggy program behaviour)`, c.code, c.buggyBehaviour));
      if (c.fixedCode && c.check)
        out.push(withExpectation(`${label} (fixed program)`, c.fixedCode, c.check));
      return out;
    }
    case "trace": {
      const probe = c.fields.map((f) => `print(${f.expression ?? f.id})`).join("\n");
      return [
        {
          label: `${label} (trace values)`,
          code: `${c.code}\n${probe}`,
          // Trace answers may list several accepted spellings; the first must be what Python prints.
          expectedOutput: c.fields.map((f) => c.answer.values[f.id]?.[0] ?? "").join("\n"),
        },
      ];
    }
    default:
      return [];
  }
}

export function collectSnippets(pack: ContentPack): PythonSnippet[] {
  const snippets: PythonSnippet[] = [];
  if (pack.meta.path.language && pack.meta.path.language !== "python") return snippets;
  for (const level of pack.levels) {
    const file = pack.levelFiles[level.id] ?? level.id;
    level.lesson?.examples.forEach((ex, i) =>
      snippets.push(withExpectation(`${file} › ${level.id} lesson example #${i + 1}`, ex.code, ex)),
    );
    for (const c of level.challenges) {
      if ("language" in c && c.language !== "python") continue;
      snippets.push(...challengeSnippets(c, file));
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
