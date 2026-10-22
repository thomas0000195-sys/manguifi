"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateMyPhotoAction } from "@/app/actions/company";
import { Camera, Loader2 } from "lucide-react";

const MAX_BYTES = 3 * 1024 * 1024;

/** L'employé ajoute ou remplace sa photo de profil depuis son compte. */
export default function MyPhotoUpload({
  currentPhotoUrl,
  initials,
}: {
  currentPhotoUrl: string | null;
  initials: string;
}) {
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sélectionnez un fichier image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("La photo dépasse 3 Mo. Choisissez une image plus légère.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      startTransition(async () => {
        const res = await updateMyPhotoAction(dataUrl);
        if (res.error) {
          toast.error(res.error);
          setPreview(currentPhotoUrl);
          return;
        }
        toast.success("Photo mise à jour.");
        router.refresh();
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-5">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-navy-100 text-xl font-semibold text-navy-900"
        aria-label="Changer ma photo de profil"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
        <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-navy-900 text-white">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        </span>
      </button>
      <p className="text-xs text-muted">Votre photo de profil est facultative.</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
