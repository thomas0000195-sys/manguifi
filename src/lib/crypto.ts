import crypto from "node:crypto";

const PREFIX = "enc:v1:";

function getKey() {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.AUTH_SECRET ?? "manguifi-dev-fallback-key";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a string (typically a base64 data: URL — photos, justificatif
 * documents) at rest with AES-256-GCM. Returns a self-describing string
 * that decryptDataUrl() can reverse; anything not carrying our prefix is
 * passed through untouched so already-seeded/demo data keeps working.
 */
export function encryptDataUrl(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return (
    PREFIX +
    iv.toString("base64") +
    ":" +
    authTag.toString("base64") +
    ":" +
    ciphertext.toString("base64")
  );
}

export function decryptDataUrl(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  try {
    const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(dataB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return stored;
  }
}

/**
 * Deterministic HMAC-SHA256 of an email address — same rationale as
 * hashPhone (lib/phone.ts): User.email is encrypted at rest, so exact-match
 * login lookups go through this hash instead of the ciphertext column.
 */
export function hashEmail(email: string): string {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.AUTH_SECRET ?? "manguifi-dev-fallback-key";
  return crypto.createHmac("sha256", secret).update(email).digest("hex");
}
