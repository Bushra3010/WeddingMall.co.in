# WeddingMall

A wedding-vendor marketplace: couples discover, compare, shortlist, and enquire; vendors manage listings, packages, and leads; administrators operate verification, moderation, taxonomy, and billing.

Built to `docs/PRD.md`. Next.js App Router · TypeScript · Supabase · Vercel.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev
```

`.env.local` already points at a live Supabase project with the schema applied and demo data seeded, so the app works immediately.

To point at a different project, set the values in `.env.local`, then:

```bash
PGPASSWORD=<db-password> npm run db:apply
PGPASSWORD=<db-password> npm run db:seed
PGPASSWORD=<db-password> npm run db:types
npm run db:rls
node --env-file=.env.local scripts/seed-demo-vendors.mjs
```

These talk to Postgres directly, so **Docker is not required** (see ADR-009).

## Commands

| Command            | Purpose                                 |
| ------------------ | --------------------------------------- |
| `npm run dev`      | development server                      |
| `npm run verify`   | lint + typecheck + test + build         |
| `npm run test`     | unit tests (Vitest)                     |
| `npm run test:e2e` | end-to-end tests (Playwright)           |
| `npm run db:apply` | apply migrations to the remote project  |
| `npm run db:rls`   | 52 RLS probes against the live database |
| `npm run db:types` | regenerate database types               |

## Where to start reading

| File                | What it tells you                                  |
| ------------------- | -------------------------------------------------- |
| `docs/STATUS.md`    | what is done, what is blocked, the exact next task |
| `CLAUDE.md`         | architecture invariants and coding rules           |
| `docs/DECISIONS.md` | why things are the way they are                    |
| `docs/DB.md`        | schema, RLS posture, storage layout                |
| `docs/PRD.md`       | the full specification                             |

## Current state

Foundation and public discovery are built and **verified against a live Supabase project**:

|                          |                                                |
| ------------------------ | ---------------------------------------------- |
| Migrations               | 7/7 applied clean                              |
| Schema                   | 57 tables, 105 RLS policies, 4 storage buckets |
| RLS probes               | 52 passed (`npm run db:rls`)                   |
| Unit tests               | 55 passed                                      |
| Lint / typecheck / build | pass                                           |

Eight fictional demo vendors are seeded, so search, filtering, and vendor profiles work end to end.

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
