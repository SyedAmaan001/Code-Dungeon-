import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRichText } from "@/ui/rich-text";
import { CONTENT_ROOT, loadOrThrow } from "../support/packs";

describe("lesson text parsing", () => {
  it("keeps fenced code blocks intact, including indentation", () => {
    const text = 'An `if` runs a block:\n\n```\nif t > 25:\n    print("Hot")\n```\n\nThen more.';
    expect(parseRichText(text)).toEqual([
      { kind: "paragraph", text: "An `if` runs a block:" },
      { kind: "code", code: 'if t > 25:\n    print("Hot")' },
      { kind: "paragraph", text: "Then more." },
    ]);
  });

  it("keeps blank lines inside a fence in the same block", () => {
    expect(parseRichText("```python\na = 1\n\nb = 2\n```")).toEqual([
      { kind: "code", code: "a = 1\n\nb = 2" },
    ]);
  });

  it("leaves no stray fences in any published lesson", () => {
    const pack = loadOrThrow(join(CONTENT_ROOT, "python-fundamentals"));
    const fenced = pack.levels.filter((l) => l.lesson?.explanation.includes("```"));
    expect(fenced.length).toBeGreaterThan(0);
    for (const l of pack.levels) {
      const blocks = parseRichText(l.lesson?.explanation ?? "");
      for (const b of blocks)
        if (b.kind === "paragraph") expect(b.text, `${l.id}: ${b.text}`).not.toContain("```");
    }
    for (const l of fenced) {
      const code = parseRichText(l.lesson!.explanation).filter((b) => b.kind === "code");
      expect(code.length, l.id).toBeGreaterThan(0);
      expect(
        code.some((b) => b.kind === "code" && /\n {4}\S/.test(b.code)),
        l.id,
      ).toBe(true);
    }
  });
});
