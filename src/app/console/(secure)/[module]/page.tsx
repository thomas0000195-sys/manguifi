import { notFound } from "next/navigation";
import { CONSOLE_MODULES } from "@/lib/console/modules";

export default async function ConsoleModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const found = CONSOLE_MODULES.find((m) => m.href === `/console/${module}`);
  if (!found) notFound();

  return (
    <div>
      <h1 className="text-xl font-bold">{found.label}</h1>
      <p className="mt-2 text-sm text-muted">
        Ce module sera livré à l&apos;étape {found.step} de la V1.
      </p>
    </div>
  );
}
