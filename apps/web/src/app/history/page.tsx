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

export default function HistoryPage() {
  const [weeks, setWeeks] = useState(1);
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
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="text-sm text-zinc-500">Your recent nutrition trends.</p>
        </div>
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value={1}>1 week</option>
          <option value={2}>2 weeks</option>
          <option value={4}>4 weeks</option>
          <option value={12}>12 weeks</option>
        </select>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Calories per day</h2>
        </CardHeader>
        <CardBody>
          <div className="h-64">
            {loading && <div className="text-xs text-zinc-400">loading…</div>}
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="calories" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Macros per day</h2>
        </CardHeader>
        <CardBody>
          <div className="h-64">
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="protein" stackId="m" fill="#3b82f6" />
                  <Bar dataKey="carbs" stackId="m" fill="#f59e0b" />
                  <Bar dataKey="fat" stackId="m" fill="#f43f5e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardBody>
      </Card>

      {data && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Averages / day</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Calories" value={data.avgPerDay.calories} unit="kcal" />
              <Stat label="Protein" value={data.avgPerDay.protein} unit="g" />
              <Stat label="Carbs" value={data.avgPerDay.carbs} unit="g" />
              <Stat label="Fat" value={data.avgPerDay.fat} unit="g" />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
