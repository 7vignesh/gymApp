"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Input } from "@caloriex/ui";
import { api } from "@/lib/api";
import { useMealsStore } from "@/store/meals";
import type { ParseItem, MealType } from "@/lib/types";
import { VoiceButton } from "@/components/voice-button";
import { MealSuggestions } from "@/components/meal-suggestions";
import { OfflineBanner } from "@/components/offline-banner";
import { useConnectivity } from "@/lib/connectivity";
import { estimateOffline, rememberLookups } from "@/lib/food-cache";

const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export default function AddFoodPage() {
  const router = useRouter();
  const { addStructured } = useMealsStore();
  const [text, setText] = useState("");
  const [mealType, setMealType] = useState<MealType>("SNACK");
  const [items, setItems] = useState<ParseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { online, apiReachable } = useConnectivity();
  const offline = !online || !apiReachable;

  async function preview() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (offline) {
        const local = estimateOffline(text);
        setItems(local);
        if (local.length === 0) {
          setError("Offline: no cached match. Reconnect to analyze with AI.");
        }
        return;
      }
      const res = await api.post<{ items: ParseItem[] }>("/ai/parse-text", { text });
      setItems(res.items);
      rememberLookups(res.items);
    } catch (e) {
      // API failed mid-request — fall back to local cache.
      const local = estimateOffline(text);
      if (local.length) {
        setItems(local);
        setError("Server unreachable — used offline cache.");
      } else {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }

  function updateItem(idx: number, patch: Partial<ParseItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function save() {
    if (items.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await addStructured({
        mealType,
        source: "TEXT",
        notes: text,
        entries: items.map((i) => ({
          name: i.name,
          quantity: Number(i.quantity),
          unit: i.unit,
          calories: Number(i.calories),
          protein: Number(i.protein),
          carbs: Number(i.carbs),
          fat: Number(i.fat),
          aiConfidence: i.confidence,
        })),
      });
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const totalCal = items.reduce((a, i) => a + Number(i.calories || 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <OfflineBanner />
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Add food</h1>
        <p className="text-sm text-zinc-500">Type, speak, or pick a frequent meal.</p>
      </section>

      <MealSuggestions
        onPick={(signature, data) => {
          const joined = data.map((e) => `${e.quantity} ${e.unit} ${e.name}`).join(", ");
          setText(joined);
          setItems(data.map((e) => ({
            name: e.name, quantity: e.quantity, unit: e.unit,
            calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat,
            confidence: 1, matched: "suggestion",
          })));
          void signature;
        }}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setMealType(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  mealType === t
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-start gap-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. 2 plates biryani with masala dosa and chai"
              rows={3}
              className="flex-1 resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <VoiceButton
              onInterim={(t) => setText(t)}
              onTranscript={(t) => { setText(t); }}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={preview} loading={loading} variant="secondary">
              Analyze
            </Button>
            <Button onClick={save} disabled={items.length === 0} loading={loading}>
              Save ({Math.round(totalCal)} kcal)
            </Button>
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </CardBody>
      </Card>

      {items.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            Review & edit
          </h2>
          {items.map((it, idx) => (
            <Card key={idx}>
              <CardBody>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Input
                      label="Food"
                      value={it.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                    />
                  </div>
                  {it.confidence < 0.5 && (
                    <span className="self-end rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                      low confidence
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Input
                    label="Qty"
                    type="number"
                    step="0.1"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                  />
                  <Input
                    label="Unit"
                    value={it.unit}
                    onChange={(e) => updateItem(idx, { unit: e.target.value })}
                  />
                  <Input
                    label="Calories"
                    type="number"
                    value={it.calories}
                    onChange={(e) => updateItem(idx, { calories: Number(e.target.value) })}
                  />
                  <Input
                    label="Protein (g)"
                    type="number"
                    value={it.protein}
                    onChange={(e) => updateItem(idx, { protein: Number(e.target.value) })}
                  />
                  <Input
                    label="Carbs (g)"
                    type="number"
                    value={it.carbs}
                    onChange={(e) => updateItem(idx, { carbs: Number(e.target.value) })}
                  />
                  <Input
                    label="Fat (g)"
                    type="number"
                    value={it.fat}
                    onChange={(e) => updateItem(idx, { fat: Number(e.target.value) })}
                  />
                </div>
              </CardBody>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
