import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 : le client se connecte via l'adaptateur pg. L'URL vient de
 * DATABASE_URL (lue à la création du client, pas à l'import du module).
 */
export function createPrismaClient(log: ("error" | "warn")[] = ["error"]) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter, log });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient(process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
