/** Affichage masqué des données personnelles dans la console. */

/** t***@d***.com : première lettre, domaine partiel. */
export function maskEmailAddress(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "—";
  const [local, domain] = email.split("@");
  const dot = domain.lastIndexOf(".");
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local[0] ?? ""}***@${domainName[0] ?? ""}***${tld}`;
}

/** Valeur CSV sûre : échappe les guillemets, protège contre les formules d'Excel. */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.split('"').join('""')}"`;
}
