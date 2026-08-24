"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSiteAction,
  createTeamAction,
  createEmployeeAction,
  completeOnboardingAction,
} from "@/app/actions/company";
import toast from "react-hot-toast";
import { Building2, Users, UserPlus, Check, Loader2, ArrowRight, Navigation, Camera } from "lucide-react";

const steps = [
  { key: "site", label: "Site", icon: Building2 },
  { key: "team", label: "Équipe", icon: Users },
  { key: "employees", label: "Employés", icon: UserPlus },
];

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [addedCount, setAddedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function locate() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.error("Impossible d'obtenir la position. Vérifiez les autorisations de localisation.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSite(formData: FormData) {
    setError(null);
    if (!coords) {
      setError("Utilisez le bouton de géolocalisation pour définir la position du site.");
      return;
    }
    formData.set("latitude", String(coords.lat));
    formData.set("longitude", String(coords.lng));
    startTransition(async () => {
      const res = await createSiteAction({}, formData);
      if (res.error) return setError(res.error);
      setSiteId(res.id ?? null);
      setSiteName(String(formData.get("name")));
      setStep(1);
    });
  }

  function handleTeam(formData: FormData) {
    setError(null);
    formData.set("siteId", siteId ?? "");
    startTransition(async () => {
      const res = await createTeamAction({}, formData);
      if (res.error) return setError(res.error);
      setTeamId(res.id ?? null);
      setTeamName(String(formData.get("name")));
      setStep(2);
    });
  }

  function handleEmployeePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleEmployee(formData: FormData, form: HTMLFormElement) {
    setError(null);
    if (!photoPreview) {
      setError("La photo de profil est obligatoire.");
      return;
    }
    formData.set("teamId", teamId ?? "");
    formData.set("photoDataUrl", photoPreview);
    startTransition(async () => {
      const res = await createEmployeeAction({}, formData);
      if (res.error) return setError(res.error);
      setAddedCount((c) => c + 1);
      setPhotoPreview(null);
      form.reset();
    });
  }

  function finish() {
    startTransition(async () => {
      await completeOnboardingAction();
      router.push("/dashboard");
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-8 flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                i < step
                  ? "bg-green-500 text-white"
                  : i === step
                  ? "bg-navy-900 text-white"
                  : "bg-navy-50 text-muted"
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 w-8 rounded ${i < step ? "bg-green-500" : "bg-border"}`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm animate-fade-in-up">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600 ring-1 ring-red-100">
            {error}
          </div>
        )}

        {step === 0 && (
          <form action={handleSite} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-navy-950">
                Créez votre premier site
              </h2>
              <p className="mt-1 text-sm text-muted">
                Un restaurant, un chantier, une agence : l&apos;endroit où vos
                équipes travaillent.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-900">
                Nom du site
              </label>
              <input
                name="name"
                required
                autoFocus
                placeholder="Ex. Siège principal"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-900">
                Adresse (facultatif)
              </label>
              <input
                name="address"
                placeholder="Ex. Dakar, Sénégal"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              />
            </div>
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-medium text-navy-900 hover:bg-navy-50 disabled:opacity-60"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              {coords ? "Position capturée — recapturer" : "Utiliser ma position actuelle"}
            </button>
            {coords && (
              <p className="text-center text-xs text-green-600">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-900">
                Rayon de tolérance (mètres)
              </label>
              <input
                name="radiusMeters"
                type="number"
                min={20}
                max={1000}
                defaultValue={150}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              />
            </div>
            <p className="text-xs text-muted">
              La géolocalisation est indispensable : elle confirme que vos
              employés pointent bien depuis le site.
            </p>
            <button
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Continuer <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {step === 1 && (
          <form action={handleTeam} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-navy-950">
                Créez votre première équipe
              </h2>
              <p className="mt-1 text-sm text-muted">
                Site : <span className="font-medium text-navy-800">{siteName}</span>
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-900">
                Nom de l&apos;équipe
              </label>
              <input
                name="name"
                required
                autoFocus
                placeholder="Ex. Équipe Salle"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              />
            </div>
            <p className="text-xs text-muted">
              Un horaire par défaut (Lun–Sam, 08h00–17h00) sera créé — modifiable
              plus tard dans Horaires.
            </p>
            <button
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Continuer <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-navy-950">
                Ajoutez vos premiers employés
              </h2>
              <p className="mt-1 text-sm text-muted">
                Équipe : <span className="font-medium text-navy-800">{teamName}</span>
                {addedCount > 0 && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-600">
                    {addedCount} ajouté{addedCount > 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
            <form
              action={(fd) => {
                const form = document.getElementById("emp-form") as HTMLFormElement;
                handleEmployee(fd, form);
              }}
              id="emp-form"
              className="space-y-3"
            >
              <div className="flex items-center gap-3">
                <label className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-navy-50 text-muted hover:bg-navy-100">
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="Aperçu" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                  <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleEmployeePhoto} />
                </label>
                <p className="text-xs text-muted">
                  Photo de profil <span className="text-red-500">*</span> — obligatoire
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="firstName"
                  required
                  placeholder="Prénom"
                  className="rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                />
                <input
                  name="lastName"
                  required
                  placeholder="Nom"
                  className="rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                />
              </div>
              <input
                name="phone"
                required
                placeholder="Téléphone"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="email"
                  type="email"
                  placeholder="Email (facultatif)"
                  className="rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                />
                <input
                  name="position"
                  placeholder="Poste (facultatif)"
                  className="rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                />
              </div>
              <button
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-navy-900 py-3 text-sm font-semibold text-navy-900 transition hover:bg-navy-50 disabled:opacity-70"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Ajouter cet employé
              </button>
            </form>
            <button
              onClick={finish}
              disabled={addedCount === 0 || pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Terminer et voir mon tableau de bord <ArrowRight className="h-4 w-4" />
            </button>
            {addedCount === 0 && (
              <p className="text-center text-xs text-muted">
                Ajoutez au moins un employé pour continuer.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
