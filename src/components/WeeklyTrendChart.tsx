"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function WeeklyTrendChart({
  data,
}: {
  data: { day: string; ponctualite: number; absenteisme: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 12, fill: "var(--muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "var(--muted)" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--border)",
            fontSize: 13,
          }}
        />
        <Line
          type="monotone"
          dataKey="ponctualite"
          name="Ponctualité %"
          stroke="var(--green-500)"
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="absenteisme"
          name="Absentéisme %"
          stroke="var(--red-500)"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
