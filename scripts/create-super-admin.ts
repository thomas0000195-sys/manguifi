/**
 * Crée le premier super admin de la console. Seul moyen de créer ce rôle :
 * aucune interface ni API ne peut l'attribuer.
 *
 * Usage : node --env-file=.env --import tsx scripts/create-super-admin.ts <email>
 *
 * Ne s'applique jamais à un compte existant : un utilisateur déjà présent
 * n'est pas promu, pour éviter toute élévation silencieuse.
 */
import { prisma } from "../src/lib/prisma";
import { encryptDataUrl, hashEmail } from "../src/lib/crypto";

const PLATFORM_ORG_NAME = "Manguifi (plateforme)";

async function main() {
  const email = String(process.argv[2] ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    console.error("Usage : create-super-admin.ts <email>");
    process.exit(1);
  }

  const emailHash = hashEmail(email);
  const existing = await prisma.user.findUnique({ where: { emailHash } });
  if (existing) {
    console.error(existing.role === "SUPER_ADMIN"
      ? "Ce compte est déjà super admin."
      : "Un compte existe déjà avec cette adresse : il ne sera pas promu.");
    process.exit(1);
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

  console.log("Super admin créé. Connexion : /console/connexion (code e-mail puis TOTP).");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Échec :", err instanceof Error ? err.name : "erreur");
  await prisma.$disconnect();
  process.exit(1);
});
