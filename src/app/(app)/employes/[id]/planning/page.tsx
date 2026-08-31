import { requireUser, assertEmployeeInScope } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { startOfDay, toLocalDateString, parseLocalDate } from "@/lib/attendance-logic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PlanningClient from "./PlanningClient";

function monthStartIso(date: Date) {
  return toLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1));
}

export default async function EmployeePlanningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  const { id } = await params;
  const employee = await assertEmployeeInScope(user, id);

  const currentMonth = monthStartIso(new Date());

  const workSchedule = await prisma.workSchedule.findFirst({
    where: { employeeId: employee.id, effectiveTo: null },
  });

  const monthStart = startOfDay(parseLocalDate(currentMonth));
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const days = workSchedule
    ? await prisma.workScheduleDay.findMany({
        where: { workScheduleId: workSchedule.id, date: { gte: monthStart, lt: monthEnd } },
      })
    : [];

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:py-8">
      <Link
        href={`/employes/${employee.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-800 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Retour à {employee.firstName} {employee.lastName}
      </Link>

      <PlanningClient
        employeeId={employee.id}
        employeeName={`${employee.firstName} ${employee.lastName}`}
        initialMonth={currentMonth}
        initialDays={days.map((d) => ({
          date: toLocalDateString(d.date),
          isWorkingDay: d.isWorkingDay,
          startTime: d.startTime,
          endTime: d.endTime,
        }))}
      />
    </div>
  );
}
