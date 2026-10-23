import { getConsoleUser } from "@/lib/console/session";

/**
 * Contrôle serveur à utiliser dans chaque action et chaque route de la console.
 * Ne jamais se fier à l'interface : cette vérification est refaite à chaque appel.
 */
export async function requireConsoleUser() {
  const user = await getConsoleUser();
  if (!user) throw new Error("FORBIDDEN");
  return user;
}
