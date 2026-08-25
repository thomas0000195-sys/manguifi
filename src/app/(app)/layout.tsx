import { requireUser } from "@/lib/guard";
import { decryptDataUrl } from "@/lib/crypto";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  if (!user.org.onboardingCompleted && user.role === "ADMIN") {
    redirect("/onboarding");
  }

  return (
    <AppShell
      orgName={user.org.name}
      userEmail={user.email ? decryptDataUrl(user.email) : null}
      role={user.role}
      isDemo={user.org.isDemo}
    >
      {children}
    </AppShell>
  );
}
