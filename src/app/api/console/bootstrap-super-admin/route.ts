/**
 * Route TEMPORAIRE : crée le premier super admin depuis l'environnement de
 * production (la vraie ENCRYPTION_KEY de Vercel, que le poste local ne possède pas).
 *
 * Protégée par BOOTSTRAP_SECRET (comparaison à temps constant). Sans ce secret
 * configuré, la route répond 404. À supprimer dès que le compte est créé.
 */
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptDataUrl, hashEmail } from "@/lib/crypto";

const PLATFORM_ORG_NAME = "Manguifi (plateforme)";

function secretMatches(provided: string | null): boolean {
  const expected = process.env.BOOTSTRAP_SECRET;
  if (!expected || !provided) return false;
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!process.env.BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!secretMatches(request.headers.get("x-bootstrap-secret"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email.includes("@")) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const emailHash = hashEmail(email);
  const existing = await prisma.user.findUnique({ where: { emailHash } });
  if (existing) {
    return NextResponse.json(
      { error: existing.role === "SUPER_ADMIN" ? "already_super_admin" : "account_exists" },
      { status: 409 }
    );
  }

  const org =
    (await prisma.organization.findFirst({ where: { name: PLATFORM_ORG_NAME } })) ??
    (await prisma.organization.create({ data: { name: PLATFORM_ORG_NAME } }));

  await prisma.user.create({
    data: {
      orgId: org.id,
      role: "SUPER_ADMIN",
      email: encryptDataUrl(email),
      emailHash,
    },
  });

  return NextResponse.json({ ok: true });
}
