import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";
import type { ContentIssue } from "./issues";
import { Level, PathFile, SourcesFile, type ContentPack } from "./schema";

export interface LoadResult {
  /** Present when every file parsed; may still have cross-reference issues (see validatePack). */
  pack?: ContentPack;
  issues: ContentIssue[];
}

function zodIssues(file: string, error: z.ZodError): ContentIssue[] {
  return error.issues.map((i) => ({
    severity: "error" as const,
    file,
    at: i.path.length ? i.path.map(String).join(".") : undefined,
    message: i.message,
  }));
}

function readYaml(absFile: string, relFile: string, issues: ContentIssue[]): unknown {
  try {
    return parseYaml(readFileSync(absFile, "utf8"), { prettyErrors: true });
  } catch (err) {
    issues.push({
      severity: "error",
      file: relFile,
      message: `invalid YAML: ${(err as Error).message}`,
    });
    return undefined;
  }
}

/** Load and structurally validate one content pack directory. Never throws for content errors. */
export function loadPack(dir: string): LoadResult {
  const issues: ContentIssue[] = [];
  const pathFile = join(dir, "path.yaml");
  if (!existsSync(pathFile)) {
    return { issues: [{ severity: "error", file: "path.yaml", message: "missing path.yaml" }] };
  }

  const metaRaw = readYaml(pathFile, "path.yaml", issues);
  const meta = metaRaw === undefined ? undefined : PathFile.safeParse(metaRaw);
  if (meta && !meta.success) issues.push(...zodIssues("path.yaml", meta.error));

  let sources: ContentPack["sources"] = [];
  const sourcesFile = join(dir, "sources.yaml");
  if (existsSync(sourcesFile)) {
    const raw = readYaml(sourcesFile, "sources.yaml", issues);
    const parsed = raw === undefined ? undefined : SourcesFile.safeParse(raw);
    if (parsed?.success) sources = parsed.data.sources;
    else if (parsed) issues.push(...zodIssues("sources.yaml", parsed.error));
  }

  const levels: ContentPack["levels"] = [];
  const levelFiles: Record<string, string> = {};
  const levelsDir = join(dir, "levels");
  if (existsSync(levelsDir) && statSync(levelsDir).isDirectory()) {
    const files = readdirSync(levelsDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort();
    for (const f of files) {
      const rel = relative(dir, join(levelsDir, f));
      const raw = readYaml(join(levelsDir, f), rel, issues);
      if (raw === undefined) continue;
      const parsed = Level.safeParse(raw);
      if (!parsed.success) {
        issues.push(...zodIssues(rel, parsed.error));
        continue;
      }
      levels.push(parsed.data);
      // Duplicate IDs are reported by validatePack; keep the first file for messages.
      levelFiles[parsed.data.id] ??= rel;
    }
  }

  if (!meta?.success || issues.some((i) => i.severity === "error")) return { issues };
  levels.sort((a, b) => a.number - b.number);
  return { pack: { dir, meta: meta.data, sources, levels, levelFiles }, issues };
}

/** Every immediate subdirectory of `root` that contains a path.yaml. */
export function findPackDirs(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .map((name) => join(root, name))
    .filter((p) => statSync(p).isDirectory() && existsSync(join(p, "path.yaml")))
    .sort();
}
