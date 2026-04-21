# calorieX — AI Calorie Tracker (Turborepo + Bun)

AI-powered calorie tracker. Log meals via free-text (NLP), photos (OpenAI Vision), or structured entry. Get daily macro breakdowns, trends, and AI insights.

## Stack

- **Monorepo**: Turborepo + Bun workspaces
- **Web**: Next.js 15 App Router + Tailwind + Zustand + Recharts
- **API**: Bun + Hono + Zod
- **DB**: PostgreSQL + Prisma
- **Auth**: Google OAuth + JWT (via `jose`)
- **AI**: OpenAI `gpt-4o-mini` (vision + NLP + insights)



## Quickstart

```bash
# 1. install (Bun + workspaces)
bun install

# 2. copy env and fill in values
cp .env.example .env

# 3. start local Postgres (Docker)
bun db:up

# 4. create schema + seed reference foods
bun db:push
bun db:seed

# 5. dev — runs api (4000) + web (3000) in parallel
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

bun db:up             # start local Postgres (Docker)
bun db:down           # stop Postgres (keeps data volume)
bun db:reset          # nuke volume + restart (destructive)
bun db:logs           # follow Postgres logs
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

## Testing

```bash
cd apps/api && bun test
```

