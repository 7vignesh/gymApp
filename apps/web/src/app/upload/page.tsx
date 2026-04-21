"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Input } from "@caloriex/ui";
import { api, ApiError } from "@/lib/api";
import { compressImageToDataUrl } from "@/lib/image";
import { useMealsStore } from "@/store/meals";
import type { MealType } from "@/lib/types";

interface AIItem {
  food: string;             // display name (post-normalization)
  canonical?: string;
  region?: string | null;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  matched?: string;
  source?: "food-item" | "nutrition-engine";
}

const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export default function UploadPage() {
  const router = useRouter();
  const { addStructured } = useMealsStore();
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<AIItem[]>([]);
  const [mealType, setMealType] = useState<MealType>("LUNCH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    setItems([]);
    try {
      const dataUrl = await compressImageToDataUrl(file, 1024, 0.85);
      setPreview(dataUrl);
      const res = await api.post<{ items: AIItem[]; note?: string; source?: string }>(
        "/ai/recognize",
        { image: dataUrl },
      );
      if (res.items.length === 0 && res.note) setInfo(res.note);
      setItems(res.items);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError("AI vision isn't configured on the server (set OPENAI_API_KEY).");
      } else {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }

  function updateItem(idx: number, patch: Partial<AIItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function save() {
    if (items.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await addStructured({
        mealType,
        source: "IMAGE",
        entries: items.map((i) => ({
          name: i.food,
          quantity: Number(i.quantity || 1),
          unit: i.unit || "serving",
          calories: Number(i.calories ?? 0),
          protein: Number(i.protein ?? 0),
          carbs: Number(i.carbs ?? 0),
          fat: Number(i.fat ?? 0),
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

  const total = items.reduce((a, i) => a + Number(i.calories ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Upload a meal photo</h1>
        <p className="text-sm text-zinc-500">
          Our AI will identify foods and estimate calories.
        </p>
      </section>

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
          <label className="flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="meal preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm text-zinc-500">
                📷 Tap to upload a photo
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFile}
            />
          </label>
          {loading && (
            <p className="mt-3 text-xs text-zinc-500">Analyzing image…</p>
          )}
          {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
          {info && !error && <p className="mt-3 text-xs text-amber-600">{info}</p>}
        </CardBody>
      </Card>

      {items.length > 0 && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              Detected ({items.length}) — review & edit
            </h2>
            {items.map((it, idx) => (
              <Card key={idx}>
                <CardBody>
                  <div className="flex items-end gap-2">
                    <Input
                      label="Food"
                      className="flex-1"
                      value={it.food}
                      onChange={(e) => updateItem(idx, { food: e.target.value })}
                    />
                    {it.region && (
                      <span className="mb-1 shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {it.region}
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
                      value={it.calories ?? 0}
                      onChange={(e) => updateItem(idx, { calories: Number(e.target.value) })}
                    />
                    <Input
                      label="Protein (g)"
                      type="number"
                      value={it.protein ?? 0}
                      onChange={(e) => updateItem(idx, { protein: Number(e.target.value) })}
                    />
                    <Input
                      label="Carbs (g)"
                      type="number"
                      value={it.carbs ?? 0}
                      onChange={(e) => updateItem(idx, { carbs: Number(e.target.value) })}
                    />
                    <Input
                      label="Fat (g)"
                      type="number"
                      value={it.fat ?? 0}
                      onChange={(e) => updateItem(idx, { fat: Number(e.target.value) })}
                    />
                  </div>
                  {it.confidence < 0.5 && (
                    <p className="mt-2 text-xs text-amber-600">
                      Low confidence — double-check this item.
                    </p>
                  )}
                </CardBody>
              </Card>
            ))}
          </section>

          <Button onClick={save} loading={loading}>
            Save meal ({Math.round(total)} kcal)
          </Button>
        </>
      )}
    </div>
  );
}
