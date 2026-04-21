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
      <section className="animate-fade-up">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Scan a meal</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Snap a photo and our AI will identify each food.
        </p>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setMealType(t)}
                className={`relative rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all ${
                  mealType === t
                    ? "bg-brand-gradient text-white shadow-[0_6px_20px_-6px_rgba(16,185,129,0.6)]"
                    : "border border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:bg-white/[0.08]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardBody>
          <label className="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] transition-all hover:border-emerald-400/40 hover:bg-white/[0.04]">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="meal preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-500 transition-colors group-hover:text-zinc-300">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-2xl ring-1 ring-white/10 transition-transform group-hover:scale-110">
                  📷
                </span>
                <span className="text-sm font-medium">Tap to upload a photo</span>
                <span className="text-[11px]">JPG / PNG · resized & compressed in browser</span>
              </div>
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
            <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Analyzing image with AI…
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 animate-fade-in">
              {error}
            </p>
          )}
          {info && !error && (
            <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 animate-fade-in">
              {info}
            </p>
          )}
        </CardBody>
      </Card>

      {items.length > 0 && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Detected ({items.length}) — review & edit
            </h2>
            <div className="stagger flex flex-col gap-3">
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
                      <span className="mb-1 shrink-0 rounded-md border border-emerald-400/30 bg-emerald-500/[0.1] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
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
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-500/[0.08] px-2 py-1 text-[11px] text-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Low confidence — double-check this item.
                    </p>
                  )}
                </CardBody>
              </Card>
            ))}
            </div>
          </section>

          <Button onClick={save} loading={loading} size="lg">
            Save meal · {Math.round(total)} kcal
          </Button>
        </>
      )}
    </div>
  );
}
