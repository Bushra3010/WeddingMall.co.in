# Architecture Decision Record

Short entries, newest last. One decision per heading.

---

## ADR-001 — Pinned package versions

**Date:** 2026-07-31 · **Status:** accepted

PRD 22 requires pinning mutually compatible current stable versions at implementation start.

| Package               | Version | Note                                           |
| --------------------- | ------- | ---------------------------------------------- |
| next                  | 16.2.12 | App Router, React Server Components            |
| react / react-dom     | 19.2.4  |                                                |
| typescript            | ^5      | `strict: true`                                 |
| tailwindcss           | ^4      | CSS-first config via `@theme`                  |
| @supabase/supabase-js | ^2.111  |                                                |
| @supabase/ssr         | ^0.12   | cookie-based SSR sessions                      |
| zod                   | ^4.4    | note: v4 API (`z.email()`, `z.flattenError()`) |
| react-hook-form       | ^7.83   |                                                |
| vitest                | **^3**  | see ADR-002                                    |
| jsdom                 | **^26** | see ADR-002                                    |
| @playwright/test      | ^1.62   |                                                |

---

## ADR-002 — Test tooling pinned below latest for Node 20.18

**Date:** 2026-07-31 · **Status:** accepted, revisit on Node upgrade

The build machine runs Node 20.18.1, which cannot `require()` an ES module — that landed in Node 20.19. Latest Vitest (v4) and jsdom (v30) both pull ESM-only transitive dependencies through a CJS require path and fail at startup.

**Decision:** pin `vitest@^3` and `jsdom@^26`. CI runs Node 22, so this is a local-machine constraint, not a product one.

**Revisit when:** the development machine moves to Node ≥ 20.19. Then `npm i -D vitest@latest jsdom@latest` should just work; re-run `npm run test` to confirm.

**Also:** dropped `vite-tsconfig-paths` (ESM-only) and declared the `@/*` alias directly in `vitest.config.ts`. One fewer dependency; keep it in step with `tsconfig.json` `paths`.

---

## ADR-003 — Three Supabase clients, deliberately separate

**Date:** 2026-07-31 · **Status:** accepted

PRD 8.3 wants public discovery pages cached, and PRD 10.1 forbids service credentials in the browser. A single client cannot satisfy both.

- `lib/supabase/server.ts` — request-scoped, reads cookies, carries the session, subject to RLS.
- `lib/supabase/public.ts` — **cookie-free** `anon` client for public data.
- `lib/supabase/admin.ts` — service role, bypasses RLS, server-jobs only.

The public client exists because _touching cookies opts a Next.js route out of static rendering_. The first build had every public page rendering dynamically purely because the footer read taxonomy through the session client. Splitting the client fixed the cause rather than the symptom. It grants nothing a logged-out visitor lacks — RLS still applies as `anon`.

---

## ADR-004 — Permission catalogue duplicated in TypeScript and SQL

**Date:** 2026-07-31 · **Status:** accepted, with a known cost

PRD 4.4 requires a permission catalogue; PRD 10 requires enforcement in RLS rather than only in the UI. RLS policies are SQL and cannot import TypeScript.

**Decision:** encode the matrix twice — `src/lib/permissions/catalogue.ts` for server services and UI affordances, and `public.vendor_can()` / `public.has_admin_permission()` in migration `0004`/`0002` for RLS.

**Cost:** they can drift. Mitigations: both files carry a pointer to the other, and `tests/permissions.test.ts` locks the TypeScript side. **A database-level test asserting the two agree is still outstanding** and should be written with the RLS harness.

**Rejected alternative:** generating the SQL from the TypeScript. More machinery than a 5-role matrix justifies at this stage.

---

## ADR-005 — Rating uses Bayesian shrinkage in ranking

**Date:** 2026-07-31 · **Status:** accepted

PRD 6.2 specifies `0.15 * rating_confidence` but does not define the term. A raw average lets a single 5-star review outrank a long track record.

**Decision:** `rating_confidence = (rating_average / 5) * (rating_count / (rating_count + 10))`. The constant 10 is the prior weight — tune once real distribution data exists.

This affects ranking only. It never alters the displayed rating, which is the plain average of approved reviews, per PRD 6.2 ("paid boost may change visibility but never rating").

---

## ADR-006 — `search_vendors` is SECURITY DEFINER

**Date:** 2026-07-31 · **Status:** accepted, security-relevant

Anonymous visitors must be able to search, and the ranking query joins several tables whose RLS would otherwise have to be permissive for `anon`.

**Decision:** `search_vendors(jsonb)` runs `SECURITY DEFINER` with a pinned empty `search_path`, and its `WHERE` clause hard-restricts to `vendors.status = 'active'` joined to an `approved` listing. It projects only public columns.

**This is a deliberate RLS bypass and therefore a review-sensitive function.** Any change to it must be re-reviewed against PRD 10.1. It must never gain a parameter that lets a caller widen the row set beyond active/approved.

---

## ADR-007 — Full schema written in Milestone 1, features still gated

**Date:** 2026-07-31 · **Status:** accepted

PRD 18 sequences features by milestone. The data model in PRD 9, however, is fully specified up front, and writing it in fragments would mean repeatedly altering tables that later migrations depend on.

**Decision:** write all of PRD 9 as migrations `0001`–`0007` now; keep _features_ strictly milestone-gated. Tables exist ahead of the UI that fills them.

**Outcome:** all seven applied cleanly against the live project on the first run (2026-07-31). Verified by 52 RLS probes — see `docs/STATUS.md`.

---

## ADR-008 — Route stubs instead of missing routes

**Date:** 2026-07-31 · **Status:** accepted, temporary

Every route in PRD 5 exists, but unimplemented ones render `MilestonePlaceholder`, naming the milestone and PRD section that replaces them.

**Rationale:** the information architecture is navigable and link-checkable from day one, and a stub is honest where a half-built screen would imply working functionality.

**Exit criterion:** zero `MilestonePlaceholder` imports before production launch. Grep for it in the launch checklist.

---

## ADR-009 — Custom type generator instead of `supabase gen types`

**Date:** 2026-07-31 · **Status:** accepted

`supabase gen types typescript` runs its introspection inside a container, so it needs Docker even when given `--db-url`. Docker is not available on this machine, which made `npm run db:types` permanently unusable.

**Decision:** `scripts/gen-types.mjs` introspects Postgres directly over the same pooler connection the app uses, emitting Row/Insert/Update, Relationships, views, enums, and function stubs.

Relationships matter: they are what lets supabase-js type an embedded `select('a, other(b)')`. Two subtleties cost a debugging cycle each and are worth remembering:

- `array_agg` over `name`-typed catalog columns returns an unparsed string to node-pg. Cast to `::text[]`.
- `isOneToOne` must compare the unique index key columns to the FK columns for **equality**, not containment. Containment marks any FK covered by a wider unique index as one-to-one, which mistypes embedded arrays as single objects.

**Known gap:** function `Args`/`Returns` are emitted loosely (`{ [key: string]: unknown }` / `unknown`). `search_vendors` is therefore still typed by hand in `server/dal/search.ts`, which is acceptable because that file is the deliberate adapter boundary (ADR-006, PRD 11.3).

**Revisit when:** Docker is available, or Supabase ships a container-free generator. Compare output before switching.

---

## ADR-010 — View columns are typed nullable; narrow at the DAL

**Date:** 2026-07-31 · **Status:** accepted

Postgres does not report reliable nullability for view columns, so the generator widens every `public_vendors` column to `| null`. Propagating that through the UI would mean null checks on `display_name` in a dozen places.

**Decision:** narrow once in `getPublicVendor` with a runtime guard. `id`, `slug`, and `display_name` are NOT NULL on `vendors` and are not outer-joined by the view, so a null there means the view definition changed — the DAL logs and returns null, and the page 404s rather than rendering a half-built profile.

**Rejected alternative:** asserting with `!`. That would hide a genuine schema regression instead of surfacing it.

---

## ADR-011 — Demo vendors seeded by script, not seed.sql

**Date:** 2026-07-31 · **Status:** accepted

Vendors need `owner_user_id` referencing `auth.users`, and only the Auth admin API can create those rows — plain SQL cannot.

**Decision:** `supabase/seed.sql` covers taxonomy, plans, CMS, and templates. `scripts/seed-demo-vendors.mjs` creates eight fictional vendors with owners, memberships, approved listings, service areas, and packages.

Demo rows are tagged with `suspended_reason = 'demo-seed'` and owner emails end in `@demo.weddingmall.test`, so `--clean` removes exactly the demo set and nothing else. **That tag is a deliberate misuse of a product column for fixture bookkeeping** — before launch, either add a proper `is_demo` column or drop the demo data entirely.

The script also calls `refresh_vendor_search_text()` explicitly: the search triggers fire on listing/category/package writes, which happen before all of a vendor's child rows exist, so the trigger-maintained text would otherwise be incomplete on first insert. **Real onboarding must call the same refresh after publishing** — this is a live foot-gun for Milestone 3, not just a seeding detail.
