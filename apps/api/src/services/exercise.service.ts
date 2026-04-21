/**
 * Exercise library service.
 *
 * Runtime helpers used by the /exercises routes. The seed script
 * (packages/db/prisma/seed-exercises.ts) is the only place that talks to
 * the GitHub dataset; everything here reads from our own DB.
 */
import { prisma } from "@caloriex/db";
import type { Prisma } from "@caloriex/db";

export const BODY_PARTS = [
  "biceps",
  "triceps",
  "back",
  "chest",
  "shoulders",
  "legs",
  "core",
  "forearms",
  "full body",
  "cardio",
] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

export const EQUIPMENT_BUCKETS = [
  "bodyweight",
  "dumbbell",
  "barbell",
  "kettlebell",
  "cable",
  "machine",
  "smith machine",
  "bands",
  "medicine ball",
  "foam roller",
] as const;

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;

export interface ListFilters {
  bodyPart?: string | string[]; // accepts repeated / csv
  equipment?: string | string[]; // normalized bucket(s)
  level?: string;
  isBodyweight?: boolean;
  isMachine?: boolean;
  isFreeWeight?: boolean;
  isCable?: boolean;
  isBands?: boolean;
  search?: string;
  sort?: "alpha" | "level" | "newest";
  page?: number;
  limit?: number;
}

/** Split csv / keep array / ignore blanks. */
function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  const list = Array.isArray(v) ? v : v.split(",");
  return list.map((s) => s.trim()).filter(Boolean);
}

export async function listExercises(f: ListFilters) {
  const page = Math.max(1, f.page ?? 1);
  const limit = Math.max(1, Math.min(100, f.limit ?? 24));
  const skip = (page - 1) * limit;

  const bodyParts = toArray(f.bodyPart);
  const equipments = toArray(f.equipment);

  const where: Prisma.ExerciseWhereInput = {
    status: "active",
    ...(bodyParts.length ? { bodyPart: { in: bodyParts } } : {}),
    ...(equipments.length ? { equipment: { hasSome: equipments } } : {}),
    ...(f.level ? { level: f.level } : {}),
    ...(typeof f.isBodyweight === "boolean" ? { isBodyweight: f.isBodyweight } : {}),
    ...(typeof f.isMachine === "boolean" ? { isMachine: f.isMachine } : {}),
    ...(typeof f.isFreeWeight === "boolean" ? { isFreeWeight: f.isFreeWeight } : {}),
    ...(typeof f.isCable === "boolean" ? { isCable: f.isCable } : {}),
    ...(typeof f.isBands === "boolean" ? { isBands: f.isBands } : {}),
    ...(f.search
      ? {
          OR: [
            { name: { contains: f.search, mode: "insensitive" } },
            { primaryMuscles: { hasSome: [f.search.toLowerCase()] } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ExerciseOrderByWithRelationInput[] =
    f.sort === "newest"
      ? [{ createdAt: "desc" }]
      : f.sort === "level"
        ? [{ level: "asc" }, { name: "asc" }]
        : [{ name: "asc" }];

  const [items, total] = await Promise.all([
    prisma.exercise.findMany({ where, orderBy, skip, take: limit }),
    prisma.exercise.count({ where }),
  ]);

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getExerciseBySlug(slug: string) {
  return prisma.exercise.findUnique({ where: { slug } });
}

/**
 * Up to 6 alternatives: same bodyPart, different equipment, grouped by
 * equipment type. We fetch a small candidate pool then pick 1–2 per
 * equipment to maximize variety.
 */
export async function getAlternatives(slug: string) {
  const base = await prisma.exercise.findUnique({ where: { slug } });
  if (!base) return null;

  const candidates = await prisma.exercise.findMany({
    where: {
      status: "active",
      slug: { not: base.slug },
      bodyPart: base.bodyPart,
      // "different equipment" = not exactly the same bucket set.
      NOT: { equipment: { equals: base.equipment } },
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
    take: 30,
  });

  const groups = new Map<string, typeof candidates>();
  for (const ex of candidates) {
    const bucket = ex.equipment[0] ?? "other";
    const arr = groups.get(bucket) ?? [];
    if (arr.length < 2) arr.push(ex);
    groups.set(bucket, arr);
  }

  const flat: typeof candidates = [];
  for (const arr of groups.values()) flat.push(...arr);

  return {
    base,
    groups: Array.from(groups.entries()).map(([equipment, exercises]) => ({
      equipment,
      exercises: exercises.slice(0, 2),
    })),
    items: flat.slice(0, 6),
  };
}

export async function getFilterMeta() {
  // Distinct-style aggregation; cheap at ~1k rows.
  const [bodyParts, levels, rows] = await Promise.all([
    prisma.exercise.findMany({
      where: { status: "active" },
      select: { bodyPart: true },
      distinct: ["bodyPart"],
    }),
    prisma.exercise.findMany({
      where: { status: "active" },
      select: { level: true },
      distinct: ["level"],
    }),
    prisma.exercise.findMany({
      where: { status: "active" },
      select: { equipment: true },
    }),
  ]);

  const eqSet = new Set<string>();
  for (const r of rows) for (const e of r.equipment) eqSet.add(e);

  return {
    bodyParts: bodyParts.map((r) => r.bodyPart).sort(),
    equipment: Array.from(eqSet).sort(),
    levels: levels.map((r) => r.level).sort(),
  };
}
