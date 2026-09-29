import { Vonage } from "@vonage/server-sdk";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

export type SendSmsOtpResult = { sent: true } | { sent: false; error: string };

/**
 * Generate and send 6-digit OTP via SMS
 */
export async function sendSmsOtp(phoneE164: string): Promise<SendSmsOtpResult> {
  const apiKey = process.env.VONAGE_API_KEY;
  const apiSecret = process.env.VONAGE_API_SECRET;

  if (!apiKey || !apiSecret) {
    return {
      sent: false,
      error: "SMS OTP n'est pas configuré. Contactez l'administrateur.",
    };
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // Store the OTP in database
    await prisma.oTPCode.deleteMany({
      where: { employeeId: phoneE164, type: "SMS" }, // Using phoneE164 as temp ID
    });

    // Send via Vonage SMS
    const response = await vonage.sms.send({
      to: phoneE164,
      from: "Manguifi",
      text: `Votre code de vérification Manguifi est: ${code}. Valide 10 minutes.`,
    });

    if (response.messages[0]["status"] !== "0") {
      console.error("Vonage SMS error:", response.messages[0]);
      return {
        sent: false,
        error: "Impossible d'envoyer le SMS pour le moment.",
      };
    }

    // Store OTP for verification (using phone as temp identifier)
    await prisma.oTPCode.create({
      data: {
        employeeId: phoneE164, // Temp: will be replaced with actual employeeId on verify
        code,
        type: "SMS",
        expiresAt,
      },
    });

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("SMS OTP error:", message);
    return {
      sent: false,
      error: "Impossible d'envoyer le SMS pour le moment.",
    };
  }
}

export type CheckSmsOtpResult = { valid: true } | { valid: false; error: string };

/**
 * Verify SMS OTP code
 */
export async function checkSmsOtp(
  phoneE164: string,
  code: string
): Promise<CheckSmsOtpResult> {
  try {
    const otpRecord = await prisma.oTPCode.findFirst({
      where: {
        employeeId: phoneE164,
        code,
        type: "SMS",
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      return { valid: false, error: "Code invalide ou expiré." };
    }

    // Delete the used code
    await prisma.oTPCode.delete({ where: { id: otpRecord.id } });

    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("SMS OTP verification error:", message);
    return { valid: false, error: "Code invalide ou expiré." };
  }
}
