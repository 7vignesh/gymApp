"use client";
import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Input, Stat } from "@caloriex/ui";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { User } from "@/lib/types";
import { OfflineBanner } from "@/components/offline-banner";

interface WeightLog { id: string; weightKg: number; loggedAt: string; note?: string | null }
interface Adaptation {
  baseCalories: number | null;
  adjustedCalories: number | null;
  macros: { calories: number; protein: number; carbs: number; fat: number } | null;
  trend: { slopeKgPerWeek: number | null; latestWeightKg: number | null; daysOfData: number };
  reason: string;
  changed: boolean;
  applied?: boolean;
  factor: number;
}

const SEX = ["MALE", "FEMALE", "OTHER"] as const;
const ACTIVITY = ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "ATHLETE"] as const;
const GOALS = ["LOSE", "MAINTAIN", "GAIN"] as const;

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [weight, setWeight] = useState<string>("");
  const [adaptation, setAdaptation] = useState<Adaptation | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Profile form state (hydrated from user).
  const [heightCm, setHeightCm] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [sex, setSex] = useState<(typeof SEX)[number] | "">("");
  const [activity, setActivity] = useState<(typeof ACTIVITY)[number]>("MODERATE");
  const [goalType, setGoalType] = useState<(typeof GOALS)[number]>("MAINTAIN");
  const [targetWeight, setTargetWeight] = useState("");

  useEffect(() => {
    if (!user) return;
    const u = user as User & {
      heightCm?: number | null; birthYear?: number | null;
      sex?: (typeof SEX)[number] | null; activityLevel?: (typeof ACTIVITY)[number];
      goalType?: (typeof GOALS)[number]; targetWeightKg?: number | null;
    };
    setHeightCm(u.heightCm?.toString() ?? "");
    setBirthYear(u.birthYear?.toString() ?? "");
    setSex(u.sex ?? "");
    setActivity(u.activityLevel ?? "MODERATE");
    setGoalType(u.goalType ?? "MAINTAIN");
    setTargetWeight(u.targetWeightKg?.toString() ?? "");
  }, [user]);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    const [h, a] = await Promise.all([
      api.get<{ logs: WeightLog[] }>("/weight/history?days=90").catch(() => ({ logs: [] })),
      api.get<Adaptation>("/user/goals/preview").catch(() => null),
    ]);
    setLogs(h.logs);
    setAdaptation(a);
  }

  async function logWeight() {
    const kg = Number(weight);
    if (!kg) return;
    setBusy("weight");
    try {
      await api.post("/weight", { weightKg: kg });
      setWeight("");
      await refresh();
    } finally { setBusy(null); }
  }

  async function saveProfile() {
    setBusy("profile");
    try {
      const res = await api.patch<{ user: User }>("/user/profile", {
        heightCm: heightCm ? Number(heightCm) : undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
        sex: sex || undefined,
        activityLevel: activity,
        goalType,
        targetWeightKg: targetWeight ? Number(targetWeight) : undefined,
      });
      setUser(res.user);
      await refresh();
    } finally { setBusy(null); }
  }

  async function applyAdaptive() {
    setBusy("apply");
    try {
      const res = await api.post<Adaptation>("/user/goals/adapt");
      setAdaptation(res);
      // Refresh the user so dashboard reflects new goals.
      const me = await api.get<{ user: User }>("/auth/me");
      setUser(me.user);
    } finally { setBusy(null); }
  }

  const latest = logs.length ? logs[logs.length - 1]!.weightKg : null;

  return (
    <div className="flex flex-col gap-5">
      <OfflineBanner />
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500">Profile, weight, and adaptive goals.</p>
      </section>

      <Card>
        <CardHeader><h2 className="text-base font-semibold">Log weight</h2></CardHeader>
        <CardBody>
          <div className="flex items-end gap-2">
            <Input
              label="Current weight (kg)"
              type="number"
              step="0.1"
              placeholder="e.g. 72.4"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="flex-1"
            />
            <Button onClick={logWeight} loading={busy === "weight"}>Log</Button>
          </div>
          {latest && (
            <p className="mt-2 text-xs text-zinc-500">
              Last logged: {latest}kg on{" "}
              {new Date(logs[logs.length - 1]!.loggedAt).toLocaleDateString()}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-base font-semibold">Profile</h2></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Input label="Height (cm)" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            <Input label="Birth year" type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as typeof sex)}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">—</option>
                {SEX.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Activity</label>
              <select
                value={activity}
                onChange={(e) => setActivity(e.target.value as typeof activity)}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {ACTIVITY.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Goal</label>
              <select
                value={goalType}
                onChange={(e) => setGoalType(e.target.value as typeof goalType)}
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <Input label="Target weight (kg)" type="number" step="0.1" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
          </div>
          <Button className="mt-4" onClick={saveProfile} loading={busy === "profile"}>Save profile</Button>
        </CardBody>
      </Card>

      {adaptation && (
        <Card>
          <CardHeader><h2 className="text-base font-semibold">Adaptive calorie goal</h2></CardHeader>
          <CardBody>
            {adaptation.macros ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="TDEE target" value={adaptation.baseCalories ?? "—"} unit="kcal" />
                  <Stat
                    label="Adaptive target"
                    value={adaptation.adjustedCalories ?? "—"}
                    unit="kcal"
                    hint={`factor ×${adaptation.factor.toFixed(2)}`}
                  />
                  <Stat label="Protein" value={adaptation.macros.protein} unit="g" />
                  <Stat
                    label="Trend"
                    value={
                      adaptation.trend.slopeKgPerWeek != null
                        ? `${adaptation.trend.slopeKgPerWeek.toFixed(2)}`
                        : "—"
                    }
                    unit="kg/wk"
                    hint={`${adaptation.trend.daysOfData}d of data`}
                  />
                </div>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{adaptation.reason}</p>
                <Button
                  className="mt-4"
                  onClick={applyAdaptive}
                  loading={busy === "apply"}
                  disabled={!adaptation.changed}
                >
                  {adaptation.changed ? "Apply adjusted goals" : "Goals already up to date"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{adaptation.reason}</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
