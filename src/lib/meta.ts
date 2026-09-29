import axios from "axios";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

export type SendMetaOtpResult = { sent: true } | { sent: false; error: string };

/**
 * Send OTP via WhatsApp or SMS using Meta API
 */
export async function sendMetaOtp(phoneE164: string): Promise<SendMetaOtpResult> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return {
      sent: false,
      error: "Meta WhatsApp n'est pas configuré. Contactez l'administrateur.",
    };
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // Store the OTP in database
    await prisma.oTPCode.deleteMany({
      where: { employeeId: phoneE164, type: "WHATSAPP" },
    });

    await prisma.oTPCode.create({
      data: {
        employeeId: phoneE164,
        code,
        type: "WHATSAPP",
        expiresAt,
      },
    });

    // Send via Meta WhatsApp API
    const response = await axios.post(
      `https://graph.instagram.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phoneE164,
        type: "text",
        text: {
          body: `Votre code de vérification Manguifi est: ${code}. Valide 10 minutes.`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data?.messages?.[0]?.id) {
      return { sent: true };
    }

    console.error("Meta WhatsApp error:", response.data);
    return {
      sent: false,
      error: "Impossible d'envoyer le message WhatsApp pour le moment.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("Meta OTP error:", message);
    return {
      sent: false,
      error: "Impossible d'envoyer le code pour le moment.",
    };
  }
}

export type CheckMetaOtpResult = { valid: true } | { valid: false; error: string };

/**
 * Verify Meta OTP code
 */
export async function checkMetaOtp(
  phoneE164: string,
  code: string
): Promise<CheckMetaOtpResult> {
  try {
    const otpRecord = await prisma.oTPCode.findFirst({
      where: {
        employeeId: phoneE164,
        code,
        type: "WHATSAPP",
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
    console.error("Meta OTP verification error:", message);
    return { valid: false, error: "Code invalide ou expiré." };
  }
}
