import twilio from "twilio";

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export type SendOtpResult = { sent: true } | { sent: false; error: string };

/**
 * Sends an OTP over SMS via Twilio Verify. Requires a configured Verify Service;
 * on Twilio trial accounts, only phone numbers verified in the Twilio console can receive messages.
 */
export async function sendOtp(phoneE164: string): Promise<SendOtpResult> {
  const client = getClient();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!client || !serviceSid) {
    return { sent: false, error: "L'envoi de code par SMS n'est pas configuré." };
  }

  try {
    await client.verify.v2.services(serviceSid).verifications.create({
      to: phoneE164,
      channel: "sms",
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("Twilio sendOtp error:", message);
    return { sent: false, error: "Impossible d'envoyer le code pour le moment. Réessayez dans un instant." };
  }
}

export type CheckOtpResult = { approved: true } | { approved: false; error: string };

export async function checkOtp(phoneE164: string, code: string): Promise<CheckOtpResult> {
  const client = getClient();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!client || !serviceSid) {
    return { approved: false, error: "Vérification indisponible pour le moment." };
  }

  try {
    const check = await client.verify.v2.services(serviceSid).verificationChecks.create({
      to: phoneE164,
      code,
    });
    if (check.status === "approved") return { approved: true };
    return { approved: false, error: "Code invalide ou expiré." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("Twilio checkOtp error:", message);
    return { approved: false, error: "Code invalide ou expiré." };
  }
}
