# WeddingMall

A wedding-vendor marketplace: couples discover, compare, shortlist, and enquire; vendors manage listings, packages, and leads; administrators operate verification, moderation, taxonomy, and billing.

Built to `docs/PRD.md`. Next.js App Router · TypeScript · Supabase · Vercel.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev
```

The app runs without a database — public pages render their empty states rather than erroring. To get real data you need Supabase running locally:

```bash
supabase start
npm run db:reset             # applies migrations + fictional seed data
npm run db:types             # regenerates src/types/database.ts
```

Install the CLI with `brew install supabase/tap/supabase` (Docker required).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | development server |
| `npm run verify` | lint + typecheck + test + build |
| `npm run test` | unit tests (Vitest) |
| `npm run test:e2e` | end-to-end tests (Playwright) |
| `npm run db:reset` | re-apply migrations and seed |
| `npm run db:types` | regenerate database types |

## Where to start reading

| File | What it tells you |
|---|---|
| `docs/STATUS.md` | what is done, what is blocked, the exact next task |
| `CLAUDE.md` | architecture invariants and coding rules |
| `docs/DECISIONS.md` | why things are the way they are |
| `docs/DB.md` | schema, RLS posture, storage layout |
| `docs/PRD.md` | the full specification |

## Current state

Foundation and public discovery are built and verified: lint, typecheck, 55 unit tests, and build all pass. The full database schema is written but **has not yet been executed against a real Postgres** — that is the next task, and `docs/STATUS.md` explains why.

Routes that render a "scheduled for Milestone N" placeholder are intentional. They exist so the information architecture is navigable; each names the milestone that replaces it.

## Project layout

```
src/app/(public)          public, indexable, cached
src/app/(auth)            sign-in, sign-up, OAuth callback
src/app/(customer)        /account/*
src/app/vendor-dashboard  vendor workspace
src/app/admin             admin workspace
src/features/*            domain logic and schemas
src/server/dal            database reads
src/server/services       mutations
src/server/policies       authorisation guards
src/lib/*                 utilities (env, supabase, permissions, money, dates, seo)
supabase/migrations       schema truth
```

## Security notes

- Row Level Security is enabled on every table and is the real authorisation boundary. Route guards only produce a sensible redirect.
- The service-role key bypasses RLS and is confined to cron handlers, webhooks, and background jobs.
- Seed data is entirely fictional. Legal text is placeholder and requires counsel review before launch.
