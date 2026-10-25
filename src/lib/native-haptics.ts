import { detectNativeContext } from "@/lib/native-context";

/**
 * Retour haptique natif (iPhone via Capacitor). Sur le web, le comportement reste celui de
 * navigator.vibrate, géré par l'appelant. Aucune erreur ne remonte à l'utilisateur.
 */
export async function nativeHaptic(kind: "success" | "error"): Promise<void> {
  if (!detectNativeContext().isCapacitor) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({
      type: kind === "success" ? NotificationType.Success : NotificationType.Error,
    });
  } catch {
    // Plugin indisponible sur cet appareil : on ignore sans bloquer le pointage.
  }
}
