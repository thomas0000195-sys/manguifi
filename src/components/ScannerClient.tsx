"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { recordPunchAction, type PunchResult } from "@/app/actions/attendance";
import { getDeviceFingerprint } from "@/lib/device";
import { parseSiteQrPayload } from "@/lib/qr";
import { queuePunch, getQueuedPunches, removeQueuedPunch } from "@/lib/offline-queue";
import {
  CheckCircle2,
  AlertTriangle,
  Camera,
  ArrowLeft,
  RotateCcw,
  Loader2,
  MapPin,
  WifiOff,
} from "lucide-react";
import Link from "next/link";

type Phase =
  | "geo-request"
  | "geo-denied"
  | "idle"
  | "scanning"
  | "validating"
  | "result-ok"
  | "result-error"
  | "result-queued";

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    /* ignore */
  }
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
    });
  });
}

export default function ScannerClient({
  photoOnPunchEnabled,
  hapticEnabled,
  employeeName,
  employeePhotoUrl,
  employeePosition,
  backHref,
}: {
  photoOnPunchEnabled: boolean;
  hapticEnabled: boolean;
  employeeName: string;
  employeePhotoUrl: string | null;
  employeePosition: string | null;
  backHref: string;
}) {
  const [phase, setPhase] = useState<Phase>("geo-request");
  const [result, setResult] = useState<PunchResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const vibrateInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef<GeolocationPosition | null>(null);
  const videoElId = "manguifi-qr-reader";
  const processingRef = useRef(false);
  const router = useRouter();

  const stopLightVibration = useCallback(() => {
    if (vibrateInterval.current) {
      clearInterval(vibrateInterval.current);
      vibrateInterval.current = null;
    }
    navigator.vibrate?.(0);
  }, []);

  const stopScanner = useCallback(async () => {
    stopLightVibration();
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        /* already stopped */
      }
      scannerRef.current = null;
    }
  }, [stopLightVibration]);

  const capturePhoto = useCallback((): string | undefined => {
    if (!photoOnPunchEnabled) return undefined;
    try {
      const videoEl = document.querySelector<HTMLVideoElement>(`#${videoElId} video`);
      if (!videoEl) return undefined;
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 240 * (videoEl.videoHeight / videoEl.videoWidth || 1);
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.6);
    } catch {
      return undefined;
    }
  }, [photoOnPunchEnabled]);

  const flushQueue = useCallback(async () => {
    const queue = getQueuedPunches();
    setPendingCount(queue.length);
    for (const item of queue) {
      try {
        const res = await recordPunchAction(item);
        if (res.success || res.error) {
          // Either it went through, or the server gave a definitive reason
          // (duplicate, inactive, etc.) — either way, stop retrying it.
          removeQueuedPunch(item.id);
        }
      } catch {
        // Still offline / server unreachable — leave it queued.
        break;
      }
    }
    setPendingCount(getQueuedPunches().length);
    router.refresh();
  }, [router]);

  const requestGeolocation = useCallback(async () => {
    setGeoError(null);
    setPhase("geo-request");
    try {
      const pos = await getPosition();
      positionRef.current = pos;
      setPhase("idle");
    } catch {
      setPhase("geo-denied");
      setGeoError(
        "Localisation refusée ou indisponible. Le pointage nécessite d'activer la localisation pour confirmer que vous êtes bien sur place."
      );
    }
  }, []);

  const handleDecoded = useCallback(
    async (decodedText: string) => {
      if (processingRef.current) return;

      const siteToken = parseSiteQrPayload(decodedText);
      if (!siteToken) return; // not one of our site QR codes — keep scanning

      processingRef.current = true;
      setPhase("validating");

      if (hapticEnabled && navigator.vibrate) {
        navigator.vibrate([40, 60]);
        vibrateInterval.current = setInterval(() => navigator.vibrate?.([40, 90]), 150);
      }

      const photoDataUrl = capturePhoto();
      const position = positionRef.current;

      await stopScanner();
      stopLightVibration();

      if (!position) {
        setResult({ error: "Position introuvable. Relancez la géolocalisation." });
        setPhase("result-error");
        processingRef.current = false;
        return;
      }

      const payload = {
        siteToken,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        photoDataUrl,
        deviceFingerprint: getDeviceFingerprint(),
      };

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        queuePunch(payload);
        setPendingCount(getQueuedPunches().length);
        setPhase("result-queued");
        processingRef.current = false;
        return;
      }

      try {
        const res = await recordPunchAction(payload);

        if (res.error) {
          if (hapticEnabled) navigator.vibrate?.([120, 60, 120]);
          setResult(res);
          setPhase("result-error");
          processingRef.current = false;
          return;
        }

        if (hapticEnabled) navigator.vibrate?.(220);
        playBeep();
        setResult(res);
        setPhase("result-ok");
        processingRef.current = false;
        router.refresh();
      } catch {
        // Network dropped mid-request — queue it rather than lose the scan.
        queuePunch(payload);
        setPendingCount(getQueuedPunches().length);
        setPhase("result-queued");
        processingRef.current = false;
      }
    },
    [capturePhoto, hapticEnabled, stopLightVibration, stopScanner, router]
  );

  const startScanning = useCallback(async () => {
    setCameraError(null);
    setResult(null);
    setPhase("scanning");
    processingRef.current = false;

    const { Html5Qrcode } = await import("html5-qrcode");
    try {
      const scanner = new Html5Qrcode(videoElId, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          handleDecoded(decodedText);
        },
        () => {}
      );
    } catch {
      setCameraError(
        "Impossible d'accéder à la caméra. Vérifiez les autorisations de votre navigateur."
      );
      setPhase("idle");
    }
  }, [handleDecoded]);

  useEffect(() => {
    requestGeolocation();
    setPendingCount(getQueuedPunches().length);
    window.addEventListener("online", flushQueue);
    return () => window.removeEventListener("online", flushQueue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-navy-950 px-5 py-6 text-white">
      <div className="flex items-center justify-between">
        <Link href={backHref} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <span className="text-sm font-medium text-white/70">Scanner le site</span>
        <span className="w-14" />
      </div>

      {pendingCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-orange-500/15 px-3.5 py-2.5 text-xs text-orange-200">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          {pendingCount} pointage(s) en attente de connexion pour être synchronisé(s).
        </div>
      )}

      <div className="mt-6 flex flex-1 flex-col items-center justify-center">
        {phase === "geo-request" && (
          <div className="text-center animate-fade-in-up">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
            <p className="mt-5 max-w-xs text-sm text-white/70">
              Localisation en cours... la géolocalisation est nécessaire pour confirmer que vous êtes bien sur place.
            </p>
          </div>
        )}

        {phase === "geo-denied" && (
          <div className="text-center animate-fade-in-up">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-500/20">
              <MapPin className="h-10 w-10 text-red-300" />
            </div>
            <p className="mt-5 text-lg font-bold">Localisation requise</p>
            <p className="mt-2 max-w-xs text-sm text-white/70">{geoError}</p>
            <button
              onClick={requestGeolocation}
              className="mt-6 rounded-full bg-green-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-green-500/20 transition hover:bg-green-600 active:scale-95"
            >
              Réessayer
            </button>
          </div>
        )}

        {(phase === "idle" || cameraError) && phase !== "geo-denied" && (
          <div className="text-center animate-fade-in-up">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
              <Camera className="h-10 w-10 text-white" />
            </div>
            <p className="mt-5 max-w-xs text-sm text-white/70">
              Scannez le QR code affiché sur votre site pour enregistrer votre arrivée ou votre départ.
            </p>
            <p className="mt-1.5 flex items-center justify-center gap-1 text-xs text-green-300">
              <MapPin className="h-3 w-3" /> Position confirmée
            </p>
            {cameraError && <p className="mt-3 text-sm text-red-300">{cameraError}</p>}
            <button
              onClick={startScanning}
              className="mt-6 rounded-full bg-green-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-green-500/20 transition hover:bg-green-600 active:scale-95"
            >
              Ouvrir la caméra
            </button>
          </div>
        )}

        {(phase === "scanning" || phase === "validating") && (
          <div className="w-full animate-fade-in-up">
            <div
              id={videoElId}
              className="mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl border-2 border-white/20 bg-black"
            />
            <p className="mt-5 text-center text-sm text-white/70">
              {phase === "validating"
                ? "Validation du pointage en cours..."
                : "Alignez le QR code du site dans le cadre."}
            </p>
            {phase === "validating" && (
              <div className="mt-3 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-white/70" />
              </div>
            )}
          </div>
        )}

        {phase === "result-ok" && result && (
          <div className="text-center animate-fade-in-up">
            {employeePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={employeePhotoUrl}
                alt={employeeName}
                className="mx-auto h-24 w-24 rounded-full border-4 border-green-500 object-cover animate-pulse-ring"
              />
            ) : (
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-500 animate-pulse-ring">
                <CheckCircle2 className="h-12 w-12 text-white animate-check-pop" />
              </div>
            )}
            <p className="mt-6 text-xl font-bold">
              {result.type === "ARRIVEE" ? "Arrivée enregistrée" : "Départ enregistré"}
            </p>
            <p className="mt-1 text-white/70">
              {employeeName}
              {employeePosition ? ` · ${employeePosition}` : ""}
            </p>
            <p className="text-sm text-white/50">
              {result.siteName} · {result.time}
            </p>
            {result.isAnomaly && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-orange-300">
                <AlertTriangle className="h-4 w-4" /> Pointage signalé pour vérification
              </p>
            )}
            <button
              onClick={startScanning}
              className="mt-8 flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" /> Scanner à nouveau
            </button>
          </div>
        )}

        {phase === "result-queued" && (
          <div className="text-center animate-fade-in-up">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-orange-500/20">
              <WifiOff className="h-12 w-12 text-orange-300" />
            </div>
            <p className="mt-6 text-lg font-bold">Pointage enregistré localement</p>
            <p className="mt-1 max-w-xs text-sm text-white/70">
              Pas de connexion pour le moment — il sera envoyé automatiquement dès que votre téléphone retrouvera le réseau.
            </p>
            <button
              onClick={startScanning}
              className="mt-8 flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" /> Scanner à nouveau
            </button>
          </div>
        )}

        {phase === "result-error" && result && (
          <div className="text-center animate-fade-in-up">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-500">
              <AlertTriangle className="h-12 w-12 text-white" />
            </div>
            <p className="mt-6 text-lg font-bold">Pointage non enregistré</p>
            <p className="mt-1 max-w-xs text-sm text-white/70">{result.error}</p>
            <button
              onClick={startScanning}
              className="mt-8 flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/20"
            >
              <RotateCcw className="h-4 w-4" /> Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
