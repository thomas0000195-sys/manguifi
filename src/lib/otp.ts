import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import crypto from "node:crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Generate a 6-digit OTP code and store it for verification
 */
export async function generateAndSendOtpEmail(
  email: string,
  employeeId: string
): Promise<{ sent: boolean; error?: string }> {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // Store the OTP in database
    await prisma.oTPCode.deleteMany({
      where: { employeeId, type: "EMAIL" },
    });

    await prisma.oTPCode.create({
      data: {
        employeeId,
        code,
        type: "EMAIL",
        expiresAt,
      },
    });

    // Send via Resend
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Manguifi <onboarding@resend.dev>",
      to: email,
      subject: "Votre code de vérification Manguifi",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>Vérification Manguifi</h2>
          <p>Votre code de vérification est :</p>
          <h1 style="font-size: 2em; letter-spacing: 5px; text-align: center;">${code}</h1>
          <p style="color: #666;">Ce code expire dans 10 minutes.</p>
          <p style="color: #999; font-size: 0.9em;">Si vous n'avez pas demandé ce code, ignorez ce message.</p>
        </div>
      `,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return { sent: false, error: "Impossible d'envoyer le code pour le moment." };
    }

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("OTP generation error:", message);
    return { sent: false, error: "Impossible d'envoyer le code pour le moment." };
  }
}

/**
 * Verify an OTP code
 */
export async function verifyOtpCode(
  employeeId: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const otpRecord = await prisma.oTPCode.findFirst({
      where: {
        employeeId,
        code,
        type: "EMAIL",
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
    console.error("OTP verification error:", message);
    return { valid: false, error: "Code invalide ou expiré." };
  }
}
