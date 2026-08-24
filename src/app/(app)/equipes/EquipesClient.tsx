"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import {
  createSiteAction,
  createTeamAction,
  createResponsableAction,
  regenerateSiteQrAction,
  toggleSiteActiveAction,
} from "@/app/actions/company";
import {
  Plus,
  Building2,
  Users,
  X,
  Loader2,
  UserCog,
  MapPin,
  RefreshCw,
  Download,
  AlertTriangle,
  Power,
  Navigation,
} from "lucide-react";

type Team = {
  id: string;
  name: string;
  _count: { employees: number };
  responsables: { user: { id: string; email: string | null; phone: string | null } }[];
};
type Site = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  active: boolean;
  qrDataUrl: string | null;
  teams: Team[];
};

function downloadSitePoster(site: Site) {
  if (!site.qrDataUrl) return;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFillColor(11, 26, 54);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("Manguifi", 105, 20, { align: "center" });
  doc.setFontSize(11);
  doc.text("Scannez pour pointer votre arrivée ou votre départ", 105, 30, { align: "center" });

  doc.addImage(site.qrDataUrl, "PNG", 55, 60, 100, 100);

  doc.setTextColor(11, 19, 36);
  doc.setFontSize(16);
  doc.text(site.name, 105, 175, { align: "center" });
  if (site.address) {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(site.address, 105, 183, { align: "center" });
  }
  doc.setFontSize(9);
  doc.text("Connectez-vous à votre espace Manguifi avant de scanner.", 105, 260, { align: "center" });

  doc.save(`qr-site-${site.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export default function EquipesClient({
  sites,
  canManage,
}: {
  sites: Site[];
  canManage: boolean;
}) {
  const [showSite, setShowSite] = useState(false);
  const [showTeamFor, setShowTeamFor] = useState<string | null>(null);
  const [showRespFor, setShowRespFor] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();

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
    if (!coords) {
      toast.error("Utilisez le bouton de géolocalisation pour définir la position du site.");
      return;
    }
    formData.set("latitude", String(coords.lat));
    formData.set("longitude", String(coords.lng));
    startTransition(async () => {
      const res = await createSiteAction({}, formData);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Site créé");
      setShowSite(false);
      setCoords(null);
    });
  }

  function handleTeam(formData: FormData) {
    startTransition(async () => {
      const res = await createTeamAction({}, formData);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Équipe créée");
      setShowTeamFor(null);
    });
  }

  function handleResp(formData: FormData) {
    startTransition(async () => {
      const res = await createResponsableAction({}, formData);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Responsable ajouté");
      setShowRespFor(null);
    });
  }

  function handleRegenerate(siteId: string, siteName: string) {
    if (!confirm(`Régénérer le QR de « ${siteName} » ? L'ancien poster ne fonctionnera plus.`)) return;
    startTransition(async () => {
      const res = await regenerateSiteQrAction(siteId);
      if (res.error) { toast.error(res.error); return; }
      toast.success("QR régénéré — réimprimez le nouveau poster.");
    });
  }

  function handleToggleActive(siteId: string) {
    startTransition(async () => {
      await toggleSiteActiveAction(siteId);
      toast.success("Statut du site mis à jour");
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-950">Équipes & sites</h1>
          <p className="text-sm text-muted">{sites.length} site(s)</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowSite(true)}
            className="flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
          >
            <Plus className="h-4 w-4" /> Nouveau site
          </button>
        )}
      </div>

      {sites.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 font-medium text-navy-900">Aucun site pour le moment</p>
        </div>
      )}

      <div className="mt-6 space-y-5">
        {sites.map((site) => (
          <div key={site.id} className="rounded-2xl border border-border bg-surface p-5 animate-fade-in-up">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-800">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="flex items-center gap-2 font-semibold text-navy-950">
                    {site.name}
                    {!site.active && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500">
                        Désactivé
                      </span>
                    )}
                  </p>
                  {site.address && <p className="text-xs text-muted">{site.address}</p>}
                  {site.latitude != null && site.longitude != null ? (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                      <MapPin className="h-3 w-3" /> Rayon autorisé : {site.radiusMeters} m
                    </p>
                  ) : (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-orange-600">
                      <AlertTriangle className="h-3 w-3" /> Position GPS non configurée
                    </p>
                  )}
                </div>
              </div>
              {canManage && (
                <button
                  onClick={() => setShowTeamFor(site.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-navy-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Équipe
                </button>
              )}
            </div>

            {canManage && site.qrDataUrl && (
              <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-navy-50/40 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={site.qrDataUrl} alt={`QR ${site.name}`} className="h-20 w-20 rounded-lg border border-border bg-white p-1" />
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <button
                    onClick={() => downloadSitePoster(site)}
                    className="flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800"
                  >
                    <Download className="h-3.5 w-3.5" /> Poster à imprimer
                  </button>
                  <button
                    onClick={() => handleRegenerate(site.id, site.name)}
                    disabled={pending}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-navy-50 disabled:opacity-60"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Régénérer le QR
                  </button>
                  <button
                    onClick={() => handleToggleActive(site.id)}
                    disabled={pending}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-navy-50 disabled:opacity-60"
                  >
                    <Power className="h-3.5 w-3.5" /> {site.active ? "Désactiver" : "Réactiver"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {site.teams.map((team) => (
                <div key={team.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-navy-900">
                      <Users className="h-3.5 w-3.5 text-muted" /> {team.name}
                    </span>
                    <span className="text-xs text-muted">{team._count.employees} employé(s)</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {team.responsables.map((r) => (
                      <span key={r.user.id} className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] text-navy-800">
                        {r.user.email ?? r.user.phone}
                      </span>
                    ))}
                    {canManage && (
                      <button
                        onClick={() => setShowRespFor(team.id)}
                        className="flex items-center gap-1 text-[11px] font-medium text-navy-800 hover:underline"
                      >
                        <UserCog className="h-3 w-3" /> + Responsable
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {site.teams.length === 0 && (
                <p className="text-sm text-muted">Aucune équipe sur ce site.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {showSite && (
        <Modal onClose={() => { setShowSite(false); setCoords(null); }} title="Nouveau site">
          <form action={handleSite} className="space-y-3">
            <input name="name" required placeholder="Nom du site" className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100" />
            <input name="address" placeholder="Adresse (facultatif)" className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100" />

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
              <label className="mb-1 block text-xs text-muted">Rayon de tolérance (mètres)</label>
              <input
                name="radiusMeters"
                type="number"
                min={20}
                max={1000}
                defaultValue={150}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              />
            </div>

            <SubmitButton pending={pending} label="Créer le site" />
          </form>
        </Modal>
      )}

      {showTeamFor && (
        <Modal onClose={() => setShowTeamFor(null)} title="Nouvelle équipe">
          <form action={handleTeam} className="space-y-3">
            <input type="hidden" name="siteId" value={showTeamFor} />
            <input name="name" required placeholder="Nom de l'équipe" className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100" />
            <SubmitButton pending={pending} label="Créer l'équipe" />
          </form>
        </Modal>
      )}

      {showRespFor && (
        <Modal onClose={() => setShowRespFor(null)} title="Ajouter un responsable">
          <form action={handleResp} className="space-y-3">
            <input type="hidden" name="teamId" value={showRespFor} />
            <input name="email" type="email" required placeholder="Email" className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100" />
            <input name="password" type="password" minLength={8} placeholder="Mot de passe (nouveau compte uniquement)" className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100" />
            <p className="text-xs text-muted">
              Si cet email est déjà un responsable de votre entreprise, il sera simplement ajouté à cette équipe (laissez le mot de passe vide).
            </p>
            <SubmitButton pending={pending} label="Ajouter le responsable" />
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 sm:items-center">
      <div className="w-full max-w-md animate-fade-in-up rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-950">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-navy-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}
