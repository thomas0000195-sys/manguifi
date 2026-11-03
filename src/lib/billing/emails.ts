import { Resend } from "resend";
import { escapeHtml, isPlausibleEmail } from "@/lib/email";

const FROM = process.env.EMAIL_FROM ?? "Manguifi <onboarding@resend.dev>";

function getResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function formatXof(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

/**
 * Email « Paiement reçu » pour l'admin payeur. Pas de promesse de reçu fiscal :
 * les informations de l'émetteur (lot 10.4) ne sont pas encore renseignées.
 * Retourne false sans lever d'erreur si l'envoi n'a pas pu avoir lieu.
 */
export async function sendPaymentReceivedEmail(
  to: string,
  details: { invoiceNumber: string; amountXof: number; paidAt: Date; reference: string; isTest: boolean }
): Promise<boolean> {
  if (!isPlausibleEmail(to)) return false;
  const resend = getResendClient();
  if (!resend) return false;

  const testBanner = details.isTest
    ? `<p style="background:#fef3c7;color:#92400e;padding:8px 12px;border-radius:8px;font-size:13px;">MODE TEST : ce paiement n'est pas un encaissement réel.</p>`
    : "";

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `${details.isTest ? "[TEST] " : ""}Paiement reçu — facture ${details.invoiceNumber}`,
      html: `
        <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0b1324;">
          <h1 style="font-size: 18px;">Paiement reçu</h1>
          ${testBanner}
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            Nous avons bien reçu votre paiement de <strong>${escapeHtml(formatXof(details.amountXof))}</strong>
            pour la facture <strong>${escapeHtml(details.invoiceNumber)}</strong>.
          </p>
          <p style="font-size: 13px; color: #475569;">
            Date : ${escapeHtml(details.paidAt.toLocaleDateString("fr-FR"))}<br />
            Référence : ${escapeHtml(details.reference)}
          </p>
        </div>`,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Alerte interne (écart de montant, paiement non rapproché). Destinataire : BILLING_ALERT_EMAIL. */
export async function sendBillingAlertEmail(subject: string, lines: string[]): Promise<boolean> {
  const to = process.env.BILLING_ALERT_EMAIL?.trim();
  if (!to || !isPlausibleEmail(to)) return false;
  const resend = getResendClient();
  if (!resend) return false;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `[Manguifi] ${subject}`.slice(0, 200),
      html: `<div style="font-family: Arial, sans-serif; font-size: 14px;">${lines
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join("")}</div>`,
    });
    return !error;
  } catch {
    return false;
  }
}
