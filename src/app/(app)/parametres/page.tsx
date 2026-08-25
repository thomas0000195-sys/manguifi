import { requireUser } from "@/lib/guard";
import { decryptDataUrl } from "@/lib/crypto";
import ParametresClient from "./ParametresClient";

export default async function ParametresPage() {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);

  return (
    <ParametresClient
      role={user.role as "ADMIN" | "RESPONSABLE"}
      phone={user.phone ? decryptDataUrl(user.phone) : null}
      org={{
        name: user.org.name,
        photoOnPunchEnabled: user.org.photoOnPunchEnabled,
        hapticFeedbackEnabled: user.org.hapticFeedbackEnabled,
        allowedTimeWindowEnabled: user.org.allowedTimeWindowEnabled,
        allowedTimeWindowStart: user.org.allowedTimeWindowStart,
        allowedTimeWindowEnd: user.org.allowedTimeWindowEnd,
        justificationDelayDays: user.org.justificationDelayDays,
        matriculePrefix: user.org.matriculePrefix,
        idNumberEnabled: user.org.idNumberEnabled,
        attendanceRetentionMonths: user.org.attendanceRetentionMonths,
      }}
    />
  );
}
