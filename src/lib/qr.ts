import QRCode from "qrcode";

const SITE_PREFIX = "MANGUIFI_SITE:";

export function siteQrPayload(token: string) {
  return `${SITE_PREFIX}${token}`;
}

export function parseSiteQrPayload(scanned: string): string | null {
  if (!scanned.startsWith(SITE_PREFIX)) return null;
  return scanned.slice(SITE_PREFIX.length);
}

export async function generateSiteQrDataUrl(token: string) {
  return QRCode.toDataURL(siteQrPayload(token), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 400,
    color: { dark: "#0b1a36", light: "#ffffff" },
  });
}
