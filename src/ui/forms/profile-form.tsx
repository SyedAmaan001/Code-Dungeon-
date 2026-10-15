"use client";
import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/app/actions/account";
import { Icon } from "../art/icons";

export function ProfileForm({ handle, visible }: { handle: string; visible: boolean }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {
    status: "idle",
  });
  return (
    <form action={action} className="stack">
      <div className="field">
        <label className="field__label" htmlFor="handle">
          Handle
        </label>
        <input
          id="handle"
          name="handle"
          className="input"
          defaultValue={handle}
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z][A-Za-z0-9_\-]{2,19}"
          autoComplete="nickname"
          aria-describedby="handle-hint"
        />
        <span id="handle-hint" className="field__hint">
          3–20 letters, digits, _ or -, starting with a letter. Never use your real name or email.
        </span>
      </div>
      <label className="check">
        <input type="checkbox" name="visible" defaultChecked={visible} />
        <span>
          Show my handle and XP on the leaderboard
          <span className="field__hint" style={{ display: "block" }}>
            When off, you still see your own progress but other players do not see you.
          </span>
        </span>
      </label>
      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <span role="status" aria-live="polite">
          {state.status === "saved" && (
            <span className="badge badge--success">
              <Icon name="check" size={14} /> Saved
            </span>
          )}
        </span>
      </div>
      {state.status === "error" && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={18} /> {state.message}
        </p>
      )}
    </form>
  );
}
