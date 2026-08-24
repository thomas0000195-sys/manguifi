"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateEmployeePhotoAction } from "@/app/actions/company";
import { Camera, Loader2 } from "lucide-react";

const MAX_BYTES = 3 * 1024 * 1024;

export default function EmployeePhotoUpload({
  employeeId,
  currentPhotoUrl,
  initials,
}: {
  employeeId: string;
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
      toast.error("La photo dépasse 3 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      startTransition(async () => {
        const res = await updateEmployeePhotoAction(employeeId, dataUrl);
        if (res.error) { toast.error(res.error); return; }
        setPreview(dataUrl);
        toast.success("Photo mise à jour");
        router.refresh();
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <button
      type="button"
      onClick={() => fileRef.current?.click()}
      disabled={pending}
      className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-navy-50 text-lg font-semibold text-navy-800 ring-2 ring-white shadow-sm"
      title="Changer la photo"
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-navy-950/0 text-white opacity-0 transition group-hover:bg-navy-950/50 group-hover:opacity-100">
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
      </span>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </button>
  );
}
