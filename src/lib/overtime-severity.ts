/**
 * The spec distinguishes a mild overtime overrun (30min–1h — worth noting,
 * no urgency) from something that needs the responsable's attention right
 * away: a single big overrun, or a pattern of overruns on consecutive
 * days. This classifies one pending overtime record given how many other
 * NON_PLANIFIEE records the same employee has racked up recently.
 */
export type OvertimeSeverity = "modere" | "important" | "repete";

export function classifyOvertimeSeverity(
  overtimeMinutes: number,
  recentPendingCountForEmployee: number
): OvertimeSeverity {
  if (recentPendingCountForEmployee >= 3) return "repete";
  if (overtimeMinutes > 60) return "important";
  return "modere";
}

export const OVERTIME_SEVERITY_LABEL: Record<OvertimeSeverity, string> = {
  modere: "Modéré",
  important: "Important",
  repete: "Répété",
};
