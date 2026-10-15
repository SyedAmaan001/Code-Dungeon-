import "server-only";
import { cache } from "react";
import { getRuntime } from "@/services/runtime";

/** The signed-in player's game view, loaded once per request (layout and page share it). */
export const loadPlayerView = cache((playerId: string) => getRuntime().game.getView(playerId));
