"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useMealsStore } from "@/store/meals";
import { api } from "@/lib/api";
import type { Insight } from "@/lib/types";
import { Card, CardBody, Button, Progress } from "@caloriex/ui";
import { MealSuggestions } from "@/components/meal-suggestions";
import { OfflineBanner } from "@/components/offline-banner";
import { CalorieRing } from "@/components/calorie-ring";

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

  return (
    <div className="flex flex-col gap-6">
      <OfflineBanner />

      <section className="animate-fade-up">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Hey{user?.name ? `, ${user.name.split(" ")[0]}` : ""}{" "}
          <span className="inline-block animate-float-y">👋</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">Here&apos;s your day so far.</p>
      </section>

      {/* Hero — calorie ring + macros */}
      <Card glow className="overflow-hidden animate-scale-in">
        <CardBody className="p-6 sm:p-7">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
            <CalorieRing value={totals.calories} goal={goal} />

            <div className="flex min-w-0 flex-1 flex-col gap-4 sm:pl-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Daily goal
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-white">
                    {goal} <span className="text-sm font-normal text-zinc-500">kcal</span>
                  </div>
                </div>
                <Link href="/add">
                  <Button size="md">＋ Add food</Button>
                </Link>
              </div>

              <div className="flex flex-col gap-3">
                <MacroRow label="Protein" value={totals.protein} goal={proteinGoal} color="blue" />
                <MacroRow label="Carbs"   value={totals.carbs}   goal={carbsGoal}   color="amber" />
                <MacroRow label="Fat"     value={totals.fat}     goal={fatGoal}     color="rose" />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
        <MealSuggestions />
      </div>

      {insights.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>AI insights</SectionTitle>
          <div className="stagger flex flex-col gap-3">
            {insights.map((i, idx) => (
              <InsightCard key={idx} insight={i} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Today&apos;s meals</SectionTitle>
          {loading && <span className="text-xs text-zinc-500">loading…</span>}
        </div>

        {meals.length === 0 && !loading && (
          <Card flat className="animate-fade-in">
            <CardBody>
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-2xl ring-1 ring-white/10">
                  🍽️
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">No meals logged yet</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Start your day by logging what you ate.
                  </p>
                </div>
                <Link href="/add">
                  <Button size="sm">Log your first meal</Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        )}

        {meals.length > 0 && (
          <div className="stagger flex flex-col gap-3">
            {meals.map((m) => (
              <Card key={m.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                          {m.mealType}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date(m.consumedAt).toLocaleTimeString([], {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {m.notes && (
                        <p className="mt-1.5 text-sm text-zinc-300">{m.notes}</p>
                      )}
                      <ul className="mt-2 flex flex-col gap-0.5 text-xs text-zinc-400">
                        {m.entries.map((e) => (
                          <li key={e.id} className="tabular-nums">
                            <span className="text-zinc-500">{e.quantity} {e.unit}</span>{" "}
                            <span className="text-zinc-200">{e.name}</span>{" "}
                            <span className="text-zinc-500">·</span>{" "}
                            <span className="text-zinc-300">{Math.round(e.calories)} kcal</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-2xl font-semibold tabular-nums text-white">
                        {Math.round(m.totalCalories)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">kcal</span>
                      <button
                        onClick={() => deleteMeal(m.id)}
                        className="mt-1 rounded-md px-2 py-0.5 text-[11px] text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
      {children}
    </h2>
  );
}

function MacroRow({
  label, value, goal, color,
}: {
  label: string;
  value: number;
  goal: number;
  color: "emerald" | "blue" | "amber" | "rose";
}) {
  const pct = Math.min(100, Math.round((value / Math.max(1, goal)) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        <span className="tabular-nums text-xs text-zinc-500">
          <span className="text-zinc-200">{Math.round(value)}</span>
          <span className="mx-0.5">/</span>
          {goal}g
          <span className="ml-2 text-zinc-500">{pct}%</span>
        </span>
      </div>
      <Progress value={value} max={goal} color={color} />
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const tone = {
    info: {
      ring: "ring-blue-400/30",
      bg:   "bg-blue-500/[0.08]",
      dot:  "bg-blue-400",
      title:"text-blue-100",
    },
    warn: {
      ring: "ring-amber-400/30",
      bg:   "bg-amber-500/[0.08]",
      dot:  "bg-amber-400",
      title:"text-amber-100",
    },
    good: {
      ring: "ring-emerald-400/30",
      bg:   "bg-emerald-500/[0.08]",
      dot:  "bg-emerald-400",
      title:"text-emerald-100",
    },
  }[insight.severity];
  return (
    <div className={`relative overflow-hidden rounded-2xl px-4 py-3 ring-1 ${tone.ring} ${tone.bg} backdrop-blur-xl`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot} shadow-[0_0_12px_currentColor]`} />
        <div className="flex-1">
          <div className={`text-sm font-semibold ${tone.title}`}>{insight.headline}</div>
          <div className="mt-0.5 text-xs text-zinc-300/90">{insight.detail}</div>
        </div>
      </div>
    </div>
  );
}
