import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/ui/art/icons";
import { PublicHeader } from "@/ui/public-header";

export const metadata: Metadata = { title: "Account deleted" };

export default function AccountDeletedPage() {
  return (
    <>
      <PublicHeader />
      <main id="main" className="auth">
        <div className="auth__card frame stack" role="status">
          <Icon name="check" size={32} />
          <h1 style={{ fontSize: "var(--text-2xl)" }}>Your account was deleted</h1>
          <p className="muted">
            Your adventurer, progress, rewards and leaderboard entry have been removed, and you have
            been signed out on this device.
          </p>
          <Link className="btn" href="/">
            Return to the gate
          </Link>
        </div>
      </main>
    </>
  );
}
