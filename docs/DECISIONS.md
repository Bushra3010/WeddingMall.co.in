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
