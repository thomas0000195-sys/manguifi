"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { manualDepartureAction } from "@/app/actions/attendance";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

export default function ManualDepartureButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      let position: GeolocationPosition;
      try {
        position = await getPosition();
      } catch {
        toast.error(
          "Impossible d'obtenir votre position. Activez la localisation pour confirmer votre sortie."
        );
        return;
      }

      const res = await manualDepartureAction({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Départ confirmé à ${res.time}`);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3 text-sm font-semibold text-navy-900 transition hover:bg-navy-50 disabled:opacity-70"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Confirmer manuellement ma sortie
    </button>
  );
}
