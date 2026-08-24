import { requireUser } from "@/lib/guard";
import { decryptDataUrl } from "@/lib/crypto";
import ScannerClient from "@/components/ScannerClient";
import { redirect } from "next/navigation";

export default async function ScannerPage() {
  const user = await requireUser(["EMPLOYEE"]);
  if (!user.employee) redirect("/espace");

  return (
    <ScannerClient
      photoOnPunchEnabled={user.org.photoOnPunchEnabled}
      hapticEnabled={user.org.hapticFeedbackEnabled}
      employeeName={`${user.employee.firstName} ${user.employee.lastName}`}
      employeePhotoUrl={user.employee.photoUrl ? decryptDataUrl(user.employee.photoUrl) : null}
      employeePosition={user.employee.position}
      backHref="/espace"
    />
  );
}
