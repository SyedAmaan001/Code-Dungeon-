"use client";
/**
 * Tells the player when the browser goes offline. Answers are never queued silently:
 * an answer sent while offline shows "Something went wrong" with a retry that reuses the
 * same submission id, so it is counted at most once when the connection returns.
 */
import { useSyncExternalStore } from "react";
import { Icon } from "./art/icons";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineNotice() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p className="offline-notice" role="status">
      <Icon name="alert" size={18} />
      You are offline. Your saved progress is safe; answers can be sent again when you reconnect.
    </p>
  );
}
