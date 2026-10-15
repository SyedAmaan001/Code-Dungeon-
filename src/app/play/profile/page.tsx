import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { getSession, requirePlayer } from "@/auth/server";
import { Icon } from "@/ui/art/icons";
import { ProfileForm } from "@/ui/forms/profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const player = await requirePlayer();
  const session = await getSession();
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

      <section className="frame stack" aria-labelledby="data-title">
        <h2 id="data-title">Your data</h2>
        <p className="muted">
          Code Dungeon keeps your handle, leaderboard choice, learning progress, XP, quests,
          achievements and the date you confirmed you are 13 or older. Your email address stays with
          the sign-in provider and is not stored in the game database. Your birth month and year
          were not stored.
        </p>
        <p className="muted">Signed in with: {signInLabel}.</p>
        <p className="notice-box">
          <Icon name="info" size={18} />
          Self-service account deletion is not available in this development build yet.
        </p>
        <form action={signOut}>
          <button type="submit" className="btn">
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
