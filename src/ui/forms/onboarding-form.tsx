"use client";
/**
 * Onboarding: a handle and a neutral age screen (DEC-010). The form does not reveal the
 * age threshold or pre-select an answer; the server decides and stores only the outcome.
 */
import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "@/app/actions/account";
import { Icon } from "../art/icons";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function OnboardingForm() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {
    status: "idle",
  });

  if (state.status === "too_young")
    return (
      <div className="stack" role="status">
        <h2>We can&apos;t create an account</h2>
        <p className="muted">
          Code Dungeon accounts are not available for you right now. No account was created and
          nothing you entered was saved.
        </p>
      </div>
    );

  return (
    <form action={action} className="stack">
      <div className="field">
        <label className="field__label" htmlFor="handle">
          Choose a handle
        </label>
        <input
          id="handle"
          name="handle"
          className="input"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z][A-Za-z0-9_\-]{2,19}"
          autoComplete="nickname"
          aria-describedby="handle-hint"
        />
        <span id="handle-hint" className="field__hint">
          3–20 letters, digits, _ or -, starting with a letter. This is the name others see;
          don&apos;t use your real name or email.
        </span>
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label">When were you born?</legend>
        <div className="row" style={{ alignItems: "stretch" }}>
          <div style={{ flex: "1 1 10rem" }}>
            <label className="sr-only" htmlFor="birthMonth">
              Birth month
            </label>
            <select id="birthMonth" name="birthMonth" className="select" required defaultValue="">
              <option value="" disabled>
                Month
              </option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 8rem" }}>
            <label className="sr-only" htmlFor="birthYear">
              Birth year
            </label>
            <input
              id="birthYear"
              name="birthYear"
              className="input"
              inputMode="numeric"
              pattern="[0-9]{4}"
              placeholder="Year (YYYY)"
              required
              autoComplete="off"
            />
          </div>
        </div>
        <span className="field__hint">Used once to check eligibility. It is not stored.</span>
      </fieldset>

      <label className="check">
        <input type="checkbox" name="visible" />
        <span>
          Show my handle and XP on the leaderboard
          <span className="field__hint" style={{ display: "block" }}>
            Off by default. You can change it later in your profile.
          </span>
        </span>
      </label>

      {state.status === "error" && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={18} /> {state.message}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending}>
        {pending ? "Creating…" : "Begin the expedition"}
      </button>
    </form>
  );
}
