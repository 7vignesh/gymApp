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
      <section className="animate-fade-up">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Profile, weight, and adaptive goals.</p>
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
            <SelectField label="Sex" value={sex} onChange={(v) => setSex(v as typeof sex)}>
              <option value="">—</option>
              {SEX.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectField>
            <SelectField label="Activity" value={activity} onChange={(v) => setActivity(v as typeof activity)}>
              {ACTIVITY.map((a) => <option key={a} value={a}>{a}</option>)}
            </SelectField>
            <SelectField label="Goal" value={goalType} onChange={(v) => setGoalType(v as typeof goalType)}>
              {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
            </SelectField>
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
                <p className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">{adaptation.reason}</p>
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
              <p className="text-sm text-zinc-400">{adaptation.reason}</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SelectField({
  label, value, onChange, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-3 pr-9 text-sm text-zinc-50 outline-none transition-all hover:border-white/20 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/25"
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
    </div>
  );
}
