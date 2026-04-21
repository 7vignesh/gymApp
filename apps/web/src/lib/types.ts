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

/* ---------- Personalized Exercise Library ---------- */

export const MUSCLE_GROUPS = [
  "biceps",
  "triceps",
  "back",
  "chest",
  "shoulders",
  "legs",
  "core",
  "forearms",
  "full body",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export type ExerciseLevel = "beginner" | "intermediate" | "advanced";

export interface Exercise {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  category: string;
  level: ExerciseLevel | string;
  force: string | null;
  mechanic: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  bodyPart: string;
  instructions: string[];
  tips: string[];
  images: string[];
  videoUrl: string | null;
  isBodyweight: boolean;
  isMachine: boolean;
  isFreeWeight: boolean;
  isCable: boolean;
  isBands: boolean;
  sourceName: string | null;
  status: string;
}

export interface ExerciseListResponse {
  items: Exercise[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AlternativesResponse {
  base: Exercise;
  groups: { equipment: string; exercises: Exercise[] }[];
  items: Exercise[];
}

export interface FilterMeta {
  bodyParts: string[];
  equipment: string[];
  levels: string[];
}

export interface MusclePreference {
  id: string;
  userId: string;
  muscleGroups: MuscleGroup[];
  updatedAt: string;
  createdAt: string;
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { entries: number };
  entries?: WorkoutExerciseEntry[];
}

export interface WorkoutExerciseEntry {
  id: string;
  workoutId: string;
  exerciseId: string;
  exercise?: Exercise;
  order: number;
  sets: number;
  reps: number;
  weightKg: number | null;
  restSec: number;
  notes: string | null;
  createdAt: string;
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
