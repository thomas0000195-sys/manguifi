import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { minutesToLabel } from "@/lib/attendance-logic";
import { History } from "lucide-react";

export default async function HistoriquePage() {
  const user = await requireUser(["EMPLOYEE"]);
  if (!user.employee) return null;

  const attendances = await prisma.attendance.findMany({
    where: { employeeId: user.employee.id },
    orderBy: { timestamp: "desc" },
    take: 60,
  });

  const grouped = new Map<string, typeof attendances>();
  for (const a of attendances) {
    const key = a.timestamp.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(a);
  }

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <h1 className="text-xl font-bold text-navy-950">Historique</h1>
      <p className="text-sm text-muted">Vos arrivées, départs et heures travaillées.</p>

      {attendances.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
          <History className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-sm text-muted">Aucun pointage pour le moment.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {[...grouped.entries()].map(([day, items]) => {
            const sorted = [...items].reverse();
            let worked = 0;
            for (let i = 0; i < sorted.length - 1; i++) {
              if (sorted[i].type === "ARRIVEE" && sorted[i + 1].type === "DEPART") {
                worked += Math.round((sorted[i + 1].timestamp.getTime() - sorted[i].timestamp.getTime()) / 60000);
              }
            }
            return (
              <div key={day} className="animate-fade-in-up">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold capitalize text-navy-950">{day}</p>
                  {worked > 0 && (
                    <span className="text-xs font-medium text-navy-800">{minutesToLabel(worked)}</span>
                  )}
                </div>
                <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-surface">
                  {items.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className={a.type === "ARRIVEE" ? "text-green-600" : "text-navy-800"}>
                        {a.type === "ARRIVEE" ? "Arrivée" : "Départ"}
                      </span>
                      <span className="flex items-center gap-2 text-navy-900">
                        {a.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        {a.isAnomaly && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-600">
                            À vérifier
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
