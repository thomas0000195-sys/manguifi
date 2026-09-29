"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateEmployeePhotoAction } from "@/app/actions/company";
import { Camera, Loader2, Upload } from "lucide-react";

const MAX_BYTES = 3 * 1024 * 1024;

export default function ProfilePhotoPanel({
  employeeId,
  currentPhotoUrl,
  firstName,
  lastName,
}: {
  employeeId: string;
  currentPhotoUrl: string | null;
  firstName: string;
  lastName: string;
}) {
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sélectionnez un fichier image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("La photo dépasse 3 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      startTransition(async () => {
        const res = await updateEmployeePhotoAction(employeeId, dataUrl);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        setPreview(dataUrl);
        toast.success("Photo mise à jour");
        router.refresh();
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-navy-950">Photo de profil</h2>
      <p className="mt-1 text-sm text-muted">
        Ajoutez ou modifiez votre photo. Elle sera visible par votre employeur et lors des pointages.
      </p>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-navy-50 text-lg font-semibold text-navy-800">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Profil" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-50 disabled:opacity-70"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Upload en cours...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {preview ? "Changer la photo" : "Ajouter une photo"}
            </>
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleFile}
          disabled={pending}
        />
      </div>

      <p className="mt-3 text-xs text-muted">
        📸 Format: JPG, PNG — Taille max: 3 Mo
      </p>
    </div>
  );
}
