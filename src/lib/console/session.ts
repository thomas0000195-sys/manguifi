import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuthSecret } from "@/lib/secrets";

/**
 * Session de la console super admin, séparée des sessions de l'application :
 * cookie propre, durée courte, et rôle vérifié en base à chaque accès.
 */

const CONSOLE_COOKIE = "manguifi_console";
const PRE_AUTH_COOKIE = "manguifi_console_pre";
const SESSION_MINUTES = 30;
const PRE_AUTH_MINUTES = 5;
const AUDIENCE_SESSION = "console";
const AUDIENCE_PRE_AUTH = "console-pre";

function key() {
  return new TextEncoder().encode(getAuthSecret());
}

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/console",
};

/** Étape intermédiaire : code e-mail validé, TOTP attendu. Expire vite. */
export async function setPreAuth(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE_PRE_AUTH)
    .setIssuedAt()
    .setExpirationTime(`${PRE_AUTH_MINUTES}m`)
    .sign(key());
  const store = await cookies();
  store.set(PRE_AUTH_COOKIE, token, { ...cookieBase, maxAge: PRE_AUTH_MINUTES * 60 });
}

export async function readPreAuth(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(PRE_AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: AUDIENCE_PRE_AUTH });
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

export async function clearPreAuth() {
  const store = await cookies();
  store.delete(PRE_AUTH_COOKIE);
}

/** Ouvre la session console après OTP et TOTP valides. */
export async function setConsoleSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE_SESSION)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MINUTES}m`)
    .sign(key());
  const store = await cookies();
  store.set(CONSOLE_COOKIE, token, { ...cookieBase, maxAge: SESSION_MINUTES * 60 });
}

export async function clearConsoleSession() {
  const store = await cookies();
  store.delete(CONSOLE_COOKIE);
}

/**
 * Renvoie l'utilisateur super admin de la session, ou null. Le rôle et l'état
 * du second facteur sont relus en base : un rôle retiré coupe l'accès
 * immédiatement, même avec un cookie encore valide.
 */
export async function getConsoleUser() {
  const store = await cookies();
  const token = store.get(CONSOLE_COOKIE)?.value;
  if (!token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: AUDIENCE_SESSION });
    if (typeof payload.userId !== "string") return null;
    userId = payload.userId;
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "SUPER_ADMIN" || !user.totpEnabledAt) return null;
  return user;
}
