/**
 * Seed script.
 *   - `FoodReference`: generic per-100g nutrition (used by the Phase-1 engine).
 *   - `FoodItem`:     rich per-unit foods incl. Indian cuisine (Feature 1).
 *
 * Run: bun db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// -------- FoodReference (per-100g, generic) --------
type RefSeed = {
  name: string;
  aliases: string[];
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  defaultServingGrams: number;
};

const REFERENCE_FOODS: RefSeed[] = [
  { name: "egg",            aliases: ["eggs", "boiled egg", "fried egg"],     caloriesPer100g: 155, proteinPer100g: 13,  carbsPer100g: 1.1, fatPer100g: 11,  defaultServingGrams: 50 },
  { name: "white rice",     aliases: ["rice", "steamed rice", "boiled rice"], caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28,  fatPer100g: 0.3, defaultServingGrams: 150 },
  { name: "chicken breast", aliases: ["chicken", "grilled chicken"],          caloriesPer100g: 165, proteinPer100g: 31,  carbsPer100g: 0,   fatPer100g: 3.6, defaultServingGrams: 120 },
  { name: "banana",         aliases: ["bananas"],                              caloriesPer100g: 89,  proteinPer100g: 1.1, carbsPer100g: 23,  fatPer100g: 0.3, defaultServingGrams: 120 },
  { name: "apple",          aliases: ["apples"],                               caloriesPer100g: 52,  proteinPer100g: 0.3, carbsPer100g: 14,  fatPer100g: 0.2, defaultServingGrams: 180 },
  { name: "bread",          aliases: ["slice of bread", "toast"],              caloriesPer100g: 265, proteinPer100g: 9,   carbsPer100g: 49,  fatPer100g: 3.2, defaultServingGrams: 30 },
  { name: "milk",           aliases: ["whole milk"],                           caloriesPer100g: 61,  proteinPer100g: 3.2, carbsPer100g: 4.8, fatPer100g: 3.3, defaultServingGrams: 240 },
  { name: "oats",           aliases: ["oatmeal", "porridge"],                  caloriesPer100g: 389, proteinPer100g: 17,  carbsPer100g: 66,  fatPer100g: 7,   defaultServingGrams: 40 },
  { name: "peanut butter",  aliases: ["pb"],                                   caloriesPer100g: 588, proteinPer100g: 25,  carbsPer100g: 20,  fatPer100g: 50,  defaultServingGrams: 16 },
  { name: "pizza slice",    aliases: ["pizza"],                                caloriesPer100g: 266, proteinPer100g: 11,  carbsPer100g: 33,  fatPer100g: 10,  defaultServingGrams: 107 },
  { name: "salad",          aliases: ["green salad", "garden salad"],          caloriesPer100g: 20,  proteinPer100g: 1.4, carbsPer100g: 3.6, fatPer100g: 0.2, defaultServingGrams: 150 },
  { name: "protein shake",  aliases: ["whey protein"],                         caloriesPer100g: 120, proteinPer100g: 24,  carbsPer100g: 3,   fatPer100g: 1,   defaultServingGrams: 300 },
  { name: "coffee",         aliases: ["black coffee"],                         caloriesPer100g: 2,   proteinPer100g: 0.1, carbsPer100g: 0,   fatPer100g: 0,   defaultServingGrams: 240 },
  { name: "burger",         aliases: ["hamburger", "cheeseburger"],            caloriesPer100g: 295, proteinPer100g: 17,  carbsPer100g: 24,  fatPer100g: 14,  defaultServingGrams: 150 },
  { name: "french fries",   aliases: ["fries", "chips"],                       caloriesPer100g: 312, proteinPer100g: 3.4, carbsPer100g: 41,  fatPer100g: 15,  defaultServingGrams: 100 },
];

// -------- FoodItem (per-unit, culturally-correct portioning) --------
type ItemSeed = {
  name: string;
  aliases: string[];
  region: string;
  cuisine: string;
  unitType: string;
  caloriesPerUnit: number;
  protein: number;
  carbs: number;
  fat: number;
  isVeg?: boolean;
};

const FOOD_ITEMS: ItemSeed[] = [
  // -------- South Indian --------
  { name: "dosa",          aliases: ["plain dosa", "sada dosa"],                       region: "South Indian", cuisine: "Indian", unitType: "piece", caloriesPerUnit: 168, protein: 4,  carbs: 29, fat: 4  },
  { name: "masala dosa",   aliases: ["masala dose", "mysore masala dosa"],             region: "South Indian", cuisine: "Indian", unitType: "piece", caloriesPerUnit: 330, protein: 6,  carbs: 50, fat: 11 },
  { name: "idli",          aliases: ["idly", "rice idli", "steamed idli"],             region: "South Indian", cuisine: "Indian", unitType: "piece", caloriesPerUnit: 58,  protein: 2,  carbs: 12, fat: 0.3 },
  { name: "vada",          aliases: ["medu vada", "urad vada"],                        region: "South Indian", cuisine: "Indian", unitType: "piece", caloriesPerUnit: 147, protein: 4,  carbs: 18, fat: 7  },
  { name: "sambar",        aliases: ["sambhar"],                                       region: "South Indian", cuisine: "Indian", unitType: "katori", caloriesPerUnit: 139, protein: 6,  carbs: 21, fat: 3  },
  { name: "coconut chutney", aliases: ["chutney", "white chutney"],                    region: "South Indian", cuisine: "Indian", unitType: "katori", caloriesPerUnit: 110, protein: 2,  carbs: 6,  fat: 9  },

  // -------- North Indian --------
  { name: "roti",          aliases: ["chapati", "chapathi", "phulka"],                 region: "North Indian", cuisine: "Indian", unitType: "piece", caloriesPerUnit: 104, protein: 3,  carbs: 18, fat: 3  },
  { name: "naan",          aliases: ["plain naan", "tandoori naan"],                   region: "North Indian", cuisine: "Indian", unitType: "piece", caloriesPerUnit: 262, protein: 9,  carbs: 45, fat: 5  },
  { name: "paratha",       aliases: ["aloo paratha", "plain paratha"],                 region: "North Indian", cuisine: "Indian", unitType: "piece", caloriesPerUnit: 258, protein: 6,  carbs: 36, fat: 10 },
  { name: "paneer butter masala", aliases: ["paneer masala", "butter paneer"],         region: "North Indian", cuisine: "Indian", unitType: "katori", caloriesPerUnit: 380, protein: 14, carbs: 14, fat: 28 },
  { name: "paneer",        aliases: ["cottage cheese", "paneer tikka"],                region: "North Indian", cuisine: "Indian", unitType: "katori", caloriesPerUnit: 265, protein: 18, carbs: 6,  fat: 20 },
  { name: "dal",           aliases: ["daal", "dhal", "tadka dal", "yellow dal"],       region: "North Indian", cuisine: "Indian", unitType: "katori", caloriesPerUnit: 150, protein: 9,  carbs: 20, fat: 4  },
  { name: "rajma",         aliases: ["kidney bean curry", "rajma chawal (rajma only)"],region: "North Indian", cuisine: "Indian", unitType: "katori", caloriesPerUnit: 220, protein: 12, carbs: 30, fat: 5  },
  { name: "chole",         aliases: ["chickpea curry", "chana masala", "chholey"],     region: "North Indian", cuisine: "Indian", unitType: "katori", caloriesPerUnit: 240, protein: 11, carbs: 30, fat: 8  },
  { name: "biryani",       aliases: ["veg biryani", "chicken biryani", "hyderabadi biryani"], region: "Hyderabadi",  cuisine: "Indian", unitType: "plate", caloriesPerUnit: 500, protein: 18, carbs: 70, fat: 16, isVeg: false },
  { name: "pulao",         aliases: ["pulav", "veg pulao", "jeera rice"],              region: "North Indian", cuisine: "Indian", unitType: "plate", caloriesPerUnit: 320, protein: 6,  carbs: 55, fat: 8  },
  { name: "butter chicken", aliases: ["murgh makhani", "chicken makhani"],             region: "North Indian", cuisine: "Indian", unitType: "katori", caloriesPerUnit: 420, protein: 22, carbs: 12, fat: 30, isVeg: false },
  { name: "samosa",        aliases: ["aloo samosa"],                                   region: "North Indian", cuisine: "Indian", unitType: "piece", caloriesPerUnit: 260, protein: 5,  carbs: 30, fat: 14 },
  { name: "chai",          aliases: ["masala chai", "tea", "indian tea", "cutting chai"], region: "Global",       cuisine: "Indian", unitType: "glass", caloriesPerUnit: 80,  protein: 2,  carbs: 11, fat: 3  },
  { name: "lassi",         aliases: ["sweet lassi", "salted lassi"],                   region: "North Indian", cuisine: "Indian", unitType: "glass", caloriesPerUnit: 260, protein: 7,  carbs: 40, fat: 8  },

  // -------- Global staples (for generic matches) --------
  { name: "sandwich",      aliases: ["veg sandwich"],                                  region: "Global",       cuisine: "Global", unitType: "piece", caloriesPerUnit: 280, protein: 10, carbs: 34, fat: 11 },
  { name: "omelette",      aliases: ["omelet", "masala omelette"],                     region: "Global",       cuisine: "Global", unitType: "piece", caloriesPerUnit: 155, protein: 11, carbs: 2,  fat: 11 },
];

async function main() {
  console.log("Seeding FoodReference…");
  for (const f of REFERENCE_FOODS) {
    await prisma.foodReference.upsert({
      where: { name: f.name },
      update: f,
      create: f,
    });
  }
  console.log(`  ✓ ${REFERENCE_FOODS.length} reference foods`);

  console.log("Seeding FoodItem (Indian food intelligence)…");
  for (const item of FOOD_ITEMS) {
    await prisma.foodItem.upsert({
      where: { name: item.name },
      update: item,
      create: item,
    });
  }
  console.log(`  ✓ ${FOOD_ITEMS.length} food items`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
