import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { getSession, requirePlayer } from "@/auth/server";
import { currentTheme } from "@/ui/current-theme";
import { DeleteAccountForm } from "@/ui/forms/delete-account-form";
import { ProfileForm } from "@/ui/forms/profile-form";
import { ThemeSwitcher } from "@/ui/forms/theme-switcher";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const player = await requirePlayer();
  const [session, theme] = await Promise.all([getSession(), currentTheme()]);
  const signInLabel =
    session.config.mode === "supabase"
      ? "Supabase Auth (Google or email link)"
      : session.config.mode === "dev"
        ? "Development sign-in (local only)"
        : "Not configured";

  return (
    <div className="stack-l" style={{ maxWidth: "44rem" }}>
      <header className="stack-s">
        <p className="eyebrow">Adventurer</p>
        <h1>{player.handle}</h1>
      </header>

      <section className="frame frame--ornate stack" aria-labelledby="profile-title">
        <h2 id="profile-title">Public profile</h2>
        <ProfileForm handle={player.handle} visible={player.visible} />
      </section>

      <section className="frame stack" aria-labelledby="appearance-title">
        <h2 id="appearance-title">Appearance</h2>
        <p className="muted">
          Onyx is a preview of a new look. Your choice is saved in this browser only and changes
          nothing about your progress.
        </p>
        <ThemeSwitcher current={theme} />
      </section>

      <section className="frame stack" aria-labelledby="data-title">
        <h2 id="data-title">Your data</h2>
        <p className="muted">
          Code Dungeon keeps your handle, leaderboard choice, learning progress, XP, quests,
          achievements and the date you confirmed you are 13 or older. Your email address stays with
          the sign-in provider and is not stored in the game database. Your birth month and year
          were not stored.
        </p>
        <p className="muted">Signed in with: {signInLabel}.</p>
        <form action={signOut}>
          <button type="submit" className="btn">
            Sign out
          </button>
        </form>
      </section>

      <section className="frame stack danger-zone" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete account</h2>
        <DeleteAccountForm handle={player.handle} />
      </section>
    </div>
  );
}
