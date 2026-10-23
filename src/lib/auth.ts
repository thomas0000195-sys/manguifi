import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";
import { getAuthSecret } from "./secrets";

const SESSION_COOKIE = "manguifi_session";

function getSecretKey() {
  return new TextEncoder().encode(getAuthSecret());
}

export type SessionPayload = {
  userId: string;
  orgId: string;
  role: Role;
  email: string | null;
  employeeId: string | null;
  /** Empreinte des identifiants au moment de la connexion (voir credentialFingerprint). */
  cv: string;
};

/**
 * Empreinte du mot de passe, embarquée dans la session. Une réinitialisation
 * du mot de passe modifie le hash, donc invalide toutes les sessions émises
 * avant. Pas de colonne dédiée : aucune migration nécessaire.
 */
function credentialFingerprint(passwordHash: string | null): string {
  return crypto
    .createHash("sha256")
    .update(passwordHash ?? "no-password")
    .digest("hex")
    .slice(0, 32);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: Omit<SessionPayload, "cv">) {
  const account = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { passwordHash: true },
  });
  if (!account) throw new Error("Compte introuvable.");

  const token = await new SignJWT({
    ...payload,
    cv: credentialFingerprint(account.passwordHash),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Hors du try : une configuration sans secret doit échouer bruyamment, pas
  // être traitée comme une session invalide.
  const key = getSecretKey();
  let session: SessionPayload;
  try {
    const { payload } = await jwtVerify(token, key);
    session = payload as unknown as SessionPayload;
  } catch {
    return null;
  }

  // La signature ne suffit pas : le compte doit encore exister, avec les mêmes
  // identifiants, et un employé doit être ACTIF. Vérifié à chaque accès pour
  // que la désactivation ou la réinitialisation prennent effet immédiatement,
  // y compris pour les actions serveur qui n'appellent que requireSession().
  const account = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      passwordHash: true,
      blockedAt: true,
      employee: { select: { status: true } },
      org: { select: { suspendedAt: true } },
    },
  });
  if (!account) return null;
  // Console V1 : compte bloqué ou entreprise suspendue = aucune session utilisable.
  if (account.blockedAt || account.org?.suspendedAt) return null;
  if (!session.cv || session.cv !== credentialFingerprint(account.passwordHash)) return null;
  if (account.employee && account.employee.status !== "ACTIF") return null;
  if (session.role === "EMPLOYEE" && !account.employee) return null;

  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a password-reset token for a user. Returns the raw (unhashed)
 * token — only the SHA-256 hash is persisted, so this return value is the
 * only chance to obtain it. Any previous unused tokens for this user are
 * invalidated first so only the latest link works.
 */
export async function createPasswordResetToken(userId: string) {
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  return rawToken;
}

export async function consumePasswordResetToken(rawToken: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });
  if (!record) return { error: "Lien invalide." as const };
  if (record.usedAt) return { error: "Ce lien a déjà été utilisé." as const };
  if (record.expiresAt < new Date()) return { error: "Ce lien a expiré." as const };

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return { user: record.user };
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      org: true,
      employee: true,
      responsableTeams: { include: { team: true } },
    },
  });
  return user;
}
