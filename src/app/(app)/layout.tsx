import { requireUser } from "@/lib/guard";
import { decryptDataUrlForDisplay } from "@/lib/crypto";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import ThemeApplier from "@/components/ThemeApplier";
import NotificationBell from "@/components/NotificationBell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  if (!user.org.onboardingCompleted && user.role === "ADMIN") {
    redirect("/onboarding");
  }

  return (
    <>
    <ThemeApplier />
    <AppShell
      orgName={user.org.name}
      userEmail={user.email ? decryptDataUrlForDisplay(user.email) : null}
      role={user.role}
      isDemo={user.org.isDemo}
      termsAccepted={user.termsVersion === CURRENT_TERMS_VERSION}
      bell={<NotificationBell userId={user.id} href="/notifications" />}
    >
      {children}
    </AppShell>
    </>
  );
}
