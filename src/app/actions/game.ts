"use server";
/**
 * Game actions called by the level room. The browser sends only an answer (or a hint
 * request) and an idempotency key; the services validate the body strictly, judge it,
 * compute XP and game events, and save everything in one transaction. The player id
 * comes from the verified session.
 */
import { playerForAction } from "@/auth/server";
import type { HintView, SubmitView } from "@/services/presenter";
import { getRuntime } from "@/services/runtime";

export async function submitAnswer(input: unknown): Promise<SubmitView> {
  try {
    const player = await playerForAction();
    if (!player) return { status: "signed_out" };
    const { game, presenter, actionLimiter } = getRuntime();
    if (!actionLimiter.allow(player.playerId)) return { status: "rate_limited" };
    return presenter.submit(await game.submit(player.playerId, input));
  } catch (err) {
    console.error("[code-dungeon] submitAnswer failed", err instanceof Error ? err.message : err);
    return { status: "error" };
  }
}

export async function revealHint(input: unknown): Promise<HintView> {
  try {
    const player = await playerForAction();
    if (!player) return { status: "signed_out" };
    const { game, presenter, actionLimiter } = getRuntime();
    if (!actionLimiter.allow(player.playerId)) return { status: "rate_limited" };
    return presenter.hint(await game.requestHint(player.playerId, input));
  } catch (err) {
    console.error("[code-dungeon] revealHint failed", err instanceof Error ? err.message : err);
    return { status: "error" };
  }
}
