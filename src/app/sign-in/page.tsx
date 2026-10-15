import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/actions/auth";
import { safeNext } from "@/auth/redirect";
import { getSession } from "@/auth/server";
import { Icon } from "@/ui/art/icons";
import { DevSignInForm, MagicLinkForm } from "@/ui/forms/sign-in-forms";
import { PublicHeader } from "@/ui/public-header";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  unverified:
    "Your email address is not verified yet. Open the link in your email, then try again.",
  link: "That sign-in link is invalid or has expired. Ask for a new one.",
  google: "Google sign-in could not start. Try again, or use an email link.",
};

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const session = await getSession();
  if (session.state === "player") redirect(next);
  if (session.state === "needs_onboarding") redirect("/onboarding");
  const error = params.error ? ERRORS[params.error] : undefined;
  const { config } = session;

  return (
    <>
      <PublicHeader />
      <main id="main" className="auth">
        <div className="auth__card frame frame--ornate stack">
          <div className="stack-s">
            <p className="eyebrow">Enter the dungeon</p>
            <h1 style={{ fontSize: "var(--text-2xl)" }}>Sign in</h1>
            <p className="muted">Your progress, quests and rank are saved to your account.</p>
          </div>

          {(error || session.state === "email_unverified") && (
            <p className="form-error" role="alert">
              <Icon name="alert" size={18} /> {error ?? ERRORS.unverified}
            </p>
          )}

          {config.mode === "supabase" && (
            <>
              <form action={signInWithGoogle}>
                <input type="hidden" name="next" value={next} />
                <button type="submit" className="btn btn--primary btn--block btn--lg">
                  Continue with Google
                </button>
              </form>
              <p className="divider">or</p>
              <MagicLinkForm next={next} />
              <p className="dim" style={{ fontSize: "var(--text-s)" }}>
                No passwords. Accounts need a verified email address and are for players aged 13 and
                older.
              </p>
            </>
          )}

          {config.mode === "dev" && (
            <>
              <p className="notice-box">
                <Icon name="info" size={18} />
                Development mode: Supabase sign-in is not configured in this environment.
              </p>
              <DevSignInForm next={next} />
            </>
          )}

          {config.mode === "disabled" && (
            <div className="notice-box" role="status">
              <Icon name="lock" size={18} />
              <span>
                Sign-in is not available on this server.{" "}
                <span className="dim">{config.reason}</span>
              </span>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
