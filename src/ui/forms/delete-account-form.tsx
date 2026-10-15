"use client";
/**
 * Account deletion: explicit, typed confirmation (the player's exact handle) plus an
 * acknowledgement. The server repeats every check; this form only collects intent.
 */
import { useActionState, useState } from "react";
import { deleteAccount, type DeleteAccountState } from "@/app/actions/account";
import { Icon } from "../art/icons";

export function DeleteAccountForm({ handle }: { handle: string }) {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, {
    status: "idle",
  });
  const [typed, setTyped] = useState("");
  const [ack, setAck] = useState(false);
  const ready = typed === handle && ack;

  return (
    <form action={action} className="stack" aria-describedby="delete-what">
      <p id="delete-what" className="muted">
        This permanently deletes your adventurer, all learning progress, XP, quests, achievements,
        keepsakes and leaderboard entry, and your sign-in. It cannot be undone.
      </p>
      <div className="field">
        <label className="field__label" htmlFor="confirmHandle">
          Type your handle <strong className="mono-inline">{handle}</strong> to confirm
        </label>
        <input
          id="confirmHandle"
          name="confirmHandle"
          className="input"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>
      <label className="check">
        <input
          type="checkbox"
          name="acknowledge"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        <span>I understand this is permanent and cannot be undone.</span>
      </label>
      {state.status === "error" && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={18} /> {state.message}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn--danger" disabled={!ready || pending}>
          {pending ? "Deleting…" : "Delete my account"}
        </button>
      </div>
    </form>
  );
}
