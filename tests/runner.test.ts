import { describe, expect, it } from "vitest";
import { codeRunner, DisabledRunner } from "@/runner";

describe("CodeRunner", () => {
  it("is disabled: learner code is never executed", async () => {
    expect(codeRunner).toBeInstanceOf(DisabledRunner);
    expect(codeRunner.enabled).toBe(false);
    await expect(codeRunner.run({ language: "python", code: "print(1)" })).resolves.toEqual({
      status: "unavailable",
      reason: expect.stringContaining("not enabled"),
    });
  });
});
