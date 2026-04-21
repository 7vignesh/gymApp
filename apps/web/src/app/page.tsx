"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useMealsStore } from "@/store/meals";
import { api } from "@/lib/api";
import type { Insight } from "@/lib/types";
import { Card, CardBody, CardHeader, Progress, Stat, Button } from "@caloriex/ui";
import { useState } from "react";
import { MealSuggestions } from "@/components/meal-suggestions";
import { OfflineBanner } from "@/components/offline-banner";

export default function DashboardPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const { meals, totals, loadToday, loading, deleteMeal } = useMealsStore();
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    void loadToday();
    api.get<{ insights: Insight[] }>("/ai/insights")
      .then((r) => setInsights(r.insights))
      .catch(() => setInsights([]));
  }, [token, router, loadToday]);

  if (!token) return null;

  const goal = user?.dailyCalorieGoal ?? 2000;
  const proteinGoal = user?.dailyProteinGoal ?? 120;
  const carbsGoal = user?.dailyCarbsGoal ?? 250;
  const fatGoal = user?.dailyFatGoal ?? 70;
  const remaining = Math.max(0, Math.round(goal - totals.calories));

  return (
    <div className="flex flex-col gap-5">
      <OfflineBanner />
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hey{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="text-sm text-zinc-500">Here&apos;s your day so far.</p>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Today&apos;s calories</h2>
            <span className="text-xs text-zinc-500">Goal {goal} kcal</span>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-4xl font-bold">{Math.round(totals.calories)}</div>
              <div className="mt-1 text-sm text-zinc-500">{remaining} kcal remaining</div>
            </div>
            <Link href="/add">
              <Button size="md">+ Add food</Button>
            </Link>
          </div>
          <Progress className="mt-4" value={totals.calories} max={goal} />
          <div className="mt-5 grid grid-cols-3 gap-3">
            <MacroCell label="Protein" value={totals.protein} goal={proteinGoal} color="blue" />
            <MacroCell label="Carbs" value={totals.carbs} goal={carbsGoal} color="amber" />
            <MacroCell label="Fat" value={totals.fat} goal={fatGoal} color="rose" />
          </div>
        </CardBody>
      </Card>

      <MealSuggestions />

      {insights.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            AI insights
          </h2>
          {insights.map((i, idx) => (
            <InsightCard key={idx} insight={i} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            Today&apos;s meals
          </h2>
          {loading && <span className="text-xs text-zinc-400">loading…</span>}
        </div>
        {meals.length === 0 && !loading && (
          <Card>
            <CardBody>
              <div className="py-6 text-center text-sm text-zinc-500">
                No meals yet today. <Link className="text-emerald-600" href="/add">Add one →</Link>
              </div>
            </CardBody>
          </Card>
        )}
        {meals.map((m) => (
          <Card key={m.id}>
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {m.mealType}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(m.consumedAt).toLocaleTimeString([], {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {m.notes && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{m.notes}</p>}
                  <ul className="mt-2 text-xs text-zinc-500">
                    {m.entries.map((e) => (
                      <li key={e.id}>
                        {e.quantity} {e.unit} {e.name} · {Math.round(e.calories)} kcal
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-lg font-semibold">{Math.round(m.totalCalories)}</span>
                  <span className="text-[10px] uppercase text-zinc-400">kcal</span>
                  <button
                    onClick={() => deleteMeal(m.id)}
                    className="mt-1 text-xs text-red-500 hover:underline"
                  >
                    delete
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </section>
    </div>
  );
}

function MacroCell({
  label, value, goal, color,
}: {
  label: string;
  value: number;
  goal: number;
  color: "emerald" | "blue" | "amber" | "rose";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <Stat
        label={label}
        value={Math.round(value)}
        unit="g"
        hint={`of ${goal}g`}
      />
      <Progress className="mt-2" value={value} max={goal} color={color} />
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    good: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  }[insight.severity];
  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles}`}>
      <div className="text-sm font-semibold">{insight.headline}</div>
      <div className="mt-0.5 text-xs opacity-90">{insight.detail}</div>
    </div>
  );
}
