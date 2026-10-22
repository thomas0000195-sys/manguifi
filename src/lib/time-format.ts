/**
 * Formatage de durées, sans dépendance serveur. Séparé de attendance-logic.ts
 * (qui importe Prisma) pour pouvoir être utilisé dans les composants client.
 */
export function minutesToLabel(mins: number) {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? "-" : "";
  return `${sign}${h}h${m.toString().padStart(2, "0")}`;
}
