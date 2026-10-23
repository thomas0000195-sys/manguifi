/**
 * Registre des modules de la console. Ajouter un module = ajouter une entrée
 * ici et un dossier de module. Les permissions sont déclarées par module ;
 * seul le rôle super_admin existe en V1.
 */

export type ConsoleRole = "SUPER_ADMIN";

export type ConsoleModule = {
  key: string;
  label: string;
  href: string;
  /** Étape de construction où le module est livré (null = pas encore prévu). */
  step: number | null;
  roles: ConsoleRole[];
};

export const CONSOLE_MODULES: ConsoleModule[] = [
  { key: "dashboard", label: "Tableau de bord", href: "/console", step: 4, roles: ["SUPER_ADMIN"] },
  { key: "companies", label: "Entreprises", href: "/console/entreprises", step: 5, roles: ["SUPER_ADMIN"] },
  { key: "users", label: "Utilisateurs", href: "/console/utilisateurs", step: 6, roles: ["SUPER_ADMIN"] },
  { key: "errors", label: "Erreurs", href: "/console/erreurs", step: 3, roles: ["SUPER_ADMIN"] },
  { key: "audit", label: "Audit", href: "/console/audit", step: 2, roles: ["SUPER_ADMIN"] },
  { key: "health", label: "Santé", href: "/console/sante", step: 7, roles: ["SUPER_ADMIN"] },
];

export function modulesFor(role: ConsoleRole): ConsoleModule[] {
  return CONSOLE_MODULES.filter((m) => m.roles.includes(role));
}
