import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatIssue } from "@/learning/issues";
import { findPackDirs, loadPack } from "@/learning/loader";
import { Challenge, Level, VerifiedExample } from "@/learning/schema";
import { FIXTURES, VALID_SMALL } from "../support/packs";

function tempPack(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "code-dungeon-pack-"));
  mkdirSync(join(dir, "levels"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const minimalPath = `schemaVersion: 1
subject: { id: s, title: S, description: S }
path: { id: p, title: P, description: P, version: 1, status: draft, audience: A, learningGoal: G }
zones: [{ id: z1, title: Z, order: 1, themeKey: t }]
`;

describe("loadPack", () => {
  it("loads the valid fixture with levels sorted by number", () => {
    const { pack, issues } = loadPack(VALID_SMALL);
    expect(issues).toEqual([]);
    expect(pack?.levels.map((l) => l.number)).toEqual([1, 2, 3]);
    expect(pack?.levelFiles["fx.L002"]).toBe(join("levels", "L002-structures.yaml"));
  });

  it("reports a missing path.yaml", () => {
    const dir = mkdtempSync(join(tmpdir(), "code-dungeon-empty-"));
    expect(loadPack(dir).issues[0]?.message).toBe("missing path.yaml");
  });

  it("reports malformed YAML with the file name and does not return a pack", () => {
    const dir = tempPack({ "path.yaml": minimalPath, "levels/L001.yaml": "id: [unclosed" });
    const { pack, issues } = loadPack(dir);
    expect(pack).toBeUndefined();
    expect(formatIssue(issues[0]!)).toMatch(/^ERROR levels\/L001\.yaml: invalid YAML/);
  });

  it("reports schema errors with their location", () => {
    const dir = tempPack({
      "path.yaml": minimalPath,
      "levels/L001.yaml": "id: L1\nversion: 1\nnumber: 0\nzone: z1\ntitle: T\nstatus: finished\n",
    });
    const { issues } = loadPack(dir);
    const where = issues.map((i) => `${i.file}:${i.at}`);
    expect(where).toContain("levels/L001.yaml:number");
    expect(where).toContain("levels/L001.yaml:status");
  });

  it("rejects unknown fields so typos cannot silently drop content", () => {
    const dir = tempPack({
      "path.yaml": minimalPath,
      "levels/L001.yaml":
        "id: L1\nversion: 1\nnumber: 1\nzone: z1\ntitle: T\nstatus: draft\nprerequisits: []\n",
    });
    expect(
      loadPack(dir)
        .issues.map((i) => i.message)
        .join(),
    ).toMatch(/prerequisits/);
  });

  it("finds pack directories by path.yaml", () => {
    expect(findPackDirs(FIXTURES)).toEqual([VALID_SMALL]);
  });
});

describe("schemas", () => {
  it("accepts levels with numbers well beyond 25", () => {
    const parsed = Level.parse({
      id: "x.L250",
      version: 1,
      number: 250,
      zone: "z",
      title: "T",
      status: "draft",
    });
    expect(parsed.number).toBe(250);
    expect(parsed.prerequisites).toEqual([]);
  });

  it("rejects IDs with spaces and unknown challenge types", () => {
    expect(
      Level.safeParse({
        id: "bad id",
        version: 1,
        number: 1,
        zone: "z",
        title: "T",
        status: "draft",
      }).success,
    ).toBe(false);
    expect(
      Challenge.safeParse({ id: "c", version: 1, difficulty: 1, prompt: "p", type: "essay" })
        .success,
    ).toBe(false);
  });

  it("requires an example to declare exactly one expectation", () => {
    expect(VerifiedExample.safeParse({ code: "print(1)" }).success).toBe(false);
    expect(
      VerifiedExample.safeParse({
        code: "print(1)",
        expectedOutput: "1",
        expectedException: "ValueError",
      }).success,
    ).toBe(false);
    expect(VerifiedExample.safeParse({ code: "print(1)", expectedOutput: "1" }).success).toBe(true);
  });
});
