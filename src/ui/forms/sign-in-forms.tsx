"use client";
import { useActionState } from "react";
import { devSignIn, sendMagicLink, type AuthFormState } from "@/app/actions/auth";
import { Icon } from "../art/icons";

export function MagicLinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(sendMagicLink, {
    status: "idle",
  });
  if (state.status === "sent")
    return (
      <div className="notice-box" role="status">
        <Icon name="check" size={18} />
        <span>
          If that address can receive email, a sign-in link is on its way. Open it on this device.
          The link works once.
        </span>
      </div>
    );
  return (
    <form action={action} className="stack-s">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label className="field__label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          required
          maxLength={254}
        />
      </div>
      {state.status === "error" && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={18} /> {state.message}
        </p>
      )}
      <button type="submit" className="btn btn--block" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}

export function DevSignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(devSignIn, {
    status: "idle",
  });
  return (
    <form action={action} className="stack-s">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label className="field__label" htmlFor="dev-name">
          Development identity
        </label>
        <input
          id="dev-name"
          name="name"
          className="input"
          required
          autoComplete="off"
          aria-describedby="dev-name-hint"
          placeholder="e.g. alice"
        />
        <span id="dev-name-hint" className="field__hint">
          Local testing only: any name signs in as that test identity. Disabled in production
          builds.
        </span>
      </div>
      {state.status === "error" && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={18} /> {state.message}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
        {pending ? "Signing in…" : "Sign in (development)"}
      </button>
    </form>
  );
}
