import { requireUser } from "@/lib/guard";
import { decryptDataUrl } from "@/lib/crypto";
import OnboardingWizard from "./OnboardingWizard";
import { QrCode } from "lucide-react";
import Link from "next/link";

export default async function OnboardingPage() {
  const user = await requireUser(["ADMIN"]);
  const email = user.email ? decryptDataUrl(user.email) : "";

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-5 py-12">
      <Link href="/" className="mb-2 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-white">
          <QrCode className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-navy-900">
          Manguifi
        </span>
      </Link>
      <p className="mb-8 text-sm text-muted">
        Bienvenue, {email} — configurons {user.org.name}
      </p>
      <OnboardingWizard />
    </div>
  );
}
