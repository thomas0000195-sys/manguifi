import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

const SESSION_COOKIE = "manguifi_session";
const secretKey = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "manguifi-dev-secret-change-in-production-please-1234567890"
);

export type SessionPayload = {
  userId: string;
  orgId: string;
  role: Role;
  email: string | null;
  employeeId: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey);

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
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
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
