"use client";
import { create } from "zustand";
import { api } from "@/lib/api";
import type { Meal } from "@/lib/types";

interface MealsState {
  meals: Meal[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  loading: boolean;
  error: string | null;
  loadToday: () => Promise<void>;
  addTextMeal: (text: string, mealType: string) => Promise<Meal>;
  addStructured: (payload: unknown) => Promise<Meal>;
  deleteMeal: (id: string) => Promise<void>;
}

export const useMealsStore = create<MealsState>((set, get) => ({
  meals: [],
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  loading: false,
  error: null,

  async loadToday() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ meals: Meal[]; totals: MealsState["totals"] }>(
        "/meals/today",
      );
      set({ meals: data.meals, totals: data.totals, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async addTextMeal(text, mealType) {
    const { meal } = await api.post<{ meal: Meal }>("/meals/text", { text, mealType });
    await get().loadToday();
    return meal;
  },

  async addStructured(payload) {
    const { meal } = await api.post<{ meal: Meal }>("/meals", payload);
    await get().loadToday();
    return meal;
  },

  async deleteMeal(id) {
    await api.del(`/meals/${id}`);
    await get().loadToday();
  },
}));
