/**
 * Personalized Exercise Library — seed/import script.
 *
 * Auto-fetches the free-exercise-db dataset at runtime:
 *   https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
 *
 * Normalizes equipment + primary muscle → bodyPart, derives boolean flags,
 * slugifies names, dedupes, and upserts safely (rerunnable).
 *
 * Run from repo root:   bun run db:seed:exercises
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

// --- Raw record shape (from free-exercise-db) ---
interface RawExercise {
  id?: string;
  name: string;
  force?: string | null;
  level?: string | null;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string;
  images?: string[];
}

// ---------- normalization ----------

/** URL-friendly slug: lowercase, non-alphanum → "-", trimmed. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Raw equipment → normalized bucket (returned as single-element array). */
function normalizeEquipment(raw: string | null | undefined): string[] {
  if (!raw) return ["bodyweight"];
  const r = raw.toLowerCase().trim();

  if (["body only", "none", "no equipment"].includes(r)) return ["bodyweight"];
  if (["dumbbell", "dumbbells"].includes(r)) return ["dumbbell"];
  if (["barbell", "ez curl bar"].includes(r)) return ["barbell"];
  if (r === "kettlebell") return ["kettlebell"];
  if (["cable", "cable machine", "cable station"].includes(r)) return ["cable"];
  if (["machine", "selectorized", "leverage"].some((k) => r.includes(k))) return ["machine"];
  if (r.includes("smith")) return ["smith machine"];
  if (["bands", "band", "resistance band"].some((k) => r.includes(k))) return ["bands"];
  if (r.includes("medicine ball")) return ["medicine ball"];
  if (r.includes("foam roll")) return ["foam roller"];
  if (r === "other" || r === "exercise ball") return [r];
  return [r]; // keep unknown raw as-is so nothing is lost
}

/** Raw primary muscle → normalized bodyPart. */
function muscleToBodyPart(raw: string | undefined): string {
  if (!raw) return "full body";
  const m = raw.toLowerCase().trim();
  if (m.includes("bicep")) return "biceps";
  if (m.includes("tricep")) return "triceps";
  if (m.includes("chest") || m.includes("pector")) return "chest";
  if (m.includes("shoulder") || m.includes("delt")) return "shoulders";
  if (
    m.includes("lat") ||
    m.includes("middle back") ||
    m.includes("rhomboid") ||
    m.includes("trap") ||
    m.includes("lower back")
  )
    return "back";
  if (
    m.includes("quad") ||
    m.includes("hamstring") ||
    m.includes("glute") ||
    m.includes("calv") ||
    m.includes("adductor") ||
    m.includes("abductor") ||
    m.includes("hip")
  )
    return "legs";
  if (m.includes("abs") || m.includes("oblique") || m.includes("core")) return "core";
  if (m.includes("forearm")) return "forearms";
  if (m.includes("neck")) return "shoulders";
  return "full body";
}

/** Upgrade "expert" → "advanced" for display consistency. */
function normalizeLevel(raw: string | null | undefined): string {
  const l = (raw ?? "beginner").toLowerCase();
  if (l === "expert") return "advanced";
  return l;
}

function deriveFlags(equipment: string[]) {
  const set = new Set(equipment);
  return {
    isBodyweight: set.has("bodyweight"),
    isMachine: set.has("machine") || set.has("smith machine"),
    isFreeWeight: set.has("dumbbell") || set.has("barbell") || set.has("kettlebell"),
    isCable: set.has("cable"),
    isBands: set.has("bands"),
  };
}

// ---------- main ----------

async function main() {
  console.log(`[seed:exercises] fetching ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Failed to fetch dataset (HTTP ${res.status})`);
  const raw: RawExercise[] = await res.json();
  console.log(`[seed:exercises] fetched ${raw.length} exercises`);

  let normalized = 0;
  let skipped = 0;
  const bySlug = new Map<string, ReturnType<typeof toRecord>>();

  function toRecord(r: RawExercise) {
    if (!r?.name || !r?.category) return null;
    const slug = slugify(r.name);
    if (!slug) return null;

    const equipment = normalizeEquipment(r.equipment ?? null);
    const flags = deriveFlags(equipment);
    const primaryMuscles = (r.primaryMuscles ?? []).map((m) => m.toLowerCase());
    const secondaryMuscles = (r.secondaryMuscles ?? []).map((m) => m.toLowerCase());
    const bodyPart =
      r.category?.toLowerCase() === "cardio"
        ? "cardio"
        : muscleToBodyPart(primaryMuscles[0]);

    const images = (r.images ?? []).map((p) =>
      p.startsWith("http") ? p : `${IMAGE_BASE}${p}`,
    );

    return {
      slug,
      name: r.name,
      aliases: [] as string[],
      category: r.category.toLowerCase(),
      level: normalizeLevel(r.level),
      force: r.force?.toLowerCase() || null,
      mechanic: r.mechanic?.toLowerCase() || null,
      primaryMuscles,
      secondaryMuscles,
      equipment,
      bodyPart,
      instructions: (r.instructions ?? []).filter((s) => s?.trim()).map((s) => s.trim()),
      tips: [] as string[],
      images,
      videoUrl: null as string | null,
      ...flags,
      sourceName: "free-exercise-db",
      status: "active",
    };
  }

  for (const r of raw) {
    const rec = toRecord(r);
    if (!rec) {
      skipped++;
      continue;
    }
    normalized++;
    // Dedup by slug — keep the first occurrence.
    if (!bySlug.has(rec.slug)) bySlug.set(rec.slug, rec);
  }

  console.log(
    `[seed:exercises] normalized=${normalized} skipped=${skipped} unique=${bySlug.size}`,
  );

  let upserted = 0;
  for (const rec of bySlug.values()) {
    if (!rec) continue;
    await prisma.exercise.upsert({
      where: { slug: rec.slug },
      create: rec,
      update: {
        // Only fields that can legitimately drift on re-imports:
        name: rec.name,
        category: rec.category,
        level: rec.level,
        force: rec.force,
        mechanic: rec.mechanic,
        primaryMuscles: rec.primaryMuscles,
        secondaryMuscles: rec.secondaryMuscles,
        equipment: rec.equipment,
        bodyPart: rec.bodyPart,
        instructions: rec.instructions,
        images: rec.images,
        isBodyweight: rec.isBodyweight,
        isMachine: rec.isMachine,
        isFreeWeight: rec.isFreeWeight,
        isCable: rec.isCable,
        isBands: rec.isBands,
        status: rec.status,
      },
    });
    upserted++;
    if (upserted % 100 === 0) console.log(`[seed:exercises] upserted ${upserted}…`);
  }

  console.log(`[seed:exercises] done. upserted=${upserted}`);
}

main()
  .catch((err) => {
    console.error("[seed:exercises] failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
