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

---

## ADR-012 — Onboarding deadlock: three policy gaps in migration 0004

**Date:** 2026-07-31 · **Status:** accepted, fixed in 0008

Vendor onboarding was impossible as originally written. Three separate gaps compounded:

1. **The owner could not read back the vendor they had just created.** `vendors` had SELECT policies for "active vendors" and "is a member" only. A freshly created vendor is `draft` and has no members, so the INSERT succeeded but PostgREST returned 403 on the `Prefer: return=representation` read-back.
2. **Membership bootstrap recursion.** `vendor_memberships` was writable only by someone holding `team.manage`, which is resolved _from_ `vendor_memberships`. The first owner membership could never exist.
3. **No admin write path.** `vendors` and `vendor_listings` had UPDATE policies for members only, so approve/reject/suspend were impossible for anyone.

**Lesson worth keeping:** deny-by-default RLS makes bootstrap steps invisible until you execute the flow. Reading the policies did not reveal this; running the sequence did. Every new flow should get a probe that walks it from a cold start, not just per-table permission checks.

The bootstrap policy is deliberately narrow — the caller must already be `vendors.owner_user_id`, the role must be `vendor_owner`, and the unique `(vendor_id, user_id)` constraint stops replay. `scripts/rls-onboarding-probe.mjs` asserts an outsider cannot use it to join someone else's business.

---

## ADR-013 — Admins could not see what they were approving

**Date:** 2026-07-31 · **Status:** accepted, fixed in 0010

Found by driving the real admin UI, not by any API probe: the verification queue rendered "Category: —" for a pending submission.

`vendor_categories`, `vendor_service_areas`, `vendor_packages`, `vendor_media`, and `vendor_attribute_values` each had exactly two policies — public read (requires `status = 'active'`) and member write. A pending vendor is not active, and an admin is not a member, so **an admin was being asked to approve a listing whose contents were invisible to them.**

Fixed by adding admin SELECT policies gated on `vendor.read`. This is business content, not PII: contact details stay behind `user.support` and verification documents behind `vendor.verify`.

**Why the probes missed it:** they seeded fixtures with the service-role client and then asserted _denial_ for unauthorised readers. Nothing asserted that an authorised reader could actually see the data. The probe suite now checks both directions, and this case has a named regression guard.

---

## ADR-014 — Two more generator defects, found by real schema

**Date:** 2026-07-31 · **Status:** accepted

Migration 0008 exposed two bugs in `scripts/gen-types.mjs` (ADR-009):

- **Partial unique indexes were treated as one-to-one.** `vendor_categories` has `unique (vendor_id) where is_primary`. The one-to-one check saw a single-column unique index covering the FK and typed the embed as an object, so `.find()` on the array failed to compile. A partial index constrains only the rows matching its predicate, so `i.indpred is null` is now required.
- **Array columns degraded to `unknown[]`.** Postgres reports `text[]` with `udt_name = '_text'`. The leading underscore is now stripped to resolve the element type, so `languages` types as `string[]`.

Both were caught by typecheck rather than at runtime, which is the argument for generating real types rather than keeping a loose placeholder.

---

## ADR-015 — `vendor_listings` is the draft; versions are what the public sees

**Date:** 2026-08-01 · **Status:** accepted

Before migration 0011, `public_vendors` joined `vendor_listings` directly, so any edit a vendor made to an approved listing went live instantly with no re-moderation. `vendor_listing_versions` existed in the schema from 0004 but was never written to. PRD 6.9 requires the opposite: "preserve currently published version until update approval."

**Decision:**

- `vendor_listings` is the working **draft**. Its `status` tracks the review state of the latest submission.
- `vendor_listing_versions` holds immutable snapshots. The newest `approved` row is the public surface.
- `submit_listing_for_review()` snapshots the draft into a new version; `moderate_listing_version()` approves it and archives the one it replaces.

Two details worth remembering:

- **`vendor_id` is denormalised onto versions.** The public view must not join `vendor_listings` to reach a version — that table's policy requires `status = 'approved'`, so a vendor with a pending edit would make their own published page vanish.
- **Search indexes the published snapshot,** not the draft. Otherwise unreviewed text stays findable even though the page does not show it.

The backfill in 0011 creates version 1 for every already-published listing; without it, switching the view over would have unpublished every live vendor at once.

---

## ADR-016 — A root `loading.tsx` turned every 404 into a soft 200

**Date:** 2026-08-01 · **Status:** accepted, security/SEO-relevant

`src/app/loading.tsx` wrapped **every** route in an implicit Suspense boundary. Next therefore began streaming the shell immediately, and once the first bytes are flushed the HTTP status can no longer be set. Consequences:

- `notFound()` returned **HTTP 200** carrying the not-found page — a soft 404, which search engines index. Directly contrary to PRD 11.1.
- `permanentRedirect()` degraded to an HTTP 200 with a meta-refresh, so slug redirects never produced a 308.

**Decision:** delete the root `loading.tsx`. Streaming skeletons belong at the segment that actually needs them — the search pages already wrap `SearchResults` in an explicit `<Suspense>`, which is the right granularity. The root file was also wrong on its own terms: it rendered vendor-card skeletons over the sign-in page.

**Rule going forward:** a `loading.tsx` at a segment makes every `notFound()` and `redirect()` below it lose its status code. Do not add one above a route that needs either.

---

## ADR-017 — Slug redirects are raised in `generateMetadata`

**Date:** 2026-08-01 · **Status:** accepted

Even after ADR-016, raising the redirect inside the page component is fragile: it runs after the shell has begun rendering. `generateMetadata` resolves _before_ the response starts, so a redirect raised there reliably produces a real 308.

**Decision:** each public route resolves a renamed slug in `generateMetadata` and keeps the same check in the component as a fallback. Redirects are recorded by a trigger (0012) that also repoints existing entries, so renaming A→B then B→C leaves A→C rather than a chain.

Next emits **308**, not the 301 the PRD names. Both are permanent and search engines treat them identically; 308 additionally preserves the request method. Recorded rather than worked around.

---

## ADR-018 — Category attributes: input type drives data type

**Date:** 2026-08-01 · **Status:** accepted

`search_vendors` matches attribute filters against the **shape** of the stored `value_json` — a `multiselect` stores an array, a `select` stores a string. If an admin could pick input type and data type independently, a mismatch would silently produce a filter that never matches.

**Decision:** the admin form exposes one "Answer type" control and derives `data_type` from it. Filter semantics are OR within an attribute code and AND across codes, which is what a shopper expects from faceted search.

**Known gap:** numeric attributes are stored and matched as exact values. Range filtering ("capacity ≥ 400") needs a `attributeRanges` parameter in `search_vendors`; the seeded numeric attributes are currently only usable as exact matches.
