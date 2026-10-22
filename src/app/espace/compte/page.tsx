import { requireUser } from "@/lib/guard";
import { decryptDataUrlForDisplay } from "@/lib/crypto";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MyDataPanel from "./MyDataPanel";
import MyPhotoUpload from "./MyPhotoUpload";

export default async function MonComptePage() {
  const user = await requireUser(["EMPLOYEE"]);
  const phone = user.phone ? decryptDataUrlForDisplay(user.phone) : null;
  const email = user.email ? decryptDataUrlForDisplay(user.email) : null;

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <Link
        href="/espace"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-800 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <h1 className="mt-5 text-xl font-bold text-navy-950">Mon compte</h1>
      <p className="text-sm text-muted">
        Connecté avec {phone ?? email ?? "votre compte"}.
      </p>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-navy-950">Ma photo de profil</h2>
        <MyPhotoUpload
          currentPhotoUrl={user.employee?.photoUrl ? decryptDataUrlForDisplay(user.employee.photoUrl) : null}
          initials={`${user.employee?.firstName?.[0] ?? ""}${user.employee?.lastName?.[0] ?? ""}`.toUpperCase() || "?"}
        />
      </div>

      <MyDataPanel />
    </div>
  );
}
