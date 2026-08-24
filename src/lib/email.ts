import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "Manguifi <onboarding@resend.dev>";

function getAppUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

function getResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/**
 * Sends the password-reset email via Resend. Returns false (without
 * throwing) if RESEND_API_KEY isn't configured or the send fails — callers
 * must treat that as "email not delivered" and act accordingly (in dev we
 * fall back to showing the link on-screen; in production we must not).
 */
export async function sendPasswordResetEmail(to: string, rawToken: string) {
  const resend = getResendClient();
  if (!resend) return false;

  const resetUrl = `${getAppUrl()}/reinitialiser-mot-de-passe?token=${rawToken}`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: "Réinitialisez votre mot de passe Manguifi",
      html: `
        <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0b1324;">
          <div style="background: #0b1a36; padding: 20px 24px; border-radius: 14px 14px 0 0;">
            <span style="color: #fff; font-weight: 700; font-size: 17px;">Manguifi</span>
          </div>
          <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 14px 14px; padding: 28px 24px;">
            <h1 style="font-size: 18px; margin: 0 0 12px;">Réinitialisation de mot de passe</h1>
            <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px;">
              Une demande de réinitialisation de mot de passe a été effectuée pour votre compte Manguifi.
              Si vous êtes à l'origine de cette demande, cliquez sur le bouton ci-dessous. Ce lien expire dans 30 minutes.
            </p>
            <a href="${resetUrl}" style="display: inline-block; background: #0b1a36; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 22px; border-radius: 10px;">
              Réinitialiser mon mot de passe
            </a>
            <p style="font-size: 12.5px; color: #64748b; margin-top: 24px;">
              Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe restera inchangé.
            </p>
          </div>
        </div>
      `,
    });
    if (error) {
      console.error("Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    return false;
  }
}
