# Project Rules

- Read `docs/STATUS.md` first, then only the PRD section needed for the assigned milestone.
- Use Next.js App Router, TypeScript strict mode, Supabase, and server-first patterns.
- Keep business logic in `src/server` services/DAL; UI must not own authorisation.
- All exposed tables require RLS and RLS tests.
- Never expose Supabase secret/service credentials to the client.
- Use Zod at mutation boundaries and return `ActionResult<T>`.
- Prefer Server Components; add Client Components only for interaction.
- Use existing components and patterns before adding dependencies.
- Do not edit unrelated files or reformat the whole repository.
- Before finishing run the smallest relevant tests, then lint/typecheck/build when milestone scope requires it.
- Update `docs/STATUS.md` concisely: files changed, tests, remaining issue, exact next task.
- If requirements conflict or a security decision is ambiguous, stop and ask one focused question.

## Commands

```bash
npm run dev          # local dev server
npm run verify       # lint + typecheck + test + build (run before every handoff)
npm run test         # vitest unit tests
npm run test:e2e     # playwright
npm run db:apply     # apply migrations to the remote project (PGPASSWORD required)
npm run db:types     # regenerate src/types/database.ts (PGPASSWORD required)
npm run db:rls       # 52 RLS probes against the live database
```

## Architecture invariants

These are not style preferences. Breaking one is a defect.

1. **Three Supabase clients, three purposes.**
   - `lib/supabase/server.ts` — request-scoped, carries the session, subject to RLS. Use for anything user-specific.
   - `lib/supabase/public.ts` — cookie-free `anon` client. Use for genuinely public data so the route can stay statically cached. Reading cookies opts a route out of static rendering.
   - `lib/supabase/admin.ts` — service role, **bypasses RLS**. Only cron handlers, webhooks, and `src/server/jobs`. Never import it from a component or a UI-reachable Server Action.

2. **RLS is the security boundary.** `requireUser`/`requireAdmin` in `server/policies/require.ts` exist to give humans a sensible redirect. They are not authorisation. Every mutation independently re-checks with `assertPermission` / `assertVendorCapability`.

3. **The permission catalogue is mirrored in SQL.** `lib/permissions/catalogue.ts` and the `vendor_can()` function in migration `0004` encode the same matrix. Change one, change the other, and update `tests/permissions.test.ts`.

4. **Migrations are the schema truth.** Never hand-edit `src/types/database.ts` — regenerate it. Never edit an already-applied migration; add a new one.

5. **Money is integer minor units + ISO currency.** Never a float. Use `lib/money`.

6. **Public pages read approved snapshots only.** A draft, pending, or rejected row must never reach a public route.

7. **Server Actions return `ActionResult<T>`** via `runAction()`, which maps errors to safe codes. Raw database or provider errors must never reach a user.

## Where things live

```
src/app/(public)      public, indexable, cached
src/app/(auth)        sign-in, sign-up, OAuth callback
src/app/(customer)    /account/* — dynamic, noindex
src/app/vendor-dashboard  vendor workspace — dynamic, noindex
src/app/admin         admin workspace — dynamic, noindex
src/features/*        domain logic and schemas, framework-light
src/server/dal        all database reads
src/server/services   mutations and business rules
src/server/policies   authorisation guards
src/lib/*             cross-cutting utilities
supabase/migrations   schema truth, applied in filename order
```

## Gotchas

- Node 20.18 cannot `require()` ESM. `jsdom` is pinned to v26 and `vitest` to v3 for this reason. On Node ≥ 20.19 both can be raised — see `docs/DECISIONS.md`.
- `src/types/database.ts` is GENERATED — never hand-edit it. Regenerate with `PGPASSWORD=... npm run db:types` (talks to Postgres directly; no Docker needed).
- Embedded selects need an FK hint when a table has two FKs to the same target, e.g. `profiles!reviews_customer_id_fkey(full_name)`. Without it PostgREST returns HTTP 300 at runtime, which typecheck alone will not catch.
- View columns are all typed `| null` (Postgres cannot report view nullability). Narrow once at the DAL, not in components — see ADR-010.
- After publishing a vendor, call `refresh_vendor_search_text(vendorId)`. The search triggers fire per child-table write, so a vendor created in one pass has incomplete search text until refreshed.
- Route stubs rendering `MilestonePlaceholder` are intentional and must be replaced in the milestone named on each one. They must not ship to production.
