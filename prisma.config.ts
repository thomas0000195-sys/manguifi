import { defineConfig } from "prisma/config";

// Le CLI Prisma 7 ne charge pas .env seul ; en CI et sur Vercel les variables
// sont déjà dans l'environnement, d'où le try.
try {
  process.loadEnvFile(".env");
} catch {
  // pas de fichier .env (CI, Vercel, Docker) : on garde l'environnement courant
}

// Prisma 7 : l'URL de connexion ne figure plus dans schema.prisma. Elle est
// lue ici pour le CLI (migrate, db push) ; le client l'utilise via l'adaptateur
// pg (src/lib/prisma.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --env-file-if-exists=.env --import tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
