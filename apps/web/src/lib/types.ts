export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
export type MealSource = "TEXT" | "IMAGE" | "BARCODE" | "MANUAL";

export interface MealEntry {
  id: string;
  mealId: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  aiConfidence?: number | null;
  userEdited: boolean;
  createdAt: string;
}

export interface Meal {
  id: string;
  userId: string;
  mealType: MealType;
  source: MealSource;
  notes?: string | null;
  imageUrl?: string | null;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  consumedAt: string;
  createdAt: string;
  entries: MealEntry[];
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  dailyCalorieGoal: number | null;
  dailyProteinGoal: number | null;
  dailyCarbsGoal: number | null;
  dailyFatGoal: number | null;
  // Feature 7 additions
  heightCm?: number | null;
  birthYear?: number | null;
  sex?: "MALE" | "FEMALE" | "OTHER" | null;
  activityLevel?: "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "ATHLETE";
  goalType?: "LOSE" | "MAINTAIN" | "GAIN";
  currentWeightKg?: number | null;
  targetWeightKg?: number | null;
}

export interface Insight {
  headline: string;
  detail: string;
  severity: "info" | "warn" | "good";
}

export interface ParseItem {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  matched?: string;
}
