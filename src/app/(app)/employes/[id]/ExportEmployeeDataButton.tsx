"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { Download, Loader2 } from "lucide-react";
import { exportEmployeeDataAction } from "@/app/actions/settings";

export default function ExportEmployeeDataButton({
  employeeId,
  fileName,
}: {
  employeeId: string;
  fileName: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const json = await exportEmployeeDataAction(employeeId);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export généré");
    });
  }

  return (
    <button
      onClick={handleExport}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-navy-900 transition hover:bg-navy-50 disabled:opacity-70"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Exporter ses données
    </button>
  );
}
