"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateMyPhotoAction } from "@/app/actions/company";
import { Camera, Loader2 } from "lucide-react";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIDE = 800;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

/**
 * Recadre au centre en carré, réduit à 800 px maximum, puis encode en JPEG.
 * La qualité baisse jusqu'à passer sous 2 Mo.
 */
async function compressToSquareJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image illisible."));
      el.src = url;
    });

    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const size = Math.min(MAX_SIDE, side);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Traitement d'image indisponible.");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

    for (let quality = 0.85; quality >= 0.4; quality -= 0.1) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const bytes = Math.floor(((dataUrl.split(",")[1] ?? "").length * 3) / 4);
      if (bytes <= MAX_OUTPUT_BYTES) return dataUrl;
    }
    throw new Error("La photo reste trop lourde après compression. Choisissez une image plus simple.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** L'employé ajoute ou remplace sa photo de profil depuis son compte. Facultative. */
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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format refusé : JPEG, PNG ou WebP uniquement.");
      return;
    }

    let dataUrl: string;
    try {
      dataUrl = await compressToSquareJpeg(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo non traitée.");
      return;
    }

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
  }

  return (
    <div className="flex flex-col items-center gap-2">
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
      <p className="text-xs text-muted">Photo facultative · JPEG, PNG ou WebP</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
