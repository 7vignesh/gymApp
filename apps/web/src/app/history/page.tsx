"use client";
import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardBody, CardHeader, Stat } from "@caloriex/ui";
import { api } from "@/lib/api";

interface DayPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface WeeklyResp {
  series: DayPoint[];
  avgPerDay: DayPoint;
}

const RANGES = [1, 2, 4, 12] as const;

export default function HistoryPage() {
  const [weeks, setWeeks] = useState<number>(1);
  const [data, setData] = useState<WeeklyResp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<WeeklyResp>(`/analytics/weekly?weeks=${weeks}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [weeks]);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex items-start justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Trends</h1>
          <p className="mt-1 text-sm text-zinc-400">Your recent nutrition trends.</p>
        </div>
      </section>

      {/* range pills */}
      <div className="flex gap-2 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setWeeks(r)}
            className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all ${
              weeks === r
                ? "bg-brand-gradient text-white shadow-[0_6px_20px_-6px_rgba(16,185,129,0.6)]"
                : "border border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:bg-white/[0.08]"
            }`}
          >
            {r}w
          </button>
        ))}
      </div>

      <Card className="animate-fade-up" style={{ animationDelay: "80ms" }}>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-200">Calories per day</h2>
        </CardHeader>
        <CardBody>
          <div className="h-64">
            {loading && <div className="text-xs text-zinc-500">loading…</div>}
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.series}>
                  <defs>
                    <linearGradient id="cal-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#10b981" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9aa3b2" }} stroke="rgba(255,255,255,0.08)" />
                  <YAxis tick={{ fontSize: 11, fill: "#9aa3b2" }} stroke="rgba(255,255,255,0.08)" />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "rgba(15,17,23,0.9)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      color: "#f5f7fb",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#9aa3b2" }}
                  />
                  <Bar dataKey="calories" fill="url(#cal-grad)" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardBody>
      </Card>

      <Card className="animate-fade-up" style={{ animationDelay: "120ms" }}>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-200">Macros per day</h2>
        </CardHeader>
        <CardBody>
          <div className="h-64">
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9aa3b2" }} stroke="rgba(255,255,255,0.08)" />
                  <YAxis tick={{ fontSize: 11, fill: "#9aa3b2" }} stroke="rgba(255,255,255,0.08)" />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "rgba(15,17,23,0.9)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      color: "#f5f7fb",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#9aa3b2" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#9aa3b2" }} />
                  <Bar dataKey="protein" stackId="m" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="carbs"   stackId="m" fill="#f59e0b" />
                  <Bar dataKey="fat"     stackId="m" fill="#f43f5e" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardBody>
      </Card>

      {data && (
        <Card className="animate-fade-up" style={{ animationDelay: "160ms" }}>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-200">Averages / day</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Calories" value={data.avgPerDay.calories} unit="kcal" />
              <Stat label="Protein"  value={data.avgPerDay.protein}  unit="g" />
              <Stat label="Carbs"    value={data.avgPerDay.carbs}    unit="g" />
              <Stat label="Fat"      value={data.avgPerDay.fat}      unit="g" />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
