import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/server";
import { OnboardingForm } from "@/ui/forms/onboarding-form";
import { PublicHeader } from "@/ui/public-header";

export const metadata: Metadata = { title: "Create your adventurer" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (session.state === "player") redirect("/play");
  if (session.state !== "needs_onboarding") redirect("/sign-in");

  return (
    <>
      <PublicHeader />
      <main id="main" className="auth">
        <div className="auth__card frame frame--ornate stack">
          <div className="stack-s">
            <p className="eyebrow">Before you begin</p>
            <h1 style={{ fontSize: "var(--text-2xl)" }}>Create your adventurer</h1>
            <p className="muted">Two quick questions, then the gate opens.</p>
          </div>
          <OnboardingForm />
        </div>
      </main>
    </>
  );
}
