# CalAI — AI Calorie Tracker (Turborepo + Bun)

AI-powered calorie tracker inspired by [calai.app](https://www.calai.app/). Log meals via free-text (NLP), photos (OpenAI Vision), or structured entry. Get daily macro breakdowns, trends, and AI insights.

## Stack

- **Monorepo**: Turborepo + Bun workspaces
- **Web**: Next.js 15 App Router + Tailwind + Zustand + Recharts
- **API**: Bun + Hono + Zod
- **DB**: PostgreSQL + Prisma
- **Auth**: Google OAuth + JWT (via `jose`)
- **AI**: OpenAI `gpt-4o-mini` (vision + NLP + insights)

## Structure

```
gymapp/
├── apps/
│   ├── api/         # Bun + Hono REST API
│   └── web/         # Next.js 15 frontend
├── packages/
│   ├── config/      # shared tsconfig + eslint
│   ├── db/          # Prisma schema + singleton client
│   └── ui/          # shared React components
├── turbo.json
├── bunfig.toml
└── package.json
```

## Quickstart

```bash
# 1. install (Bun + workspaces)
bun install

# 2. copy env and fill in values
cp .env.example .env

# 3. create DB + seed reference foods
bun db:push
bun db:seed

# 4. dev — runs api (4000) + web (3000) in parallel
bun dev
```

Open <http://localhost:3000>. Use **Dev sign in** (no Google needed) to try the app locally.

## Required env vars

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres (Neon / Supabase / local) |
| `JWT_SECRET` | yes | ≥16 chars, random |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Google login | Get from Google Cloud Console |
| `OPENAI_API_KEY` | for AI vision + insights | App gracefully degrades without it |
| `WEB_URL` | yes | CORS + OAuth redirect target |
| `NEXT_PUBLIC_API_URL` | yes (web) | e.g. `http://localhost:4000` |

## Scripts

```bash
bun dev               # run everything (turbo)
bun build             # build all apps
bun test              # run all tests (bun:test)
bun typecheck         # tsc across the monorepo
bun lint              # eslint across the monorepo

bun db:generate       # prisma generate
bun db:push           # sync schema to DB (dev)
bun db:migrate        # create a migration
bun db:seed           # seed reference foods
bun db:studio         # open Prisma Studio
```

## Feature phases

- **Phase 1 (MVP, implemented)**: Google + dev auth, text meal input, rule-based NLP parser, nutrition engine with seed DB + fallback, daily dashboard, meal history, macro tracking, edit/delete, unit tests.
- **Phase 2 (implemented)**: Image upload with client-side compression, OpenAI Vision food recognition, macro editing.
- **Phase 3 (implemented)**: AI insights engine (LLM + deterministic fallback), weekly analytics charts (Recharts).
- **Phase 4 (scaffolded)**: Personalized daily goals via `PATCH /user/goals`; barcode + smart meal memory are natural extensions on top of `FoodReference`.

## API surface

```
POST   /auth/dev-login            dev-only
GET    /auth/google               OAuth redirect
GET    /auth/google/callback      token → redirect to web
GET    /auth/me                   current user

PATCH  /user/goals                update macro goals

GET    /meals?date=YYYY-MM-DD     list meals
GET    /meals/today               today + totals
POST   /meals/text                create from free text (parser+nutrition)
POST   /meals                     create from structured entries
PATCH  /meals/:id                 edit meal
PATCH  /meals/:id/entries/:eid    edit a food entry (user corrects AI)
DELETE /meals/:id                 delete

POST   /ai/parse-text             preview NLP parse + nutrition
POST   /ai/recognize              image → food items (vision)
GET    /ai/insights               daily insights (AI or baseline)

GET    /analytics/weekly?weeks=N  daily series + avgs
```

## Edge cases handled

- **Incorrect AI predictions** → every entry is editable on the add/upload pages.
- **Unknown foods** → nutrition engine falls back from exact → alias → fuzzy (Levenshtein ≤ 2) → category-keyword fallback.
- **Large images** → `compressImageToDataUrl` downscales to 1024px + JPEG q=0.85 before upload.
- **Missing AI key** → endpoints degrade: text parse uses rule-based only; insights use deterministic baseline; vision endpoint returns 503 with a friendly error the UI surfaces.

## Deployment

- **Web** → Vercel (`apps/web`)
- **API** → Railway / Render with Bun runtime (`bun run dist/server.js` after `bun build`)
- **DB** → Neon or Supabase Postgres

## Testing

```bash
cd apps/api && bun test
```

Covers rule-based parsing (`food-parser.service`) and pure unit-to-grams / calorie math used by the nutrition engine.
