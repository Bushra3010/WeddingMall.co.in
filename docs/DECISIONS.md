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

---

## ADR-019 — The enquiry lifecycle is enforced by triggers, not by services

**Date:** 2026-08-01 · **Status:** accepted, security-relevant

`enquiries: participant update` (migration 0005) lets a participant write the row, and RLS is row-level, not column-level. So a customer could `PATCH status='booked'` straight through PostgREST and skip the transition map entirely — the service layer would never see it. PRD 6.6 requires transitions to be validated server-side, and the service layer alone does not satisfy that when the table is directly writable.

**Decision:** a `BEFORE UPDATE OF status` trigger validates every transition against `public.enquiry_transitions`, and an `AFTER UPDATE OF status` trigger writes the `enquiry_events` row. Both hold no matter which path performs the write.

The reason travels through `set_config('app.transition_reason', …, true)` — transaction-scoped, because the reason belongs to the event, not to the enquiry row.

Service-role callers (jobs, webhooks) run without a JWT and are allowed through; they are trusted by construction.

---

## ADR-020 — The transition map is a table, and parity is asserted

**Date:** 2026-08-01 · **Status:** accepted

ADR-004 accepted that the permission catalogue is duplicated in TypeScript and SQL, and flagged the missing drift check as a known cost. The enquiry lifecycle would have repeated that mistake.

**Decision:** the map lives in SQL as **data** (`enquiry_transitions`) rather than as branching logic, and `scripts/rls-enquiry-probe.mjs` diffs all 12 × 12 × 4 combinations against `checkTransition()` in TypeScript. A divergence fails the probe run.

The probe imports the **real** TypeScript source, compiled on the fly by the esbuild that ships inside vite — Node 20 cannot strip types. A hand-copied map in the probe would pass happily while the application drifted, which would be worse than no check at all.

Extending this technique to the permission catalogue would close ADR-004 properly; it is still outstanding.

---

## ADR-021 — Assertions of absence prove nothing on their own

**Date:** 2026-08-01 · **Status:** accepted, process

The `on_message_sent` trigger inserted into an enum column from an uncast `CASE`, which Postgres types as `text`. It raised 42804 and aborted **every** message insert.

The probe suite did not catch it, because the messaging assertions were all of the form "an unrelated user cannot read the thread — rows 0". With no message ever created, those passed trivially. Three genuinely broken behaviours sat behind three green checks.

**Rule:** every "X cannot see Y" assertion needs a paired "the authorised party CAN see Y" in the same run. This is the second time the same asymmetry hid a bug — ADR-013 was the first — so it is now written into `docs/STATUS.md` as a standing instruction for each milestone.

---

## ADR-022 — E2E account creation bypasses the sign-up form

**Date:** 2026-08-01 · **Status:** accepted, with a caveat

Journey 1 begins "customer signs up". Driving the real sign-up form makes the whole journey depend on Supabase's default SMTP, which rate-limits confirmation emails to a handful per hour. The journey then fails on an email quota rather than on anything it is testing.

**Decision:** `journey-1-customer.spec.ts` creates its account through the Auth admin API and drives everything after that through the UI. A separate, smaller test exercises the sign-up form and **skips itself** when it detects the rate limit.

**Caveat worth stating plainly:** the journey therefore does not prove sign-up works on every run. It is covered, but by a test that is allowed to skip. Configuring a real SMTP provider (Resend, per PRD 8.1) removes the limit and lets the sign-up test run reliably — that is the proper fix and it is listed as outstanding.

---

## ADR-023 — Homepage statistics are counted, never claimed

**Date:** 2026-08-01 · **Status:** accepted

The homepage design called for trust counters reading "5,000+ Verified Vendors", "100+ Cities", "50,000+ Happy Couples", "4.9 Average Rating". The marketplace currently has 8 vendors, 8 cities, and no approved reviews. PRD 6.1 acceptance is explicit: _"no unverifiable numerical claim is hard-coded."_

**Decision:** `getHomeStats()` counts everything from live data, and a stat with nothing behind it is dropped rather than padded. The average rating appears only when approved reviews actually back it, matching the same rule that governs `aggregateRating` structured data (PRD 11.2).

The counters animate exactly as designed — they just count to the truth. Today the hero reads "3+ verified vendors, 8+ cities". That is a smaller number and a defensible one, and it grows on its own as the marketplace does.

The same reasoning applies to the category tiles, which show a live vendor count or "Coming soon" rather than a decorative figure.

---

## ADR-024 — The hero image is configuration, not an asset

**Date:** 2026-08-01 · **Status:** accepted

The design centres on a cinematic photograph of a wedding couple. Shipping one would mean inventing an image of people who do not exist, or appropriating a real couple's photograph — neither is acceptable in a product whose entire pitch is trust.

**Decision:** the hero reads `homepage_sections` where `code = 'hero'` for `{"imagePath": "...", "eyebrow": "..."}`, and falls back to a layered brand gradient with drifting blooms. The site looks finished on first deploy and becomes photographic the moment an admin sets an image — which is also what PRD 6.1 asks for ("content sections can be hidden/reordered by admin configuration").

To set one: upload to the `vendor-media` bucket and update the row —
`update homepage_sections set config_json = '{"imagePath":"<path>"}'::jsonb where code = 'hero';`

---

## ADR-025 — Animation is additive, never load-bearing

**Date:** 2026-08-01 · **Status:** accepted

The brief asked for scroll reveals, count-ups, parallax, and carousels. Each of those can hide content from someone who does not receive the animation.

**Decision:** every motion effect degrades to the finished state.

- `Reveal` renders visible by default and only sets the hidden "pending" state once JavaScript runs _and_ the user has not asked for reduced motion. A crawler, a no-JS visitor, and a reduced-motion user all see the content.
- `CountUp` renders the final value during SSR and for reduced-motion users; the animation only ever replaces a correct number with the same correct number.
- The testimonial carousel pauses on hover and keyboard focus, and does not auto-advance under reduced motion. A carousel that moves while someone is reading is an accessibility defect, not a flourish.

`prefers-reduced-motion` is honoured globally in `globals.css` as well, so a missed `motion-safe:` prefix fails safe.

---

## ADR-026 — Maroon brand, and a danger colour that cannot be confused with it

**Date:** 2026-08-02 · **Status:** accepted

The brand moved from deep purple to maroon (`#7F1C15`), with warm ivory neutrals replacing the blush-grey ones and `lavender` renamed to `rose` — a purple secondary against a maroon primary read as a clash rather than a gradient.

Two things worth recording.

**Ratios were measured, not assumed.** `scripts/`-adjacent working notes converted each oklch value to sRGB and computed WCAG contrast. `brand-700` is 10.05:1 on white; every shade from 500 down clears AA for body text; 400 clears AA for large text only and is used for decoration accordingly. The first draft of the ramp sat at hue 25 and rendered as crimson rather than maroon — moving to hue 29 produced `#7F1C15`, which is within a hair of canonical maroon `#800000`.

**A red brand makes the error state ambiguous.** `--color-danger` was `oklch(0.56 0.2 22)` — nearly the same red as the new brand, which would have made validation errors read as decoration. It is now `oklch(0.58 0.205 32)` (`#D93418`): brighter and more orange, separated from `brand-700` by both lightness and hue, still unmistakably an error rather than a warning.

**Why this was cheap:** the whole app renders colour through tokens, so the swap touched `globals.css`, three files for the `lavender` → `rose` rename, and one `themeColor` hex. The 641 `sand-*` and 120 `brand-*` references across 77 files needed no edits at all. That is the payoff for banning raw hex in JSX (PRD 7.1).

---

## ADR-027 — The phone layout is a different arrangement, not a narrower copy

**Date:** 2026-08-02 · **Status:** accepted

The requested mobile design (compact hero card, circular category tiles, a statistics strip, a swipeable vendor rail) is not the desktop page at a smaller width. Rather than build a second set of pages, each section renders one data source in two arrangements chosen by breakpoint.

**Decision:** same data, two layouts, one source of truth.

- Category icons and tints moved into `components/public/category-icons.ts`, shared by the desktop carousel and the mobile circles, so one category cannot pick up two different marks on the same page.
- Statistics render in the hero from `lg` and in `StatStrip` below it. Both are in the DOM at every width and CSS picks one; the breakpoints are deliberately identical, and an E2E test counts *visible* labels so a future mismatch showing them twice or not at all fails loudly.
- The vendor grid becomes a scroll rail below `sm` via `VendorRail`.

**Hiding a control must not discard its value.** The mobile search folds category, city, budget, and date behind a disclosure. Those fields stay *mounted* while collapsed rather than being unmounted — a filter chosen, hidden, and then submitted still applies. This is asserted in `tests/e2e/mobile-home.spec.ts`, because it is exactly the kind of thing that would silently regress.

**Two things the browser did that the CSS did not say.**

- Scroll snapping steals the gutter. `-mx-4 px-4` bleeds a rail past the page margin, but `scroll-snap-align: start` aligns to the *padding box*, so the browser scrolled the first card flush to the viewport edge and the row lost its left margin. `scroll-px-4` fixes it. It was found by measuring `scrollLeft`, not by looking.
- `backdrop-filter` is the first thing dropped under load or without compositing. The header's `glass-panel` at 82% white was legible only while the blur was actually applied. It is now 92%.

**Trade-off accepted:** the save hearts make the homepage read the session, so it can no longer be statically rendered. The `(public)` layout already forced this (outstanding item 10), so nothing regressed today — but fixing that item now means addressing this too. The alternative, rendering every heart as unsaved and correcting it on the client, would show wrong state to exactly the people who had saved something.

**Not built:** categories have no image column, and inventing one would mean an admin hand-picking stock photography. The circles show an approved cover from a real listing in that category when one exists — currently none, since `vendor_media` is empty — and the gradient icon otherwise. Both reserve identical space, so real imagery arriving later cannot shift the layout.

---

## ADR-028 — Put the server function next to the database, not next to the user

**Date:** 2026-08-02 · **Status:** accepted

The production homepage was answering in ~950ms with `x-vercel-cache: MISS` on every request. The `x-vercel-id` header read `bom1::iad1`: the request entered at the Mumbai edge, but the serverless function executed in **Virginia**, while the Supabase project lives in **ap-northeast-1 (Tokyo)**.

So each page render crossed the Pacific once per query wave, having already crossed the Atlantic to reach the function.

**Decision:** pin functions to `hnd1` (Tokyo), co-located with the database.

The instinct is to put the function near the user, in `bom1`. That is the wrong trade here, because the traffic is asymmetric — the function talks to the database many times per request and to the user once:

| Function region | User round trip | Database round trip | Dominant cost |
| --- | --- | --- | --- |
| `iad1` (was) | ~250ms | ~170ms × waves | both, badly |
| `bom1` (Mumbai) | ~10ms | ~120ms × waves | the database |
| `hnd1` (Tokyo) | ~110ms | ~5ms × waves | the user, once |

`bom1` only wins if the page makes roughly one database call. It does not, and the fix for that is bounded by how much can be aggregated into a single statement — see ADR-029.

**Revisit this** if the database moves, or once public pages are statically rendered again: a cached page never invokes the function at all, so the edge serves Mumbai from Mumbai and the region stops mattering for anonymous traffic. That is the real fix, and it is still outstanding.

---

## ADR-029 — Aggregate on the database side, not in the render

**Date:** 2026-08-02 · **Status:** accepted

The homepage issued seven queries to render two components, and two of them were unbounded:

- `getHomeStats` selected `rating_average, rating_count` for **every** public vendor and computed the weighted mean in JavaScript, discarding every row after summing.
- `getCategoryTiles` selected **every** row of `vendor_categories` with nested `vendor_media`, then counted and picked cover images in JavaScript, to render at most twelve tiles.

Four of the counts also went through `public_vendors`, whose lateral join rebuilds a listing snapshot per row — work a `count(*)` has no use for.

At eight vendors none of this was visible. Both were linear in the size of the catalogue, so they were defects waiting for the site to succeed.

**Decision:** migration `0017` adds `homepage_stats()` and `category_tiles(limit)`. Seven queries become two, and neither scales with the catalogue.

**They are `security invoker`, deliberately.** Every table they touch already grants anon a read (`vendors: public read active`, `vendor_media: public read approved`, and the taxonomy tables), so RLS remains the boundary and the migration adds no new privilege surface. A `security definer` function would have been easier to write and would have quietly become a second place where "what may the public see" is decided.

**Verified as `anon`, not as `postgres`.** The first smoke test ran over a direct superuser connection, which bypasses RLS and would have passed even if the policies denied everything. Re-running both functions through PostgREST with the publishable key returned identical figures — which is the assertion that actually means something.

---

## ADR-030 — Session state belongs in the browser, not in the render

**Date:** 2026-08-02 · **Status:** accepted

Even after co-locating the function with the database (ADR-028) and collapsing the query count (ADR-029), every public page still answered `x-vercel-cache: MISS`. The cause was one line in `(public)/layout.tsx`: `getActor()`. Reading the session opts a route out of static rendering for **every** visitor, so the whole public tree was a function invocation on another continent in order to decide whether the header says "Sign in" or "Account".

**Decision:** the public shell reads no session. `SessionProvider` resolves it in the browser and the header, bottom bar, and save buttons consume it from context.

Result: `/`, `/about`, `/blog`, `/categories`, `/cities`, `/contact`, `/help`, `/privacy`, and `/terms` are prerendered. `/vendors` stays dynamic, but because it reads search parameters — which is correct, not a session leak.

**`getSession()` is not an authorisation signal, and the provider says so in a comment that should stay there.** It reads the cookie without revalidating the JWT, so a tampered cookie can make `signedIn` true in the browser. That is deliberately harmless: nothing in the context decides what anyone *may do*, only which label a button shows. RLS and `assertPermission` remain the boundary, and a forged cookie fails there. The danger is a future change quietly promoting this to a gate.

**The check that mattered.** A prerendered page is served to everyone, so personalisation baked into it is not a stale label — it is one account's state shown to strangers. Fetching `/` with and without a session cookie returns HTML differing only in React's per-render id: no email, no "Sign out", no saved-state labels. `tests/e2e/mobile-home.spec.ts` now asserts this on every run, because it is the kind of regression that is invisible until it is a disclosure.

**Cost accepted:** signed-in visitors see the signed-out affordance for one paint before the browser resolves the cookie. That is the standard price of a cached shell, and it is paid by the minority; the alternative was every visitor waiting on a function call.

---

## ADR-031 — Review eligibility and moderation belong in triggers, not policies

**Date:** 2026-08-02 · **Status:** accepted

Probing the Milestone 1 review policies against the live database, a freshly signed-up account could do three things it should not:

1. **Review a vendor it had no relationship with.** `reviews: customer create` checked only that the enquiry linked the same customer and vendor — so creating a `draft` enquiry and immediately reviewing off it passed.
2. **Self-approve.** `reviews: customer edit` granted UPDATE on the row, and RLS is row-level: granting UPDATE grants it on *every column*, including `status`. Two HTTP calls took a real vendor's public rating from 4.6 to 1.0.
3. **Publish a bait-and-switch.** An approved review could be rewritten in place and stayed approved.

This is the same shape as ADR-019. RLS decides *which rows*; only a trigger can decide *which columns*, and only a trigger can consult another table — here, the enquiry's lifecycle state.

**Decision:** migration `0018` moves eligibility, moderation immutability, the edit window, and revision history into triggers. Eligible states live in `review_eligible_statuses`, a table, mirroring how `enquiry_transitions` already drives the lifecycle — so "which states earn a review" is configuration rather than a literal in a function body (PRD 6.8 asks for it to be configurable).

Editing an approved review now returns it to `pending` and files the previous text as a revision. The author keeps the right to edit; they lose the ability to edit *unsupervised*.

**Two follow-ups the probe found, which is the point of writing it:**

- `0020` — the triggers asked `has_admin_permission('review.moderate')`, which resolves through `auth.uid()` and is therefore false for the service role. Cron handlers and webhooks were being treated as the review's author and refused. One predicate, three red assertions.
- `0021` — `reviews_refresh_rating` was declared `after update of status, overall_rating`. That column list matches columns named in the UPDATE *statement*, not columns a BEFORE trigger subsequently changed. So an edited review dropped out of public view while its stars stayed in the vendor's average — a rating partly composed of text nobody could read.

Neither would have surfaced from the denial assertions alone. Both were caught by the paired *permitted* assertions ("a real moderator can approve", "un-approving removes it from the aggregate again"), which is the asymmetry ADR-013 and ADR-021 warned about, now paying for itself a third time.

---

## ADR-032 — Commercial standing is not the vendor's to write, and "Sponsored" must be paid for

**Date:** 2026-08-02 · **Status:** accepted

`vendors: member update` grants UPDATE to any member holding `listing.edit`. RLS is row-level, so that covers every column. Probed against the live database, a vendor owner could set:

| Column | What it buys |
| --- | --- |
| `is_featured` | Paid placement, top of search, free |
| `verification_status` | The trust badge the marketplace sells |
| `status` | Self-publish, skipping moderation entirely |
| `plan_id` | Self-upgrade to any plan |
| `rating_average` / `rating_count` | An invented reputation |

Each was confirmed by writing a value the row did not already hold — an earlier pass reported "accepted" on two columns that were already at the target value, which proves nothing, so it was redone.

**Decision:** migration `0022` adds a BEFORE UPDATE guard making those columns immutable from the client.

**The trigger is SECURITY INVOKER, deliberately.** The legitimate writers — `submit_vendor_for_review()`, `admin_decide_vendor()`, `refresh_vendor_rating()` — are all SECURITY DEFINER, so inside them `current_user` is the function owner rather than `authenticated`. Running the guard as INVOKER lets it see that difference and step aside. The alternative was re-declaring every one of those functions to set a transaction-local flag, which is more code and one more thing to forget when the next one is written.

**Featured placement is checked against the plan, for everyone including admins.** `vendor_may_be_featured()` reads the live subscription's entitlements. An admin cannot flip the flag on an unpaid vendor; comping placement is done by changing the plan, which leaves a record, rather than by setting a boolean that leaves none. "Sponsored" is a disclosure (PRD 6.2) — it has to correspond to someone actually paying, or the label is a lie.

**Cancellation retracts it.** The guard only blocks *setting* the flag; it cannot retract one already set. `cancelSubscription` clears `is_featured` when the vendor is no longer entitled, because otherwise a lapsed vendor keeps top placement until someone notices.

**Consequence for the seed:** `seed-demo-vendors.mjs` created a featured vendor with no subscription — a state no client could now reach. The seed creates the matching premium subscription, and the existing row was backfilled.

---

## ADR-033 — An idempotency key that is claimed before the work is done can lose the event

**Date:** 2026-08-02 · **Status:** accepted

The payment webhook claims `webhook_events (provider, external_event_id)` with a unique insert, so a duplicate delivery loses at the database rather than in application logic two concurrent deliveries could both pass. That much was right.

What was wrong: **any** claimed id was reported as a duplicate. Driving the real endpoint exposed the consequence — the first delivery 500'd on an unrelated bug, and the retry came back `200 {"status":"duplicate"}`. The provider considered it delivered. The event was gone.

**Decision:** only a *terminal* outcome short-circuits. `processed` and `ignored` return duplicate; `received` and `failed` are reprocessed with `attempts` incremented. Every write in the handler is an upsert or tolerates `23505`, so reprocessing is safe.

The unrelated bug is worth recording too, because it is a trap: `subscriptions_provider_sub_idx` was a **partial** unique index (`where provider_subscription_id is not null`). Postgres will not infer a partial index for `ON CONFLICT` unless the statement repeats the predicate, and PostgREST does not emit one — so the upsert failed with "there is no unique or exclusion constraint matching the ON CONFLICT specification". Migration `0023` makes it a plain unique index; NULLs are distinct by default, so manual subscriptions still do not collide.

Neither fault was visible by reading the code. Both came from sending a signed request to the running route.

---

## ADR-034 — CSP without a nonce, because a nonce would cost static rendering

**Date:** 2026-08-02 · **Status:** accepted

The strong CSP for a Next app is `'nonce-…' 'strict-dynamic'`: trust the bootstrap script by nonce, trust what it loads, ignore host allow-lists. Next only threads that nonce onto its own scripts when the **root layout** reads it from `headers()`.

Reading a header in the root layout opts the entire route tree out of static rendering. Measured on this app: static routes fell from **12 to 2** and `/` became a function invocation again — undoing ADR-030, which took TTFB from ~950ms to ~150ms.

It is not a free choice in the other direction either. With `strict-dynamic` in force, a statically prerendered page carries no nonce on its inline bootstrap, so the browser blocks it and the page renders blank. Nonce and static rendering are mutually exclusive here, not merely in tension.

**Decision:** enforce every directive that does not need a nonce and accept `'unsafe-inline'` on `script-src`.

This is a real weakness and is listed as a launch blocker in STATUS.md rather than dressed up: a successful HTML injection could run script. What remains is not theatre — `object-src 'none'` kills plugin execution, `base-uri 'self'` stops `<base>` injection turning a small injection into total script control, `frame-ancestors 'none'` is the clickjacking control modern browsers actually honour, and `form-action 'self'` stops an injected form posting credentials offsite.

Verified against the running app rather than assumed: `/`, `/vendors`, `/blog`, and `/auth/sign-in` each load with **zero CSP violations, zero JavaScript errors, and hydration intact**. A policy that blanks the page is worse than no policy, so that check is the point.

The route out is Partial Prerendering — once a dynamic hole can carry a nonce while the shell stays static, this becomes nonce + `strict-dynamic` at no latency cost.

---

## ADR-035 — Verify a write by reading the table, not the status code

**Date:** 2026-08-02 · **Status:** accepted

The Milestone 7 review probed whether `anon` could forge analytics events. The first run reported **blocked** — HTTP 401. It was wrong. The insert had used `Prefer: return=representation`, and `anon` has no SELECT on `analytics_events`, so a *successful write* came back as an authorisation error. Re-running without the header and then checking the table with the service role found the row sitting there.

The same artefact appeared in the membership probe: a self-escalation PATCH returned `role: null`, which read as "blocked" but was only the filtered read-back. That one turned out to be genuinely blocked — confirmed by reading the row.

**Decision:** a probe asserting that a write was refused must confirm it by reading the target table with a privileged client. The response status of the write is evidence about the *response*, not about the database.

This is the fourth time in this project that a green assertion turned out to be measuring nothing (ADR-013, ADR-021, ADR-031). The failure mode is always the same shape: the check and the thing being checked are not actually connected.

**What it was hiding:** `analytics_events: anyone insert` granted INSERT to `anon` with no `WITH CHECK`. Anyone with the publishable key — which ships in the browser — could write forged `vendor_profile_view` rows naming any vendor. Those rows feed `rebuild_vendor_metrics()`, so a competitor could inflate a rival's numbers, or a vendor could inflate their own and dispute the invoice. Closed in `0024`; the beacon now goes through `record_vendor_profile_view()`, which pins the event name and de-duplicates by session.

---

## ADR-036 — A policy naming a permission that does not exist is a locked door

**Date:** 2026-08-02 · **Status:** accepted

Migration `0019` guarded the SLA settings with `has_admin_permission('settings.manage')`. That permission is in neither `admin_permissions` nor `lib/permissions/catalogue.ts`. The function returns false for a code it has never heard of, so the policy was deny-all: the response-time threshold PRD 6.6 requires to be configurable could not be changed by anyone, including a super-admin.

It fails closed, so it was never a security hole. It was worse in a quieter way — a feature that silently did not work. A `super_admin` PATCH returned `204` with zero rows matched, which is indistinguishable from success unless you re-read the row. Nothing in the test suite did.

**Found by accident.** TypeScript rejected the same invented permission name when I used it in a Server Action, which prompted checking the SQL side. Had I picked a real permission for the action and left the migration alone, the policy would still be locked.

**Decision:** `0028` re-declares the policy against `admin.manage`, which exists and already gates administrator management. Verified in both directions — a super-admin can now set the value, and anon still cannot.

**The real finding is the missing check.** CLAUDE.md invariant 3 says the permission catalogue is mirrored in SQL and that changing one means changing the other. Nothing enforces it. ADR-004 flagged this and ADR-020 built the technique — compiling the real TypeScript source and comparing it against the database, which is how the enquiry transition map is kept honest. It was never applied to permissions. This is the first demonstrated cost, and it will not be the last: the failure mode is a policy that looks strict and admits nobody, which no amount of reading the SQL reveals.

---

## ADR-036 — Admin MFA that cannot lock out the last administrator

**Date:** 2026-08-02 · **Status:** accepted

PRD 10.3 requires admin MFA and a short privileged session. The obvious implementation — require `aal2` on `/admin/*` — locks out any administrator who has not enrolled, including the only one, on the day it ships.

**Decision:** enforcement is staged, and one route is deliberately exempt.

| Session state | Result |
| --- | --- |
| No factor enrolled | Redirect to `/admin/security` (reachable at aal1) |
| Factor enrolled, session aal1 | Redirect to the challenge |
| Factor enrolled, session aal2, elevated < 30 min | Allowed |
| Factor enrolled, elevation older than 30 min | Redirect to re-verify |

`/admin/security` calls `requireAdmin`, never `requireElevatedAdmin`. If it required a second factor itself, the only page that can resolve a missing or stale factor would be unreachable, and recovery would mean database access.

**Session age comes from the signed `amr` claim**, not from a cookie or a column we maintain. The auth server signs when the second factor was completed, so nothing in the browser can extend a privileged session by editing state.

**`getMfaState` fails open, and only it.** An auth-service blip would otherwise lock every administrator out of moderation while the marketplace kept running. Authorisation is untouched — `requireAdmin` and RLS still decide what an admin may *do*; this decides only whether they are asked for a code.

**Removing a factor requires aal2.** Otherwise a stolen aal1 session could strip the protection it cannot satisfy.

**One bug worth recording, because it took the page down rather than degrading it:** Supabase returns the enrolment QR as an `image/svg+xml` data URI, and `next/image` rejects that outright. The throw crashed the route — so the single page capable of enrolling a factor rendered a global error. It is a plain `<img>` now; there is nothing to optimise about a data URI. Found by driving the flow with a real TOTP generator rather than by reading the code.

**Verified end to end**, including the parts that only matter when they fail: a wrong code is refused, a real code elevates the session, all admin routes open afterwards, and with no factor every admin route lands on the enrolment page with the enrolment button present. Codes are rate limited to 10 per 15 minutes per user — six digits is 10^6 guesses, which is minutes of brute force unthrottled.

---

## ADR-037 — Correcting ADR-034: the nonce never needed Partial Prerendering

**Date:** 2026-08-02 · **Status:** accepted, supersedes part of ADR-034

ADR-034 concluded that a nonce-based `script-src` was incompatible with static rendering, on the basis that Next only threads a nonce when the **root layout** reads it from `headers()` — which does force the entire tree dynamic (measured: static routes 12 → 2). It named Partial Prerendering as "the route out".

**Both halves of that were wrong.**

Reading Next's source: `app-render.js` takes the nonce from the **incoming request's** `content-security-policy` header, not from a `headers()` call anywhere in the tree. Setting the policy on the request in the proxy is enough — the layout is never involved, and static rendering is untouched. Verified: `/vendors` serves 63 nonced script tags with 12 static routes still prerendered.

And PPR would not have helped. A prerendered shell is built without a request, so it cannot carry a request-specific nonce however the rest of the page streams. Enabling `cacheComponents` to try was also blocked outright — it is incompatible with the `export const revalidate` used on ~25 routes — so the migration would have been large *and* pointless.

**What ships instead:** dynamic routes get `'nonce-…' 'strict-dynamic'`; prerendered public pages keep `'unsafe-inline'`. Browsers honouring `strict-dynamic` ignore `'unsafe-inline'` and `'self'` on the nonced routes, so the strong policy applies to everything behind a login plus search and vendor profiles — the surfaces that carry sessions and render user-supplied text. The weaker policy is left where the content is ours and static.

**How the error happened, since that is the reusable part:** ADR-034 reasoned from an observed measurement (reading `headers()` broke static rendering — true) to a conclusion about the mechanism (a nonce requires reading `headers()` — false). The measurement was real; the inference from it was not checked against how Next actually obtains the nonce. Reading forty lines of framework source would have settled it at the time.

---

## ADR-038 — Realtime is a second read path, so it gets the same proof as the first

**Date:** 2026-08-02 · **Status:** accepted

PRD 6.7 allows Realtime for the message thread and requires that "Realtime channel access must be private and membership-authorised". The second half is the work: a live feed is a second way to read `messages`, and a second read path is a second chance to leak one.

**Decision:** publish only `messages`, and let the existing `messages: participant read` policy protect the stream. Supabase evaluates the table's RLS for the subscribing user before delivering a change, so there is no separate channel ACL to keep in sync with the table's — which is the point. `enquiries` and `notifications` are deliberately not published: the enquiry row carries budget and contact-consent fields, and a stream is a poor place to reason about column exposure.

`replica identity full` is required, not optional. With the default identity the change payload carries only the primary key, so a policy reading `conversation_id` cannot be evaluated at all — the choice is between full identity and a stream nobody can filter.

**The same bug appeared twice, in the probe and then in the hook.** A client that subscribes before it holds a session connects as anonymous. RLS then filters out every row while the channel still reports `SUBSCRIBED` — a feed that looks healthy and delivers nothing, which is indistinguishable from a quiet thread. In the probe it was a bearer header on the REST transport, which does not authenticate the WebSocket; in the browser it was subscribing during the first render, before the session had loaded. Both now establish the session first and call `setAuth` before subscribing.

**Why the paired assertion mattered here more than usual.** The first probe run reported `a non-participant receives nothing — PASS`. It was measuring nothing: the participant received nothing either. "The outsider got no events" passes when Realtime is off, when the table is unpublished, and when the socket is unauthenticated. Only the participant assertion gives it meaning — the fourth time in this project that a green light turned out to be a disconnected wire (ADR-013, ADR-021, ADR-031, ADR-035).

**Polling fallback, per the PRD.** If the socket never connects — a proxy blocking WebSockets, the flag off, a transient failure — the thread refreshes on a 20-second interval, and polls *only* while disconnected so the common case costs nothing. The thread is correct either way; only latency changes.

**The handler refreshes rather than appending.** The payload is a raw database row, but the thread renders sender names resolved through a join. Appending from the payload would create a second, thinner rendering path that drifts from the real one, so it calls `router.refresh()` and lets the query that already knows how to render a message do it.

Shipped behind `FEATURE_REALTIME_CHAT`, which is **off**. Verified on: a message inserted elsewhere appears in a watching browser with no reload.

---

## ADR-039 — A drift check is worthless until you have watched it fail

**Date:** 2026-08-02 · **Status:** accepted

CLAUDE.md invariant 3 says the permission catalogue is mirrored in SQL — change one, change the other. Nothing enforced it, and ADR-004 recorded the gap. It then cost something real: `0019` guarded `sla_policy` with `has_admin_permission('settings.manage')`, a code that exists in neither the catalogue nor `admin_permissions`. The function returns false for a code it has never heard of, so the policy was deny-all until `0028`.

**Decision:** `npm run check:permissions` compares the compiled real catalogue against the database — codes, roles, and the role→permission matrix, each in both directions — plus every permission named by a deployed policy or function.

**Two wrong versions, both of which passed.**

The first scanned migration *files*. It matched text inside SQL comments, so `0028` — the fix — read as if it still contained the bug; and it asserted on history, which cannot be corrected, because a superseded migration must never be edited. Reading `pg_policies` and `pg_proc` describes what is actually deployed, which is the only thing worth asserting on.

The second matched nothing. Postgres normalises a stored policy expression: `has_admin_permission('x')` is returned by `pg_policies` as `has_admin_permission('x'::text)`. A pattern without the cast silently matched no policy at all, and the twelve codes it appeared to find came only from `pg_get_functiondef`, where the original source text survives.

**Both were caught by injecting a policy that names `totally.invented` and confirming the check goes red**, then removing it and confirming it goes green again. Version two stayed green with the broken policy in place. Version three names the permission and the policy holding it.

A check that has never failed is indistinguishable from one that cannot fail. This is the fifth instance of that shape in this project (ADR-013, ADR-021, ADR-031, ADR-035), and the first where the disconnected wire was in the tooling built to prevent it.

**Left open, and reported rather than hidden:** `vendor_can()` holds the vendor capability matrix in a PL/pgSQL body rather than a table, so there is nothing to diff against without parsing the function. The script prints that as a SKIP with the reason. An unchecked half of an invariant should be visible.

---

## ADR-040 — Admin MFA becomes opt-in

**Date:** 2026-08-02 · **Status:** accepted, amends ADR-036

ADR-036 shipped admin MFA with staged enforcement designed to avoid a lockout: an administrator with no factor is redirected to `/admin/security` rather than refused. That worked as designed — and the practical effect was that the admin panel could not be used until an authenticator was enrolled. The owner asked for it to be removed.

**Decision:** enforcement is gated on `ADMIN_MFA_REQUIRED`, default **false**. The code is not deleted.

Nothing about the mechanism changed: the challenge, the signed `amr` session age, the 30-minute privileged window, the aal2 requirement to remove a factor, and the enrol-first redirect are all still present and still covered by tests. `requireElevatedAdmin` returns early when the flag is off, and `/admin/security` remains reachable so an administrator can enable a second factor on their own account voluntarily.

Deleting it would have been the wrong shape of response. The feature was not wrong — the default was. A flag keeps the decision reversible by one environment variable and keeps the tested code path alive, rather than requiring it be rebuilt from the commit history later.

**What this costs, stated once:** the admin panel can reveal customer contact details, and it is now protected by a password alone. PRD 10.3 asks for admin MFA, so this stays on the launch list as an open consideration rather than a completed item — recorded, not quietly dropped.

---

## ADR-037 — RLS is a ceiling, not a filter

**Date:** 2026-08-02 · **Status:** accepted

Reported from production: "when I send a message to a vendor, the message is also visible to other users."

Probed first. The database was not leaking. Two customers of the same vendor, and one customer across two vendors, each read exactly their own rows over PostgREST — six assertions, all clean. Cross-tenant isolation was intact the whole time.

**The leak was in the page.** `getCustomerEnquiries()` had no ownership filter and relied on RLS. But `enquiries: participant read` admits a row if you are the customer **or a member of the vendor** or an admin with `lead.read`. So `/account/enquiries` — a page that means "enquiries you sent" — listed, for a vendor member, every enquiry sent *to* their business as though they had sent it. The reporter held both a customer account and a vendor membership, so their own account page showed them their business's inbox.

Reproduced: a vendor member's query returned 3 enquiries, 0 of them theirs. An admin's returned the same 3.

**Decision:** a query whose meaning is "mine" states it. `getCustomerEnquiries`, `getOwnReviews`, and `getReviewableEnquiries` now filter on `customer_id` explicitly, and both enquiry detail pages 404 unless the viewer is the party that page is written for. RLS still backs all of it — the point is that the policy answers "may this row be read at all", which is a different question from "is this row yours".

The same shape exists wherever a policy has an `or` in it. `reviews: own read` and `shortlists` were checked; the review reads had it, shortlists did not.

**The test had to be at the page level.** An RLS probe passes throughout — it was passing throughout. `tests/e2e/conversation-privacy.spec.ts` signs in as a vendor member and asserts the customer page neither lists nor opens someone else's enquiry. Verified by reverting the fix: the test fails with `Expected 404, Received 200`, and passes with it. A regression test that was never seen to fail is a guess.
