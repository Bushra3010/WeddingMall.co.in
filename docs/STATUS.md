# Status

Updated: 2026-08-26

## Completed

- **Prompt 0 — repository blueprint.** Next.js 16 / React 19 / TS strict / Tailwind v4, structure per PRD 8.2, pinned dependencies, env schema, CI.
- **Milestone 1 — foundation.** App shell, three Supabase clients, SSR session refresh, profile trigger, permission catalogue (TS + SQL), route protection, env validation, error boundaries, design tokens.
- **Milestone 2 — vendor onboarding.** Taxonomy admin, vendor organisations and memberships, onboarding with completion score, private verification uploads, admin approve / request-changes / reject / suspend with audit events.
- **Milestone 3 — listings and discovery.** Versioned listing editor, packages, portfolio with media moderation, availability, listing moderation with before/after comparison, slug redirects, attribute-driven filters.
- **Milestone 4 — customer marketplace.** Wedding profile, shortlist, idempotent enquiries with explicit contact consent, trigger-enforced lifecycle, participant-authorised messaging, in-app notifications, email adapter, and vendor inbox.
- **Deployed** to Vercel at `wedding-mall-co-in.vercel.app`; source at `github.com/Bushra3010/WeddingMall.co.in`.
- **Schema:** migrations `0001`–`0015` applied to the live project.

## Verified

| Check               | Result                                                                               |
| ------------------- | ------------------------------------------------------------------------------------ |
| `npm run lint`      | pass, 0 warnings                                                                     |
| `npm run typecheck` | pass                                                                                 |
| `npm run test`      | **90 passed** across 6 files                                                         |
| `npm run build`     | pass                                                                                 |
| `npm run db:rls`    | **139 passed** (28 anon + 24 cross-tenant + 38 onboarding + 26 listing + 23 enquiry) |
| `npm run test:e2e`  | **9 passed**, 0 failed — includes PRD Journey 1 end to end                           |
| Migrations          | 15/15 applied clean                                                                  |

### Journey 1, in a real browser

`tests/e2e/journey-1-customer.spec.ts` drives sign-in → search → vendor profile → shortlist (asserted to survive a reload) → enquiry → message, then re-loads the list to confirm persistence. It also asserts that an enquiry belonging to nobody returns 404, since RLS makes "not yours" and "not found" indistinguishable by design.

### What the Milestone 4 probes prove

- **Idempotency:** replaying a submission key returns the original enquiry, and exactly one row exists.
- **Lifecycle:** a customer cannot `PATCH status` past the transition map (403 from the trigger); a transition needing a reason is refused without one; an unrelated user cannot transition at all; every step writes an event; a participant cannot delete lifecycle events.
- **Parity:** all 576 (from × to × actor) combinations of `enquiry_transitions` match `checkTransition()` in TypeScript, compiled from the real source.
- **Thread privacy:** an unrelated user reads zero messages, the vendor reads the thread, nobody can post as someone else, anon reads nothing.
- **SLA and notifications:** the first vendor reply sets `first_response_at`; each side is notified; a user sees only their own notifications.
- **Shortlist:** private from other customers _and_ from the vendor; unique per vendor; a customer cannot write into another customer's shortlist.
- **Consent:** defaults to false, and vendor-side contact details are withheld unless consent was given _and_ the member holds `lead.view_pii`.

## Fixed during Milestone 4

1. **A customer could set any enquiry status directly.** RLS is row-level, so the `participant update` policy exposed `status` to a raw PATCH. Now enforced by triggers (ADR-019).
2. **Every message insert failed.** An uncast `CASE` into an enum column raised 42804. It hid behind three green "nobody can read the thread" assertions — there was no thread (ADR-021).
3. **The sign-out button had no accessible name.** Icon-only, `label=""`, unusable by screen reader or voice control. Found by clicking it accidentally in the browser.
4. **The `x-robots-tag` E2E assertion was never true** — `page.goto` follows the redirect, so it read the sign-in page's headers. The proxy now sets the directive on the redirect too, and the test inspects the 307 without following.
5. **A dead `.refine()`** in the enquiry schema that could never fail.

## Homepage redesign (2026-08-01)

Soft-luxury restyle: deep maroon brand tokens (#7F1C15), warm ivory neutrals, rose and champagne-gold accents; sticky navbar that goes solid on scroll; full-bleed hero with a six-field search card and tabs; live-counted trust statistics; category carousel with gradient icon tiles; premium vendor cards; testimonial carousel; multi-column footer with a working newsletter signup.

Three judgement calls worth knowing about:

- **Statistics are counted, not claimed** (ADR-023). The design specified "5,000+ vendors / 50,000+ couples"; the hero renders the real 3+ / 8+ / 8+ / 4.6 instead, because PRD 6.1 forbids hard-coded unverifiable claims.
- **The hero image is admin-configured** (ADR-024), with a gradient fallback. No stock photograph of people was invented.
- **Every animation degrades to the finished state** (ADR-025) — reveals, counters, and the carousel are all safe under reduced motion, no JavaScript, and crawling.

Sections in the brief that were not built, because no data model backs them: wedding packages, the Pinterest-style inspiration gallery, and per-vendor response-time badges. Adding them would mean inventing content.

## Mobile layout (2026-08-02)

The phone view was rebuilt to a supplied mockup while keeping the maroon theme: compact hero card with rounded bottom that the search box overhangs, a city selector in the header, a single search bar with the other four filters behind a disclosure, four-across circular category tiles with live vendor counts, a statistics strip, and a swipeable featured-vendor rail with save hearts.

Same data, two arrangements — not a second page (ADR-027). Desktop is unchanged: six-field search, tabs, hero statistics, popular-search chips.

Files: `components/public/{hero,hero-search,site-header,vendor-card,category-carousel}.tsx` edited; `{category-circles,category-icons,city-selector,save-button,stat-strip,vendor-rail}` added; `(public)/{page,layout}.tsx`, `dal/homepage.ts` (category cover images), `dal/enquiries.ts` (`getShortlistedVendorIds`), `globals.css`.

Three defects found by measuring rather than looking:

- **Scroll snapping ate the rail's left gutter** — `scroll-snap-align: start` aligns to the padding box, so the browser scrolled the first card flush to the edge. Caught by reading `scrollLeft` (16, not 0). Fixed with `scroll-px-4`.
- **The hero read every statistic twice aloud** — an `sr-only` `<dt>` plus a visible `<p>` with the same text. Now one `<dt>`, ordered correctly with `flex-col-reverse`. Pre-existing; surfaced by a failing count assertion.
- **The frosted header was see-through** at 82% white whenever `backdrop-filter` was not composited. Now 92%.

Tests: 90 unit, 13 E2E (6 new in `tests/e2e/mobile-home.spec.ts` at a 390px viewport, covering collapsed-filter submission, the city selector, no horizontal overflow, rail gutter, the signed-out save link, and single-render statistics). Lint, typecheck, and build clean.

## Bottom tab bar (2026-08-02)

Mobile navigation moved from the header's hamburger into a fixed bottom bar: Home, Explore, Shortlist, More. It renders below `lg` in both the `(public)` and `(customer)` layouts — "Shortlist" points into `/account/*`, so dropping the bar on arrival would strand someone one tap inside their account.

The header below `lg` is now just the wordmark and the city selector; its shortlist link, account controls, sign-in, and "List your business" all raised from `sm:` to `lg:` rather than competing with the bar for a narrow strip. The "More" sheet carries everything the hamburger did, plus categories, cities, wedding ideas, and venues.

Files: `components/public/bottom-nav.tsx` added; `site-header.tsx` (hamburger and mobile panel removed, breakpoints raised); `(public)/layout.tsx`, `(customer)/layout.tsx`.

A fixed bar hides whatever is under it, so the component emits a spacer of its own height in normal flow. That height is `4rem + 1px` — the `1px` is the bar's top border, which sits outside its `h-16` content box, and without it the footer's last line ends one pixel underneath. Asserted as a pixel overlap rather than a boolean, because sub-pixel layout puts the footer's edge a fraction below the bar's while a missing spacer would bury it by the full 65px.

Tests: 16 E2E (3 more in `mobile-home.spec.ts` — current-section marking, the More sheet opening and closing on Escape with its links intact, and the spacer). 90 unit. Lint, typecheck, build clean.

## Mobile performance (2026-08-02)

Reported as "running slow on mobile". Measured before touching anything: production TTFB was **0.9-1.1s** with `x-vercel-cache: MISS` on every request.

Three causes, in order of size:

1. **The function ran on the wrong continent.** `x-vercel-id: bom1::iad1` — requests entered at the Mumbai edge but executed in Virginia, while the Supabase project is in Tokyo (`ap-northeast-1`). Every query crossed the Pacific after crossing the Atlantic. Pinned to `hnd1` in `vercel.json`, co-located with the database (ADR-028).
2. **Seven queries for two components, two of them unbounded.** `getHomeStats` fetched every vendor's rating columns to average in JavaScript; `getCategoryTiles` fetched every `vendor_categories` row with nested media to count twelve tiles. Replaced by `homepage_stats()` and `category_tiles()` in migration `0017` — seven round trips become two, neither scaling with the catalogue (ADR-029).
3. **Three unused font files.** `Cormorant_Garamond` loaded weights 500/600/700; only 600 is ever used with `font-display`.

Files: `supabase/migrations/0017_homepage_aggregates.sql`, `vercel.json`, `dal/homepage.ts`, `app/layout.tsx`, `src/types/database.ts` (regenerated).

Both new functions are `security invoker` — every table they read already grants anon a select, so RLS stays the boundary and no new privilege surface is added. They were verified through PostgREST as `anon`, not over the superuser connection that bypasses RLS and would have passed regardless.

4. **The public shell read the session**, which opted every public page out of static rendering for every visitor — a function invocation on another continent to choose between "Sign in" and "Account". `SessionProvider` now resolves it in the browser (ADR-030). `/`, `/about`, `/blog`, `/categories`, `/cities`, `/contact`, `/help`, `/privacy`, and `/terms` are prerendered; `/vendors` stays dynamic because it reads search parameters.

Because a prerendered page is served to everyone, `/` was fetched with and without a session cookie: the HTML differs only in React's per-render id. An E2E test now asserts the response carries no session markup on every run.

## Milestone 5 — CRM and reviews (2026-08-02)

Migrations `0018`–`0021`; app layer for reviews, vendor CRM fields, and analytics.

**Three live vulnerabilities found by probing before building** (ADR-031). A freshly signed-up account could review a vendor off a `draft` enquiry it had just created, PATCH its own review to `approved`, and rewrite an approved review in place. The second one took a real vendor's rating from 4.6 to 1.0 in two HTTP calls. All three are closed by triggers in `0018`, because RLS grants UPDATE per row and cannot restrict it per column.

**Two more found by the probe's *permitted* assertions**, not its denials:
- `0020` — the triggers used `has_admin_permission()`, which is `auth.uid()`-based and therefore false for the service role, so cron handlers and webhooks were refused as if they were the author.
- `0021` — `reviews_refresh_rating` fired `after update of status`, which matches columns named in the UPDATE *statement*, not columns a BEFORE trigger changed. An edited review left public view while its stars stayed in the average.

**Also shipped**
- Reviews end to end: customer write/edit with revision history, vendor single public reply, admin moderation queue with tabs and required reasons. Replaces the `account/reviews` and `admin/reviews` stubs.
- Vendor CRM on an enquiry: internal notes with follow-up dates, quote amount, lost reason. Notes gated on `note.manage`, not `lead.respond` — replying to a customer is not the same right as reading the team's private commentary about them.
- `vendor_metrics_daily` is now populated. `rebuild_vendor_metrics()` recomputes rather than increments, so a missed run repairs itself; `/api/cron/vendor-metrics` drives it. Profile views come from a client beacon, not a write during render.
- Analytics page and `enquiry_sla` view with overdue surfacing. Response rate renders as an em dash rather than 0% when nothing has been delivered.

**Two schema bugs the new unit tests caught**, both the same shape — validation ordered before normalisation:
- `z.coerce.number()` turns `''` into `0`, so a blank quote field would have recorded a ₹0 quote.
- `.regex().optional()` validates before the transform can clear a blank, so submitting a review without an event date failed with "Use the date picker." on an optional field.

Tests: 110 unit (20 new), 156 RLS assertions across 6 probes (17 new, both directions), lint/typecheck/build clean.

**Not done in this milestone:** E2E journey 2 (blocked on the same missing SMTP as journey 3 — see outstanding item 1), enquiry pipeline/board view and assignment UI, CSV export, and per-vendor SLA overrides. The data and the guards exist for all of them.

## Milestone 6 — billing, CMS, export (2026-08-02)

Migrations `0022`–`0023`; payment adapter, webhook, plan screens, CMS blog, CSV export.

**Five more self-granted privileges found by probing first** (ADR-032). A vendor owner with `listing.edit` could PATCH `is_featured`, `verification_status`, `status`, `plan_id`, and their own `rating_average`/`rating_count`. An earlier pass reported two of those as "accepted" when the row already held the target value, which proves nothing — it was redone writing values the row did not hold. `0022` makes all of them immutable from the client.

**Featured placement is now checked against the plan, for admins too.** `vendor_may_be_featured()` reads the live subscription's entitlements. Comping placement means changing the plan, which leaves a record. "Sponsored" is a disclosure (PRD 6.2); it has to correspond to someone paying. Cancellation retracts the flag, because the guard can only block setting it.

**Two webhook faults, both found by sending a signed request to the running route** (ADR-033):
- The idempotency claim was permanent. A first delivery that failed was answered `200 {"status":"duplicate"}` on every retry — the provider considered it delivered and the event was lost. Only `processed`/`ignored` short-circuit now.
- `subscriptions_provider_sub_idx` was a partial unique index, which Postgres will not infer for `ON CONFLICT` without a repeated predicate. Every `subscription.created` failed. `0023` makes it a plain unique index.

**Also shipped**
- Mock payment adapter behind a `PaymentAdapter` interface, signing with the same HMAC scheme a real provider uses — verifying signatures against an unsigned mock would verify nothing.
- Webhook route: raw-body HMAC verification before parsing, unknown event types recorded and ignored rather than retried.
- Vendor plan page: current entitlements, plan comparison, billing history. Replaces the `vendor-dashboard/plan` stub.
- CMS blog index and post pages from `posts`, statically rendered. Post bodies render as text, not `dangerouslySetInnerHTML` — editor HTML needs sanitising first (PRD 12).
- CSV export gated twice: `lead.read` for admins, plan entitlement for vendors, with RLS scoping rows a third time. Customer PII is deliberately excluded — export is bulk egress, and contact details are released per enquiry with consent (PRD 2.3). Cells beginning `=`, `+`, `-`, or `@` are neutralised against spreadsheet formula injection.
- `seed-demo-vendors.mjs` now creates the premium subscription for its featured vendor; the existing row was backfilled.

Tests: 119 unit (9 new), 168 RLS assertions across 7 probes (12 new), 22 E2E (3 new for the webhook). Lint, typecheck, build clean.

**Not done in this milestone:** admin plans/payments/reports screens (10 admin stubs remain), notification templates and the notifications log, audit-log writing on billing events, and E2E journey 3 — still blocked on the same missing SMTP as journeys 1 and 2.

## Milestone 7 — launch hardening (2026-08-02)

Scoped strictly to hardening per PRD 19.10 ("do not add new product scope"). The admin-screens item previously listed here as next was deferred — it is product scope, not hardening.

**Security review, run first.** Every table has RLS; every `SECURITY DEFINER` function pins `search_path`; `webhook_events` is correctly deny-all; cron is 401 without the secret in production. Two candidate gaps were probed and one was real.

**`analytics_events` was an open sink** (ADR-035). `anyone insert` granted anon INSERT with no `WITH CHECK`, so anyone holding the publishable key — which ships in the browser — could write forged `vendor_profile_view` rows for any vendor. Those feed `rebuild_vendor_metrics()`, so a competitor could inflate a rival's figures or a vendor their own. Closed in `0024`.

**The probe that found it first reported it blocked.** The insert used `Prefer: return=representation`; anon has no SELECT there, so a successful write returned 401. Verified properly by reading the table with the service role. That is now the standing rule: a write-refusal assertion must read the target table, never trust the write's status code.

**Shipped**
- `0024` — analytics sink closed; `record_vendor_profile_view()` de-duplicates by session over 30 minutes, so inflating a number costs a distinct session per event.
- `0025` — Postgres-backed fixed-window rate limiting. Increment and check are one statement, so two concurrent requests cannot both pass at the ceiling. Applied to enquiry, message, review, checkout, and newsletter. Fails **open** on infrastructure error (losing real enquiries to a database blip is worse than briefly accepting extra) and **closed** on an unattributable caller.
- CSP enforced on every response. `script-src` keeps `'unsafe-inline'` — see the blocker below.
- Audit logging on PII reveals, exports, and review moderation. Written with the service role because `audit_logs` has a read policy and no write policy: an actor must not be able to edit the record of what they did. IPs are hashed with a salt, not stored.
- Rate-limit pruning rides along with the nightly metrics cron.

Evidence: 12 static routes preserved, 168 RLS assertions across 7 probes, 119 unit tests, 22 E2E, and `/`, `/vendors`, `/blog`, `/auth/sign-in` each verified in a real browser with **zero CSP violations and zero JS errors**.

## Admin panel and locations (2026-08-02)

**All 36 Indian states and union territories seeded** (migration `0026`). Only six existed, because Milestone 1 seeded exactly the states the eight demo vendors sit in — fine for a demo, wrong for an admin adding a real city. Constituted as of today: Ladakh separate from Jammu and Kashmir, Dadra and Nagar Haveli merged with Daman and Diu.

New states land **inactive**. A state with no cities would otherwise show up in public filters as an empty destination. `/admin/locations` now lists all 36 with city counts and a Show/Hide control, and the "add a city" dropdown offers only visible states. Hiding a state that still has active cities is refused with the count, and the check runs **before** the write — an earlier draft updated first and then threw, which would have applied the change while reporting failure.

**Three admin stubs replaced**, chosen because live data was already accumulating behind them:
- `/admin/plans` — plans, prices, entitlements, and live subscriber counts per plan.
- `/admin/payments` — payments plus recent webhook deliveries, since when money looks wrong the first question is whether the provider's event arrived. Failed deliveries are surfaced at the top.
- `/admin/audit-log` — filterable by action, with PII reveals, exports, and role changes tinted. Read gated on `admin.manage`, because the log records whose details were revealed and reading it is itself privileged.

Admin panel is now **13 of 20 routes built**. Remaining stubs: `/admin/reports`, `/content`, `/blog`, `/customers`, `/leads`, `/settings`, `/admin-users`.

An admin account exists for the first time (`clatiansweb@gmail.com`, super_admin), created out-of-band via `npm run grant-admin` because there is deliberately no admin sign-up. Its password is in the build transcript and should be changed on first sign-in.

Verified by driving the pages signed in as that admin: all four render, no stub markers, zero page errors, 36 states listed, and the toggle round-trips including its refusal path.

## Public pages and account privacy (2026-08-02)

Seven stubs replaced. These were leftovers from milestones 2-7 rather than new scope — `CLAUDE.md` says a `MilestonePlaceholder` must be replaced in the milestone named on it and must not ship, and fourteen were in production.

**The five public pages are CMS-driven** (`/about`, `/contact`, `/help`, `/privacy`, `/terms`), reading `pages` through the cookie-free client so they stay statically rendered. Bodies render as structured text, never `dangerouslySetInnerHTML`: an admin account is not a trusted rendering context, and PRD 12 requires sanitisation before HTML is accepted. `## ` and `- ` give an editor headings and lists without any markup being interpreted.

**Legal pages: a judgement call worth knowing about.** `/privacy` and `/terms` held `PLACEHOLDER. This document must be drafted and reviewed by qualified counsel` and sat in `draft`, so the footer linked to two 404s. Both obvious options are bad — publishing invented legalese is misleading precisely because it looks authoritative, and 404ing leaves users unable to find out what happens to their data. Migration `0027` instead publishes a truthful plain-English description of what the system actually does, opening with an explicit notice that it is not lawyer-reviewed. Everything in it is verifiable in code: consent-gated contact release, the audit trail, review eligibility, the "Sponsored" label. **This does not clear the launch blocker** — counsel still has to produce the real documents.

**`/account/privacy`** records export and deletion requests against `data_requests`, which had existed unused. Deliberately a request rather than an instant action: deletion would otherwise remove enquiry history a vendor may need for a live booking. Status is visible to the person who asked, so "filed and forgotten" cannot look like success. One open request per type.

**`/account/settings`** covers profile and email notification groups. Preferences store only opt-*outs*, so a notification group added later reaches existing users by default instead of being silently off for everyone who registered before it existed. The page states plainly that no email provider is configured yet rather than offering switches that quietly do nothing.

Two bugs caught before they shipped: a `head: true` count read as `data.length` would have rendered zero holdings for everyone on the privacy page, and a duplicate-request message read "a export request".

Verified in a browser: all five public pages return 200 with real content and no stub markers, both account pages render signed in, and the export request round-trips including its duplicate refusal.

Remaining stubs (8): `/admin/reports`, `/content`, `/blog`, `/customers`, `/leads`, `/settings`, `/admin-users`, and `/vendor-dashboard/settings`.

## Every placeholder replaced (2026-08-02)

Zero routes now render `MilestonePlaceholder`. The last eight: `/admin/leads`, `/customers`, `/reports`, `/content`, `/blog`, `/settings`, `/admin-users`, and `/vendor-dashboard/settings`.

**A latent bug surfaced while building `/admin/settings`** (ADR-036). Migration `0019` guarded `sla_policy` with `has_admin_permission('settings.manage')` — a permission that exists in neither `admin_permissions` nor `lib/permissions/catalogue.ts`. `has_admin_permission` returns false for a code it has never seen, so the policy was deny-all and the response-time threshold was unconfigurable by anyone, including a super-admin. It failed closed, so never a security hole; it was a feature that silently did not work, and a `super_admin` PATCH returned `204` with zero rows matched — the shape of success. Fixed in `0028` and verified both ways: a super-admin can now set it, anon still cannot.

This is the drift CLAUDE.md invariant 3 exists to prevent. TypeScript caught it only because I happened to use the same wrong name in an action; nothing checks the SQL direction. **A parity test between `catalogue.ts` and `admin_permissions` is still missing** — ADR-004's original gap, now with evidence of what it costs.

**Design decisions worth knowing**
- `/admin/admin-users` cannot grant `super_admin`. A Server Action is a public endpoint, and Epic E requires that role not be creatable through public input, so the only path stays `npm run grant-admin`. The page says so rather than leaving an admin hunting for a missing control. Self-revocation is refused.
- `/admin/customers` shows activity counts, not contact details. Reading a customer's phone number is a PII reveal that belongs on the enquiry where consent was given and where it is audited — a browsable directory would route around that.
- `/admin/leads` shows no customer names for the same reason.
- CMS bodies are a plain textarea, not a rich-text editor: bodies render as structured text, so formatting controls producing HTML the site refuses to render would misrepresent the field.
- `/admin/settings` does not expose review-eligibility editing. Widening it changes who may review a business, so it goes through a migration where it is reviewable.

Verified signed in as an admin: **19/19 routes return 200 with no stub markers and no page errors**; settings save and persist; the content editor loads an existing page; `super_admin` is absent from the grantable roles; self-revoke is refused.

Admin panel: **20 of 20 routes built.** 119 unit tests, 168 RLS assertions, 22 E2E.

## Zero stubs (2026-08-02)

The last eight `MilestonePlaceholder` routes are gone. Every route in the app now renders real functionality.

**A latent bug found while building `/admin/settings`** (migration `0028`). Migration `0019` guarded `sla_policy` with `has_admin_permission('settings.manage')` — a permission that exists in neither `admin_permissions` nor `lib/permissions/catalogue.ts`. `has_admin_permission` returns false for a code it has never heard of, so the policy was deny-all: the response-time threshold could not be changed by anyone, including a super-admin, and a PATCH returned `204` with zero rows matched — the shape of success. It fails closed so it was never a security hole, only a feature that silently did not work.

TypeScript caught it: the same invented permission name was rejected in the Server Action, which prompted checking the SQL side. This is the drift CLAUDE.md invariant 3 warns about — the catalogue is mirrored in SQL, and the mirror had only been checked in one direction. Now `admin.manage`, verified both ways (a super-admin can write, anon cannot).

**Built**
- `/admin/leads` — every enquiry across vendors, filterable by overdue/unanswered/booked/spam. Overdue comes from the `enquiry_sla` view, so this and the vendor's own dashboard cannot disagree about what late means. No customer names or contact details.
- `/admin/customers` — accounts and activity counts, gated on `user.support`. Deliberately no contact details: a browsable directory would route around the per-enquiry consent and audit trail.
- `/admin/reports` — marketplace KPIs. Query lives in `dal/reports.ts`, partly because reads belong there and partly because `Date.now()` in a component body is what the React Compiler purity rule exists to catch.
- `/admin/content` and `/admin/blog` — page and post editors. Plain textarea, not rich text: bodies render as structured text, so formatting controls producing HTML the site refuses to render would misrepresent the field.
- `/admin/settings` — response deadline and review edit window, both read by SQL rather than only by the app.
- `/admin/admin-users` — grant and revoke roles, audited. `super_admin` is deliberately not grantable: a Server Action is a public endpoint, and Epic E requires the role not be creatable through public input, so the out-of-band script stays the only path. Revoking your own access is refused.
- `/vendor-dashboard/settings` — where the business stands and which screen owns each field, with an explicit note on why publication and verification are not editable there.

Verified signed in: all eight return 200 with the right heading, no stub markers, zero page errors. `/vendor-dashboard/settings` needed a real vendor membership to render — without one it correctly redirects to onboarding.

## Admin MFA (2026-08-02)

Launch blocker 4 closed. TOTP second factor plus a 30-minute privileged session (ADR-036).

Enforcement is staged so it cannot lock out the last administrator: with no factor enrolled every admin route redirects to `/admin/security`, which is reachable at aal1 and carries the enrolment form. That page calls `requireAdmin` and deliberately never `requireElevatedAdmin` — if it required a second factor itself, the only route that can fix a missing or stale factor would be unreachable.

Session age is read from the signed `amr` claim rather than a cookie, so nothing in the browser can extend a privileged session. Removing a factor itself requires aal2, or a stolen aal1 session could strip the protection it cannot satisfy. `getMfaState` fails open on infrastructure error — authorisation is unaffected, it only decides whether a code is asked for.

**A bug that took the page down rather than degrading it:** Supabase returns the enrolment QR as an `image/svg+xml` data URI, which `next/image` rejects outright. The throw crashed the route, so the one page able to enrol a factor rendered a global error. Now a plain `<img>`. Found by driving the flow with a real TOTP generator, not by reading the code.

Verified end to end: wrong code refused, real code elevates, all admin routes open afterwards, and with no factor every route lands on enrolment. Codes are rate limited to 10 per 15 minutes per user.

The test factor was removed afterwards, so the account is back to an un-enrolled state and the owner can set up their own authenticator.

## CSP nonce on dynamic routes (2026-08-02)

Launch blocker 2 substantially closed, and a wrong entry in the decision record corrected (ADR-037).

ADR-034 claimed a nonce was incompatible with static rendering and that Partial Prerendering was the way out. Both were wrong. Next takes the nonce from the **incoming request's** `content-security-policy` header, not from `headers()` in a layout — so the proxy setting the policy on the request is enough, and static rendering is untouched. PPR would not have helped anyway: a prerendered shell is built without a request and cannot carry a request-specific nonce. Enabling `cacheComponents` to try was blocked outright by the `export const revalidate` on ~25 routes.

Now shipping: dynamic routes (`/admin`, `/account`, `/vendor-dashboard`, `/auth`, `/vendors`, `/vendor`) get `'nonce-…' 'strict-dynamic'`, which makes conforming browsers ignore `'unsafe-inline'` and `'self'` there. Prerendered public pages keep `'unsafe-inline'`, because their scripts were built without a request and a nonce-only policy would blank them.

The strong policy now covers everything behind a login plus search and vendor profiles — the surfaces carrying sessions and user-supplied text. The weak one is left where the content is ours and static.

Verified: `/vendors` serves 63 nonced script tags, 12 static routes still prerendered, and `/`, `/vendors`, `/auth/sign-in`, `/blog` and a vendor profile all load with zero CSP violations and hydration intact.

## Realtime message thread (2026-08-02)

PRD 6.7's optional Realtime, behind `FEATURE_REALTIME_CHAT` (currently **off**). Migration `0029` publishes `messages` and sets `replica identity full` (ADR-038).

Security is the existing `messages: participant read` policy — Supabase evaluates table RLS before delivering a change, so there is no second ACL to keep in sync. `enquiries` and `notifications` are deliberately unpublished; the enquiry row carries budget and contact-consent fields.

**The same bug appeared twice.** A client that subscribes before it holds a session connects as anonymous; RLS filters every row while the channel still reports `SUBSCRIBED`. A feed that looks healthy and delivers nothing is indistinguishable from a quiet thread. First in the probe (a bearer header does not authenticate a WebSocket), then in the browser hook (subscribing during first render). Both now establish the session and call `setAuth` before subscribing.

**The first probe run was green and meaningless:** "a non-participant receives nothing — PASS" while the participant also received nothing. That assertion passes when Realtime is off, when the table is unpublished, and when the socket is unauthenticated. Fourth time in this project a green light was a disconnected wire.

Polling fallback runs only while the socket is disconnected, so the common case costs nothing. The handler calls `router.refresh()` rather than appending the payload, because the thread renders sender names through a join and a second rendering path would drift.

Verified: a message inserted elsewhere appears in a watching browser with no reload. 170 RLS assertions across 8 probes.

## Permission drift check (2026-08-02)

`npm run check:permissions` closes outstanding item 9 (ADR-039). It compares the real `catalogue.ts` — compiled and imported, never copied — against the database: permission codes both directions, roles both directions, the role→permission matrix both directions, and every permission named by a **deployed** policy or function.

That last one is the check that would have caught the `settings.manage` bug, and it took two attempts to get right.

The first version scanned migration *files*. Wrong twice over: the pattern matched text inside SQL comments, so `0028` — the migration that fixes the bug — read as if it still had it; and it reported history rather than current state, which cannot be corrected because a superseded migration must never be edited. It now reads `pg_policies` and `pg_proc`.

The second version passed a deliberately broken policy. Postgres normalises a stored policy expression, so `has_admin_permission('x')` comes back as `has_admin_permission('x'::text)` — the pattern matched no policy at all, and the codes it did find came only from function bodies. Proven by injecting a policy naming `totally.invented`, watching the check stay green, fixing the cast, and watching it fail with the offending permission and the exact policy named. Referenced-permission count went 8 → 12 once policies were actually being read.

A check that has never failed is indistinguishable from one that cannot fail, which is the fifth time that shape of problem has appeared here.

## Thread integrity and sign-out (2026-08-02)

**An administrator could speak as a customer.** `messages: participant send` gated inserts on `can_access_enquiry()`, which is true for the customer, for a vendor member, *and* for any admin holding `lead.read`. Right for reading — support needs to see a thread — wrong for writing. Observed in production: a `super_admin` posted two messages into a customer↔vendor thread and the vendor saw them attributed to the customer, because the UI labelled any sender who was not the viewer as the counterparty. Two independent faults compounding into a disclosure.

Migration `0030` adds `is_enquiry_party()` — customer or vendor member only, deliberately excluding admins — and repoints the insert policy at it. Reading is untouched: `can_access_enquiry` keeps its admin branch, so support can still open a thread and simply cannot add to it. Verified: customer and vendor post successfully, `super_admin` gets 403 and nothing lands, admin still reads both messages, an unrelated user can neither read nor write.

**The labelling half is now a tested function.** `senderLabel()` in `features/messaging` replaces the inline `senderName ?? counterpartyName`. The rule is that identity is never inferred from absence: only the known customer may fall back to the counterparty name, and anyone else is shown by their own name or as "Another participant". Six unit tests, including the exact regression and the case where `customerId` is unknown.

**Sign-out was not signing out.** The Server Action cleared the auth cookie and redirected, but the browser Supabase client kept its own session, so the header went on offering "Sign out" to somebody already signed out. The button now calls the client sign-out *and* the Server Action — the client call clears local state immediately, and the action is what actually ends the session, since a client-only sign-out would leave the cookie the server trusts intact. `SessionProvider` also re-reads on `visibilitychange` and `pageshow`, which catches a sign-out performed in another tab.

**A probe was reporting a permission failure that was really a typo.** The scoping fix on `vendor_documents` filtered `vendor_id=eq...`, but that column does not exist — documents hang off `verification_id`. PostgREST returned 400, `body` was an object rather than an array, and the assertion read that as "no rows" and reported it as an admin who could not read documents. The detail line printed `rows undefined`, which is the tell. Fixed to filter through `verification_id`, and the assertion now prints the HTTP status and error body when the response is not an array — a probe that cannot say *why* it failed sends you looking in the wrong place.

Tests: 125 unit (6 new), 169 RLS assertions, 22 E2E. Lint, typecheck, build clean; 12 static routes preserved.

## Reported from production: RLS error on send, and a hidden sign-out (2026-08-02)

Both reported from a real session. Neither was the fix in `0030` being wrong — it was working — but both were real defects around it.

**A raw Postgres message reached a customer's screen.** `new row violates row-level security policy for table "messages"` was rendered under the compose box. `translate()` mapped `42501` to `forbidden` but passed `error.message` through in preference to its own friendly text, so Postgres's internal phrasing — naming the table — went straight to the UI. That breaks CLAUDE.md invariant 7.

The fix could not be a blanket replacement: our own triggers `raise exception … using errcode = '42501'` with text written to be read ("Featured placement requires a plan that includes it"). `lib/db-errors.ts` now matches Postgres's built-in phrasings explicitly and replaces only those, leaving deliberate messages intact. Shared by the enquiry and review services so one of them cannot drift again.

**The composer was offered to someone who could not use it.** The account was an administrator viewing a customer's thread — allowed to read, blocked from writing by `0030`. The UI showed a compose box anyway, so the refusal arrived at the end of a typed message. `MessageThread` now takes `canSend`, mirroring the database's party check, and explains why instead.

**The header's sign-out was invisible and inert.** It was a second inline `<form action={signOut}>` with an icon and no label — read by the reporter as "there is no sign-out button" — and because it bypassed `SignOutButton`, it never got the client-session clearing, so the header kept showing "Account" after signing out. Replaced with the shared component. Verified: the header now reads `… Shortlist | Account | Sign out | List your business`, with no "Sign in".

**What the thread confirmed.** The enquiry had three senders: the customer, a vendor member, and a `super_admin` with two messages who is neither party — the exact incident `0030` was written for, still visible in the data.

Tests: 125 unit, 169 RLS assertions, 22 E2E.

## Reported: "messages visible to other users" (2026-08-02)

**The database was never leaking.** Probed first: two customers of one vendor, and one customer across two vendors, each read exactly their own rows — six assertions, clean. Cross-tenant isolation held throughout.

**The page was.** `getCustomerEnquiries()` had no ownership filter and trusted RLS, but `enquiries: participant read` admits the customer **or a member of the vendor** or an admin. So `/account/enquiries` listed, for a vendor member, every enquiry sent *to* their business as though they had sent it. The reporter holds both a customer account and a Blinksai membership, so their own account page showed them their inbox. Reproduced: a vendor member's query returned 3 enquiries, 0 of them theirs; an admin's returned the same 3 (ADR-037).

Fixed by making "mine" explicit — `getCustomerEnquiries`, `getOwnReviews`, `getReviewableEnquiries` filter on `customer_id`, and both enquiry detail pages 404 unless the viewer is the party that page is for. RLS still backs it; the policy answers "may this be read at all", not "is this yours".

**Chat naming, as asked.** The thread now shows both parties ("Between X and Y"), and a vendor sees the customer by name rather than the literal string "the customer" — `getEnquiry` exposes `customerName`, and `senderLabel` prefers a sender's own profile name.

**The regression test is at the page level, and was seen to fail.** An RLS probe passes throughout — it was passing throughout. `tests/e2e/conversation-privacy.spec.ts` signs in as a vendor member and asserts the customer page neither lists nor opens another person's enquiry; reverting the fix produces `Expected 404, Received 200`.

Tests: 125 unit, 169 RLS assertions, 23 E2E (1 new).

## Real names in the chat (2026-08-02)

Requested: show the customer's account name and the vendor's registered business name, never "Customer" or "Vendor".

**Why it was showing generic labels.** Neither side can read the other's row. `profiles: own row read` limits `profiles` to your own row, so the vendor could not resolve the customer's name and the customer could not resolve the replying staff member's. `vendor_memberships` is likewise scoped, so the customer could not even tell a reply came from the vendor's side — it fell through to "not a participant". Both policies are right as general rules; the names simply were not reachable.

Migration `0031` adds `enquiry_thread_parties()`, guarded by `can_access_enquiry` — for a thread you are already party to, it returns both display names and the vendor's member ids. **Names only: no email, no phone.** Contact details stay behind the per-enquiry consent gate and its audit trail (PRD 2.3); being in a conversation is a reason to know what to call someone, not a reason to receive their phone number. Ask about an enquiry you are not party to and it returns nothing.

**A vendor-side sender is shown as the business, not the individual.** The customer enquired with a business; which staff member replies is internal detail, and a stranger's personal name where the business is expected reads as the wrong person answering.

**Sender side is resolved in the DAL**, not guessed in the component. Inferring "not me, therefore the other party" is exactly how an administrator's messages were once displayed as the customer's, so `senderRole` is computed against the real membership list and a third party is labelled as itself.

Verified in a browser as both parties on the same thread: each sees `Priya Sharma and Blinksai` in the header, the customer's message attributed to `Priya Sharma`, and the vendor's to `Blinksai` — with a regex assertion that no generic label appears in either view.

Also gave the one nameless account a name; every profile now has one, and sign-up has always required it.

Tests: 125 unit, 169 RLS assertions, 23 E2E.

## Navbar reverted, logo kept (2026-08-02)

At the owner's request the header was restored to its pre-Milestone-5 form, with the new logo re-applied. Reverted: the "All India" city selector, the labelled "Sign out" button (back to an icon), the removal of the hamburger, and `useSession` (back to `signedIn` / `signOutAction` props).

**The measured cost, since it is not visible from the page.** The header taking `signedIn` as a prop means both layouts read the session again, which opts the public tree out of static rendering. Static routes fell from **12 to 5**, and `/`, `/about`, `/blog`, `/categories`, `/cities`, `/contact`, `/help`, `/privacy` and `/terms` are dynamic again — undoing ADR-030, which had taken TTFB from ~0.95s to ~0.15s for Indian traffic. This was raised before the change and chosen deliberately.

**Two consequences worth knowing.**
- Mobile now has **two navigation systems at once**: the restored hamburger and the bottom tab bar, both listing the same destinations. Say the word and I will drop one.
- The icon-only sign-out is back, which is the control originally reported as "why is the sign in button still there".

The E2E test for the header city selector was deleted rather than weakened — a test kept alive against a removed control either fails forever or gets loosened until it asserts nothing. City filtering still works from the search page and is covered there. The "no session markup" test was kept but its rationale rewritten: it guarded a prerendered page, and now guards against a signed-out request coming back signed-in.

Tests: 125 unit, 22 E2E, lint/typecheck/build clean.

## Logo on the remaining headers (2026-08-04)

The owner screenshotted `/auth/sign-in` and `/auth/sign-up` still showing the plain-text wordmark. Four surfaces draw the brand outside `SiteHeader` and each needed the change: `app/(auth)/layout.tsx`, `app/admin/layout.tsx`, `app/vendor-dashboard/layout.tsx` (the auth pages share one layout).

The filter is not the same on all of them. The admin bar is `sand-950`, so the logo takes the footer's `brightness-0 invert`; the auth panel (`sand-100`) and the vendor bar (white) keep the artwork's own maroon and gold. Copying the header's conditional filter everywhere would have wiped the mark off the two light bars — each was screenshotted at 420px to confirm.

Tests: 125 unit, 16 E2E passed / 10 skipped (the skips need SMTP), lint/typecheck/build clean.

## Editing and deleting a city (2026-08-04)

The admin Locations table listed cities with no way to change or remove one, so test rows like "Blinksai" and "blin" were stuck there. Both are now on each row: `src/components/admin/city-rows.tsx`, `features/taxonomy/actions.ts`, migrations `0032`/`0033`, probe `scripts/rls-taxonomy-probe.mjs`.

Edit needed no new server code — `saveCityAction` has always taken an `id` and updated; nothing ever sent one.

**Delete was not safe to add as written.** Seven tables reference `cities` and two of them cascaded: `areas.city_id` and `vendor_service_areas.city_id`. A delete on a city in use would have removed vendors' coverage rows and nulled `vendors.primary_city_id` — dropping them out of search silently, with nothing recorded. Mumbai has three of each today. The only reason it had never fired is that no delete button existed. So `0032` makes those two FKs (and `cities.state_id`) RESTRICT, and `delete_city()` counts all seven references behind a `for update` on the city row, which an FK insert's `for key share` cannot cross. The constraint is the guarantee; the function supplies the message: *"Mumbai is still in use (3 vendors based there, 3 vendors covering it, 2 enquiries). Hide it instead."*

**A unit test caught a leak before it shipped.** `0032` raised its refusal as `foreign_key_violation`, and the action decided whether a message was safe to show from the code alone — but Postgres raises 23503 itself, with text naming the constraint and child table. `0033` moves to `PT409`/`PT404`/`PT403`, which Postgres never raises, so the discrimination is exact rather than a guess at message text. Same class of bug as the raw RLS message that reached a customer's screen earlier; the fix is the same shape as `lib/db-errors`.

**Scope.** Cities only. States keep their existing Hide/Show toggle — the 36 are seeded and fixed, so a delete there is a footgun, not a feature. Categories and Attributes have the same missing controls and are untouched.

Tests: 130 unit (5 new), 16 E2E / 10 skipped, 178 RLS probe assertions across 9 probes (7 new), lint/typecheck/build clean.

Note: `npm run db:apply` reapplies from `0001` and is not idempotent, so it cannot apply a single new migration; `0032` and `0033` were applied individually. The realtime probe flaked once on a websocket race and passed on rerun — unrelated to this change.

## Edit and delete across the admin catalogue (2026-08-04)

Extends the Locations work to every admin screen whose rows the admin owns. Migration `0034`, `features/admin/delete-errors.ts`, `components/admin/{delete-row-button,category-rows,attribute-rows,plan-form}.tsx`, `features/billing/{plan-schema,plan-actions}.ts`, plus the CMS delete actions.

| Screen | Edit | Delete |
| --- | --- | --- |
| Locations (cities) | done in the previous change | refuses while in use |
| Categories | UI only — `saveCategoryAction` already took an `id` | refuses while in use |
| Attributes | UI only — `saveAttributeAction` already took an `id` | deletes, reporting the vendor answers that go with it |
| Blog posts | already existed | unguarded; nothing references `posts` |
| Content pages | already existed | refuses the five that back public routes |
| Plans | **new** — no save action existed at all | refuses while any subscription or vendor points at it |
| Admin users | `grantAdminRoleAction` / `revokeAdminRoleAction` already wired | already wired |

**Attributes are the one delete that proceeds rather than refusing.** `vendor_attribute_values` cascades from `category_attributes`, and there is no way to hide an attribute — refusing while any vendor had answered would make it permanently undeletable. So it deletes and returns the count, and the page renders that count next to the button. Consent, not a surprise.

**System pages.** Five slugs back fixed routes (`/privacy`, `/terms`, `/about`, `/contact`, `/help`). They now carry `pages.is_system`, `delete_page()` refuses them, and the screen shows "System page" instead of offering a button that could only fail.

**Plans previously said pricing changes should go through a migration "so the change is reviewable".** That is now editable, with the reviewability moved into the form: entitlements are eight typed fields, not a JSON textarea, because `vendor_may_be_featured()` reads that object in SQL where a mistyped key is not an error — it is absent, and the vendor silently loses the entitlement. The live subscriber count is shown in the editor header, since a change applies to them immediately.

**Deliberately not given delete buttons**, because these are records of what happened rather than a catalogue: audit log (RLS already forbids it, which is correct), payments and webhook events, leads/enquiries, customers, reviews (moderation exists), vendors (approve/suspend exists), verifications, listings (versioned moderation), settings and reports (no rows to remove).

Tests: 132 unit (7 new for the shared error mapper), 16 E2E / 10 skipped, 192 RLS probe assertions across 9 probes (taxonomy probe 7 → 21), lint/typecheck/build clean.

**One thing I broke and repaired.** While driving the UI I clicked delete on a real category, "CAR", rather than a throwaway row, and it was removed. Restored from a screenshot taken minutes earlier: name, slug `car`, sort order 0, visible. Its `parent_id` was not recoverable — the row rendered as a sub-category and nothing recorded which parent — so it is back as top-level and needs reassigning. Destructive flows must be driven against rows the probe created, not live ones.

## Both workspaces on a phone (2026-08-04)

Reported as "vendor dashboard in mobile view does not look good", with a screenshot of the header covering only part of the screen. It affected both workspaces and every route under them.

**Cause.** The section nav is a grid item, and a grid item's default `min-width: auto` refuses to shrink below its content. Fourteen vendor links forced the column to 1221px and the document to 1237px; the customer's eight forced 760px. The browser then zoomed the page out to fit, so the header — correctly 390px — covered a third of a 1237px page. The `overflow-x-auto` already on the list never engaged, because its containing block was already wider than the screen.

**Fix.** `min-w-0` on the nav, which is what finally lets the overflow rule work. Both layouts had the same duplicated markup, so it became one `components/shared/dashboard-nav.tsx`, which also fixes something neither had: **the current section was never marked**. On a strip that scrolls past its own edge that leaves nothing to orient by, so the active link now carries `aria-current`, is styled, and is scrolled into view on arrival. Two smaller things: the mobile grid rows were stretching to fill `flex-1` and left ~400px of blank space above the heading (`content-start lg:content-normal`), and the overview stat cards were full-width blocks stacked three deep (`grid-cols-3` from the narrowest width).

Desktop is unchanged — still a 15rem vertical sidebar — except that it now highlights the current section too.

**Why it shipped.** The homepage has had a "does not scroll sideways" assertion since the mobile work. These two routes had none. `tests/e2e/dashboard-mobile.spec.ts` adds three, and they were verified to fail without the fix (`innerWidth` 778 rather than 390) — an assertion that has never failed measures nothing.

Tests: 132 unit, 19 E2E passing (3 new), 192 RLS probe assertions, lint/typecheck/build clean.

**Worth knowing: the E2E suite skips more than it needs to.** `playwright.config.ts` does not load `.env.local` into the test process, so anything needing Supabase credentials skips. Run with the file sourced and it is 25 passed / 4 skipped rather than 16 / 13 — the extra nine pass, they were simply never running. The earlier note that ten skips "need SMTP" was wrong; only the sign-up-form test does. A one-line config change would fix it, left alone here because it changes CI behaviour and was not part of this request.

## Newsletter field legibility (2026-08-04)

Reported as "email placeholder is not looking good" on the footer signup.

Every colour in that footer is white at some alpha over a near-black maroon, so each one picks up the background's warmth. The placeholder at `white/50` composited to rgb(159,142,141) — a muddy brown-grey — and the field at `white/10` came out rgb(72,41,40) against a rgb(40,3,2) footer, close enough that it did not read as an input at all. Raised to `white/70` on `white/15` with a `white/30` border: 4.85:1 → 7.18:1, and the field now looks like a field.

**The measurement is the point.** The reported version measured **4.85:1 — it passed WCAG AA** and still looked wrong. So the regression test asserts 7:1, not 4.5: an AA floor here would pass the exact bug it exists to catch. Both new tests in `public-discovery.spec.ts` were verified to fail against the old styling.

**A mistake caught on the way.** The first attempt added `focus:outline-none` with only a border-colour change to replace it. Tailwind's `focus:` utility outranks the bare `:focus-visible` rule in `globals.css`, so that would have removed the focus indicator outright. The outline is now overridden to white rather than suppressed — the global rule draws it in `brand-500`, a maroon that all but disappears on this panel — and a second test asserts it stays visible.

Tests: 132 unit, 27 E2E passing (2 new, both run unauthenticated so they hold in CI), lint/typecheck/build clean.

## PWA and Android app (2026-08-04)

Same project, extended — no second codebase. Full detail in `docs/MOBILE.md`.

**The decision everything else follows from.** Capacitor normally bundles a static export. This app has 17 `'use server'` modules and 52 `force-dynamic` routes, and `output: 'export'` refuses to build a project containing a single Server Action — so bundling would mean deleting the mutation layer and moving authorisation into the client. The WebView loads the deployed origin instead. That keeps Server Components, Server Actions and RLS untouched, and it is also what makes the auto-update requirement true by construction: there is no bundled copy to go stale, and no store review between a fix and its users. The cost is that the app needs a connection, and a shell this thin has to earn its Play Store listing under the "minimum functionality" policy.

**Caching is deliberately minimal.** Only `/_next/static/**` (content-hashed, so it invalidates itself) and `/offline`. No HTML at all — every route renders per request, and a cache is not partitioned by session, so caching `/account` risks serving one person's page to the next. Verified against a production build: 21 static entries, `/offline`, zero HTML, and repeat navigations still issue document requests.

**Admin stays on the web.** Capacitor appends `WeddingMallApp` to the user agent; `src/proxy.ts` redirects `/admin` to `/app/web-only`. Recorded plainly in `lib/native.ts` and the docs: **this is product scope, not a security boundary.** A user agent is a request header. `requireAdmin`, `assertPermission` and RLS are unchanged and remain the actual gate.

Files: `app/manifest.ts`, `public/sw.js`, `components/pwa/{service-worker,native-shell}.tsx`, `app/offline/`, `app/app/web-only/`, `lib/native.ts`, `capacitor.config.ts`, `android/`, `docs/MOBILE.md`. Icons and splash generated from the existing logo with `sharp`.

Two things worth knowing:

- **`@capacitor/assets` was installed and then removed.** It is a run-once icon generator that pulled in 1 critical and 8 high advisories via `@trapezedev/project`. Icons are generated with `sharp`, already a dependency. Net vulnerabilities added by this change: **zero** — the 4 remaining are pre-existing (`next`, `postcss`, `sharp`, and `js-yaml` via eslint).
- **The Gradle build now runs.** See the section below.

Tests: 132 unit, 33 E2E passing (6 new in `pwa.spec.ts`, all unauthenticated so they run in CI), lint/typecheck/build clean.

## The APK actually builds (2026-08-04)

JDK 21 (Temurin) and Android SDK 36 installed into the home directory — no sudo, no system paths, no Android Studio. `assembleDebug`, `assembleRelease` and `bundleRelease` all succeed: 4.5 MB debug APK, 3.2 MB unsigned release APK, 3.1 MB AAB.

**The generated Capacitor template does not build as shipped.** Three defects, all fixed:

1. **`colors.xml` did not exist** while `styles.xml` referenced `@color/colorPrimary` and `@color/colorPrimaryDark` — fails resource linking. (Caught before the first build.)
2. **AGP 8.7.2 was too old.** `androidx.browser:browser:1.9.0`, pulled in by `@capacitor/browser`, requires AGP 8.9.1+ and is compiled against API 36. Now AGP 8.10.1, `compileSdkVersion = 36`.
3. **Duplicate Kotlin stdlib classes.** The Cordova compatibility chain pins `kotlin-stdlib-jdk8:1.6.21` while `kotlin-stdlib` resolves to 1.8.22, and Kotlin 1.8 merged the jdk7/jdk8 content into the main artifact — so both jars ship the same classes. `android/app/build.gradle` aligns every `kotlin-stdlib*` artifact on one version, which is Kotlin's own remedy rather than excluding a jar other callers may still resolve.

**Verified by opening the APK, not by reading the exit code.** Package `com.weddingmall.app`, label `WEDDING MALL`, launcher icon is the WeddingMall mark rather than the template robot, splash at every density, the four upload permissions, and `server.url`/`appendUserAgent` baked into `assets/capacitor.config.json`.

Release signing is wired in `build.gradle` reading an untracked `keystore.properties`, and degrades to an unsigned build when absent so CI and fresh clones still work. Tested with a throwaway keystore that produced a correctly signed APK; the key was deleted immediately. **No production signing material was created** — that is the owner's to generate, and a key that has appeared in a transcript should never sign a listing.

R8 is deliberately off: Capacitor resolves plugins reflectively from `capacitor.plugins.json`, so shrinking without a tested keep-rule set yields an APK that builds, installs, and fails the first time a plugin is called.

**One thing the build broke and I fixed:** `android/` build output contains a vendored copy of Capacitor's `native-bridge.js`, which took `npm run lint` from clean to 34 warnings. `eslint.config.mjs` now ignores `android/**` — the inherited `build/**` pattern is root-relative and does not reach it.

**Outstanding, with a date on it: `targetSdkVersion` is 35, and Google Play requires API 36 for new apps and updates from 31 August 2026.** `compileSdk` is already 36 so it is a one-line change, left undone deliberately: API 36 makes edge-to-edge layout mandatory, which changes how the WebView sits under the status bar. `StatusBar.overlaysWebView: false` should cover it, but that needs checking on a device or emulator, which has not been done.

Tests: 132 unit, 33 E2E, lint/typecheck/build clean.

## The app opened to the browser instead of itself (2026-08-04)

Reported straight after the first APK: it launched and immediately handed off to Chrome.

**Cause, and it was my error.** `weddingmall.co.in` 308-redirects to `www.weddingmall.co.in`. Capacitor compares every navigation against `server.hostname`, so the redirect looked like a jump to a foreign site and the WebView handed it to the system browser before rendering anything. I had already been caught by that same redirect earlier in this project and still configured the apex.

Fixed by pointing at the canonical host and listing both spellings — plus Supabase, so an auth or storage response cannot bounce someone out mid-flow:

```
url: 'https://www.weddingmall.co.in'
allowNavigation: ['www.weddingmall.co.in', 'weddingmall.co.in', '*.supabase.co']
```

The same assumption was wrong in `NativeShell`, which used strict origin equality to decide whether a link was external — so any link written without the `www` would also have opened the browser. Extracted to `lib/same-site.ts` and given 6 unit tests, because this cost a broken build.

**Verified on an emulator this time, not just by reasoning.** Installed the Android emulator and a Pixel 6 / API 35 image, and drove the app: it launches into the site, in-app navigation works (Home → Explore → `/vendors`, 9 vendors, tab marked active), and the process stays foreground rather than punting to Chrome.

**A second bug the device run found.** The back button exited the app from `/vendors` instead of returning Home, because I had special-cased the top-level tabs as exit points. Android's rule is simpler and is now what the code does: pop history if there is any, exit only when there is none.

**The thing that made debugging confusing, now documented.** The APK loads the deployed site, so the app's JavaScript comes from production — a local JS change does not appear no matter how many times the APK is rebuilt. That is the auto-update property working as intended, but it means native changes and web changes ship by completely different routes. `docs/MOBILE.md` now says so near the top.

Also fixed: `android:usesCleartextTraffic="false"` was hardcoded in the manifest and collided with the `true` Capacitor injects for local-dev mode, failing the manifest merge. Removed — Android already defaults it to false for targetSdk 28+, so it was buying nothing.

Tests: 138 unit (6 new), lint/typecheck/build clean.

## iOS platform (2026-08-04)

Added to the same project with `npx cap add ios`. Bundle id `com.weddingmall.app`, name `WEDDING MALL`, deployment target iOS 15. Full guide in `docs/MOBILE.md`.

**The thing worth catching, and it was nearly shipped broken.** `appendUserAgent` was declared under `android` in `capacitor.config.ts`. Android worked, so the admin-block requirement looked met — but iOS would have shipped without the marker and quietly served the admin workspace inside the app. Nothing would have failed; it simply would not have done what was asked, on one platform. The marker now sits at the **root** of the config, and `tests/native-detection.test.ts` (6 cases) plus `tests/e2e/pwa.spec.ts` assert both platforms.

**Two more that would only have appeared later:**

- **The generated Podfile does not install.** It pins `platform :ios, '14.0'` while every Capacitor 8 pod declares `deployment_target = '15.0'`, so `pod install` fails on a fresh `cap add ios`. Podfile and all four `IPHONEOS_DEPLOYMENT_TARGET` entries raised to 15.0. Same class of template defect as the Android `colors.xml` and AGP problems.
- **Swipe-back does not exist by default.** iOS has no hardware back button and `WKWebView` ships with `allowsBackForwardNavigationGestures` off; Capacitor neither enables it nor exposes an option. `MainViewController.swift` subclasses `CAPBridgeViewController` to turn it on, registered in the Xcode target via the `xcodeproj` gem rather than by hand-editing the pbxproj.

**File upload needs four Info.plist keys.** iOS terminates the process when the WKWebView picker requests an undeclared permission — a missing `NSCameraUsageDescription` is a crash on the vendor's portfolio screen, not a declined prompt.

**Honest limit: the iOS project has never been compiled.** Xcode cannot be installed without an Apple ID sign-in — the Mac App Store and developer.apple.com both gate it — and that is the owner's credential, not something to automate. `xcodebuild`, `actool` and `ibtool` are all Xcode-only stubs in the Command Line Tools.

So the gap was closed as far as it can be: `npm run verify:ios` (`scripts/validate-ios.rb`) runs **14 structural checks** without Xcode — project opens, no dangling file references, the Swift file is in Compile Sources, bundle id and deployment target consistent across configurations, storyboard names a class that exists, asset catalogs reference images that exist, icon is 1024×1024 with no alpha (an App Store rejection that otherwise lands *after* the archive is built), Podfile and lock agree. `swiftc -parse` passes on the one hand-written Swift file.

That is still weaker than Android, which was built and driven on an emulator. The first `npx cap open ios` remains the real test.

Getting CocoaPods running at all took a detour: the system Ruby is 2.6 and modern CocoaPods requires 3.1+, so the dependency chain was resolved by pinning (`ffi` 1.16.3, `securerandom` 0.3.2, `drb` 2.0.6, `i18n` 1.14.8, `zeitwerk` 2.6.18, `activesupport` 6.1.7.10, `concurrent-ruby` 1.3.4 — the last because 1.3.5 dropped an implicit `logger` require activesupport 6.1 depends on). The documented recommendation for the owner is `brew install ruby` instead.

Tests: 144 unit (12 new), 8 E2E in `pwa.spec.ts` covering both platforms, lint/typecheck/build clean.

## Android targetSdk 36 (2026-08-04)

Google Play requires API 36 for new apps and updates from **31 August 2026**, three weeks out. `targetSdkVersion` was 35; it is now 36, and `compileSdk` was already there.

The reason it had been left is that API 36 makes edge-to-edge layout mandatory, which changes how the WebView sits under the status bar — so it was checked on an emulator rather than flipped and hoped over. Measured against the API 35 screenshot pixel by pixel: **the header starts at exactly the same row (y=130) under both**, the top status-bar strip is unchanged, the bottom tab bar still clears the gesture bar, and navigation and back behave identically. `StatusBar.overlaysWebView: false` is what handles it.

Debug APK, unsigned release APK and AAB all rebuild clean.

## Xcode remains blocked, and why

Installing Xcode requires signing in to an Apple ID — the Mac App Store and developer.apple.com both gate it, the latter with a 302 to an auth wall. That is the owner's credential, so it is not something to automate. There is no Xcode, no `.xip` installer and no iPhoneOS SDK on this machine; the Command Line Tools carry macOS SDKs only, and `xcodebuild`, `actool` and `ibtool` are all Xcode-only stubs.

The iOS project is fully configured and passes `npm run verify:ios` (14 structural checks), but it has never been compiled and that will not change without about two minutes of the owner's hands.

## The iOS app builds and runs (2026-08-11)

Xcode arrived on the machine, so the gap flagged as "never compiled" is closed.

`xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator build` returns **BUILD SUCCEEDED**, and the app installs and launches on an iPhone 17 simulator: it loads the live site, renders correctly with the notch and home indicator respected, and the process stays alive. `MainViewController.swift` — the one hand-written Swift file, added to the target with the `xcodeproj` gem — compiles and links.

Getting there needed the iOS platform itself: Xcode ships the SDK but not the simulator runtime, and without it there are no build destinations at all. `xcodebuild -downloadPlatform iOS` pulled the 8.52 GB runtime with no Apple ID required.

**Driven on an iPhone 17 simulator**, once `sudo xcode-select -s` was run to unstick the simulator tooling:

- launches and loads the live site, notch and home indicator respected
- the splash screen renders — flat-white mark on brand maroon, matching Android
- in-app navigation works, including the signed-out auth redirect
- **swipe-back works** — a left-edge swipe returned from sign-in to the homepage, which is the single job `MainViewController` exists for
- **the user-agent marker is really sent.** Pointed at a local echo server, the WebView reported `Mozilla/5.0 (iPhone; …) Mobile/15E148 WeddingMallApp`. That was the last unproven link in the admin block — the server-side redirect was already covered by `tests/e2e/pwa.spec.ts`, and this confirms the app sends what that test assumes.

**Still unverified:** vendor file upload, because reaching the picker needs a signed-in vendor account and the test account is not one. It is the one that crashes rather than degrades if an `Info.plist` key is wrong, so it is worth doing first on a real account. Everything needing a signed build — physical device, archive, App Store — needs an Apple ID attached in Xcode.

The simulator-control tooling reports Xcode "not selected" even though `xcode-select -p` correctly returns `/Applications/Xcode.app/Contents/Developer` and `simctl` works from the shell — a stale check from before Xcode existed, which is why those three are still outstanding rather than done.

## Moved off Vercel to Railway (2026-08-12)

Vercel suspended the account — `HTTP 402`, `x-vercel-error: DEPLOYMENT_DISABLED` — which took the website *and both mobile apps* down, since the apps load the deployed origin.

Redeployed to Railway (project `harmonious-simplicity`, service `WeddingMall.co.in`, building from the GitHub repo). All 17 environment variables ported, `NEXT_PUBLIC_APP_URL` repointed, Node pinned to 20 to match what the build and tests were verified on.

Verified live rather than assumed: every public route 200s, real Supabase data renders, the CSP and HSTS headers survived the move, and the admin block still behaves correctly on both a browser agent (→ sign-in) and the app agent (→ `/app/web-only`).

**One defect I introduced and fixed.** I created the service domain with `targetPort: 3000`, assuming Next's default. Railway injects `PORT=8080` and `next start` honours it, so the build succeeded, the app ran, and every request 502'd. The logs said `Local: http://localhost:8080` in plain sight. Port on the domain must match the port the app was actually told to use.

Custom domains `weddingmall.co.in` and `www.weddingmall.co.in` are attached and waiting on DNS — until those CNAMEs are changed at the registrar the apps still point at the dead Vercel origin.

**Worth recording about the architecture:** a 402 is a *successful* HTTP response, so the service worker's offline fallback never fired and both apps rendered Vercel's suspension page. The trade that makes updates instant also makes a hosting outage an app outage.

## Blocked / outstanding

1. **No SMTP provider, and Supabase rejects test domains.** The default mail is rate-limited to a few per hour, and Auth refuses reserved domains (`example.com`, `.test`) at public sign-up. So sign-up confirmations and the sign-up E2E test cannot run reliably. Set `EMAIL_PROVIDER_API_KEY` + `EMAIL_FROM` (Resend, per PRD 8.1) and use a real domain — the adapter is written and will pick it up (ADR-022).
2. **Email notifications are logged, not sent,** for the same reason. `sendEmail()` falls back to a console provider that records a redacted line.
3. **Message attachments are not implemented.** PRD 6.7 wants them, but they need malware scanning first; `message_attachments` has no insert policy, so the table is inert rather than half-open.
4. ~~Realtime is not wired.~~ Built 2026-08-02 (ADR-038), behind `FEATURE_REALTIME_CHAT`, which is off. Set it to `true` to enable; the polling fallback covers the off case.
5. **Numeric attribute filters are exact-match only** (ADR-018).
6. **Media is approved wholesale with the listing** — an admin cannot reject one image.
7. ~~Screens remaining as stubs.~~ All replaced 2026-08-02. No route renders `MilestonePlaceholder`.
8. **Google OAuth not configured.** Project has email auth only; PRD 6.4 requires Google.
9. ~~Permission-catalogue parity is unchecked.~~ Checked 2026-08-02 by `npm run check:permissions` (ADR-039): codes, roles, and the role→permission matrix in both directions, plus every permission named by a **deployed** policy or function. The `vendor_can()` half stays open — that matrix lives in a PL/pgSQL body with no table to diff against, and the script reports the gap rather than skipping it silently.
10. ~~Public pages render dynamically.~~ Fixed 2026-08-02 (ADR-030). Remaining dynamic public routes are `/vendors*` (search parameters) and `/vendor/[slug]*` (personalised enquiry state), both legitimately so.
11. ~~CSP not set.~~ Enforced 2026-08-02. Dynamic routes use `'nonce-…' 'strict-dynamic'`; prerendered public pages keep `'unsafe-inline'` because their scripts were built without a request (ADR-037). The earlier claim here — that a nonce required Partial Prerendering — was wrong and is corrected in ADR-037.

## Credentials note

**The Vercel token, Supabase anon key, service-role key, and database password were all shared in a chat transcript.** Rotate all four. The service-role key is the urgent one — it bypasses RLS entirely. After rotating Supabase keys, update `.env.local` _and_ the Vercel environment.

## Next task

Launch blockers, highest first:

1. **Rotate the four credentials** shared in the build transcript — service-role key first, since it bypasses RLS entirely. Then the anon key, database password, and Vercel token. Update `.env.local` *and* the Vercel environment.
2. **`script-src 'unsafe-inline'` on prerendered public pages only** (ADR-037). Dynamic routes now use a nonce with `strict-dynamic`. The remaining gap covers static marketing pages, whose content is ours; closing it would mean giving up prerendering, which is not a trade worth making.
3. **No SMTP provider.** *Deferred by the owner, 2026-08-02 — will be done later.* Blocks sign-up confirmation, every email notification, and E2E journeys 1-3. Set `EMAIL_PROVIDER_API_KEY` + `EMAIL_FROM` on a real domain; the adapter is written and will pick it up with no code change.
4. **Admin MFA is built but not enforced.** Shipped 2026-08-02 (ADR-036), then switched off at the owner's request the same day: enforcing it blocked access to the admin panel. `ADMIN_MFA_REQUIRED=false`. Enrolment stays available at `/admin/security` for anyone who wants it on their own account. Set the flag to `true` to require it again — the challenge, the 30-minute privileged session, and the enrol-first redirect are all still in place and still tested. PRD 10.3 asks for this, so it remains a launch consideration rather than a closed item.
5. **Legal text still needs counsel** (PRD 14.3). *Deferred by the owner, 2026-08-02 — will be done later.* `/privacy` and `/terms` publish a truthful plain-English description of actual behaviour, clearly labelled as not lawyer-reviewed. That removed the 404s, not the legal requirement. Replace the bodies via `/admin/content` when the real documents exist — no deploy needed.

Then product scope: message attachments, Realtime, and Google OAuth. No placeholder routes remain.

## Vendor listing smoothness pass (2026-08-26)

Six issues found in the post-onboarding listing flow and fixed:

1. **`/vendor-dashboard/listing` rendered the old 2-step form** — it imported `ListingForm` from `onboarding-forms.tsx`, which only shows Business + About. Switched to the full `SinglePageListingForm` via `WizardShell`, matching the wizard entry page.
2. **Media upload was a mock** — `WizardMediaStep` called an inline stub returning `{ uploaded: 0, requestId: 'mock' }`. Switched to the real `uploadMediaAction` from `features/listings/actions.ts`.
3. **No scroll-spy on the sidebar** — clicking a section jumped smoothly but there was no visual indication of which section was in view. Added `IntersectionObserver` with `-80px -55% 0px` margins; the active item gets a branded badge instead of the plain completion dot.
4. **Progress bar disagreed with the completion scorer** — the UI considered media complete at `> 0` photos while the backend scored it at `>= 3`. Synced to `>= 3`.
5. **Submit-step "add now" links were broken routes** — they pointed at `/vendor-dashboard/list/{key}` URLs that hit a redirect stub. Rewrote as `#step-{key}` anchors with a click handler that smooth-scrolls to the right section.
6. **Dead code** — `WizardStepper`/`WizardSection` in `wizard.tsx` were never imported; `SubmitListingCard` was removed from `listing/page.tsx` and is now fully unused. Deleted `wizard.tsx`; added a tombstone comment in `submit-listing-card.tsx` (kept the file in case the old onboarding flow at `/vendor-dashboard/onboarding` still needs it).

Files changed: `app/vendor-dashboard/listing/page.tsx`, `components/vendor/listing-form.tsx`, `components/vendor/wizard-steps.tsx`, `components/vendor/wizard.tsx` (deleted), `components/vendor/submit-listing-card.tsx`, `docs/STATUS.md`.

Checks: 144 unit tests pass, `tsc --noEmit` clean, `eslint` clean. Build fails only because `.env.local` is absent (expected on this machine); deploys fine with real env vars.

Keep probing before building. A live privilege escalation has been found this way in each of the last three milestones — reviews (ADR-031), vendor columns (ADR-032), analytics (ADR-035) — and in every case reading the code looked fine.

## Vendor onboarding: progressive step redesign (2026-08-26)

The listing wizard showed every step's form stacked on one page. It now shows
one step at a time with a visual journey beside it, per the redesign brief.

**New:** `components/vendor/wizard-config.ts` (the seven steps, plus
`isStepComplete`/`isStepUnlocked` in one place rather than seven copies of the
navigation logic) and `components/vendor/wizard-stepper.tsx` (vertical rail on
desktop, horizontal pill rail below `lg`, and the progress readout).

`SinglePageListingForm` renders the active step only, with `Back`/`Continue`.
For the four form steps, Continue is a `type="submit"` button outside the
`<form>` bound by `form="wizard-form-{step}"` — the existing server action, its
Zod schema and every field are untouched; the button that triggers it moved.
Media and documents advance on their upload counts. Step 7 is a review screen
listing each step with its status and an Edit button.

Completion is derived from the vendor record on every render, never mirrored in
client state, so a save and a reload cannot disagree.

Five defects found while verifying, four of them mine:

1. **The mobile rail stretched the whole dashboard.** Seven pills come to 448px;
   Chrome sizes the mobile layout viewport from a descendant's scrollable
   content, so `innerWidth` became 461 at a 390px device width and every page
   rendered zoomed out. `overflow-x-auto` does not prevent this — `contain:
   paint` does. Now covered by `dashboard-mobile.spec.ts`, which reports 481 vs
   390 with the fix removed.
2. **The rail never scrolled to the current step**, so arriving at step 5 put the
   step you came for half off the right edge.
3. **Submit was ticked before it had been submitted** — it read `canSubmit`
   ("could submit") rather than `submittedAt`, so the final step showed a
   checkmark while an earlier step was still locked.
4. **A padlock beside an open final step.** Media and documents are not required
   to submit, so a vendor could reach `canSubmit` with Documents still locked.
   Unlocking is now monotonic: reachable steps are always a prefix.
5. **`getMyVendors` filtered by `status` but not `user_id`** (pre-existing, in
   `server/dal/vendor-workspace.ts`). It relied on RLS to scope rows, which
   holds for a vendor and fails for an admin — admins can read every membership
   row, so "my vendors" returned the whole marketplace, `/vendor-dashboard/list`
   opened someone else's business, and every save came back "You do not have
   permission." This is the third time this milestone that a query trusted RLS
   as a filter. **RLS is a ceiling, not a filter.**

A React warning was also fixed: the step advance ran during the child's render
(`setState` on a parent while rendering a different component) and now runs in
an effect.

Files changed: `components/vendor/{wizard-config,wizard-stepper}.ts(x)` (new),
`components/vendor/{listing-form,wizard-steps}.tsx`,
`server/dal/vendor-workspace.ts`, `app/globals.css`,
`tests/wizard-steps.test.ts` (new), `tests/e2e/dashboard-mobile.spec.ts`,
`tests/e2e/journey-1-customer.spec.ts`, `docs/STATUS.md`.

Checks: 155 unit tests, 37 E2E passed / 3 skipped, lint and typecheck clean,
build compiles. Both new unit tests were confirmed to fail without their fix,
as was the new mobile E2E assertion.

**Verified in a browser, not just by test:** save-and-advance, per-step
validation refusing to advance, values surviving a reload, clicking a completed
step to edit it, locked steps announcing themselves as disabled buttons, the
review screen's Edit buttons, and the 390px layout.

Two things this pass did **not** settle:

- `tests/e2e/journey-1-customer.spec.ts` asserted the old "Check your inbox"
  outcome and failed once sign-up started signing people straight in. It now
  accepts either. Worth noting how it hid: run alone the test is rate-limited by
  Supabase and skips, so it only asserts anything in a full-suite run. A skip is
  not a pass.
- No regression test covers the `getMyVendors` fix — it needs an RLS probe with
  two users rather than a unit test. Add it to `npm run db:rls`.


## Admin vendor management (2026-08-28)

Reported as "the admin panel is not properly working" — a newly registered
vendor did not appear in it, and there were no View / Edit / Approve / Reject /
Delete controls.

**Audited against the live database first.** Registration was never broken. 18
vendors, 9 `active`, 9 `draft`, **zero** ever `pending_review`. Every row was
present with its membership, listing, category and service area. Two separate
causes hid them: `/admin/vendors` defaulted to the `active` tab, which a new
business structurally cannot be in, and `draft → pending_review` needed the
vendor to finish the wizard and press a final button that nobody ever had — one
`vendor.submitted_for_review` entry in the whole audit log, from three weeks
earlier. The newest registration passed every gate in
`submit_vendor_for_review()` and was still `draft` with `submitted_at = null`.

Approve and Reject were **not** broken or disconnected — they existed on the
detail page and worked. Edit did not exist. Delete could not: `public.vendors`
had no DELETE policy in any of 0001–0034, so a delete matched zero rows and
returned 200. See ADR-041 and ADR-042.

**Changed.** Migration `0035_vendor_registration_and_admin_delete.sql` (new):
widens `vendors: create own` to permit `pending_review`, drops the
"already awaiting review" guard so a vendor can re-submit after completing, adds
`delete_vendor()` and `vendors: admin delete` on `admin.manage`.
`features/vendors/actions.ts`, `server/services/vendor-onboarding.ts`
(registration writes `pending_review`; `createVendorForUser` deliberately stays
`draft`), `server/services/admin-vendors.ts` (new),
`features/admin/vendor-actions.ts` (new), `features/vendors/schema.ts`
(`adminVendorSchema`), `server/dal/admin.ts` (`missing` per queue row,
`primaryCityId`), `components/admin/{vendor-row-actions,vendor-edit-form,vendor-delete-panel}.tsx`
(new), `app/admin/vendors/page.tsx` (defaults to Awaiting review, row actions),
`app/admin/vendors/[vendorId]/page.tsx` (edit section, delete panel),
`components/vendor/wizard-config.ts`, `app/vendor-dashboard/onboarding/page.tsx`,
`scripts/apply-migrations.mjs` (`--only`), `scripts/rls-onboarding-probe.mjs`,
`scripts/rls-taxonomy-probe.mjs`, `tests/admin-vendor-schema.test.ts` (new),
`tests/wizard-steps.test.ts`.

Checks: `npm run verify` clean — lint, typecheck, 163 unit tests, build.

### Remaining issue — the migration is not applied

`0035` has been **read carefully but never executed**: `PGPASSWORD` was not
available in this environment and there is no local Postgres, Docker or `psql`.
The 9 new RLS probes have never run.

**Registration does not break in the meantime.** `insertRegisteringVendor()`
attempts `pending_review` and falls back to `draft` on a 42501, logging
`vendor.register.migration0035NotApplied`. Deploys and migrations are separate
manual steps in this project, so "code ahead of schema" is a real state and a
sign-up that 500s would be a worse answer than one that behaves as it did last
week. The listing status and the verification record follow the row that came
back, so the fallback cannot produce a `draft` vendor carrying a `pending`
listing. **Delete the fallback once `0035` is applied** — it is dead code from
that moment.

Until then, Delete in the admin panel will fail on click (`delete_vendor` does
not exist yet) and new registrations keep landing under the Draft tab.

`npm run db:apply` replays every migration from 0001 and stops at 0002, because
the early files use plain `create table` / `create policy` — it only works on a
fresh project. `--only` was added for this:

```bash
PGPASSWORD='...' node --env-file=.env.local scripts/apply-migrations.mjs --only 0035
```

## Address and map link (2026-08-28)

Two optional fields on the Business step, after Primary city: **Address** and
**Location link**. Neither blocks submission.

Both live on `vendor_addresses`, which has existed since migration 0004 with
`line1`, `line2`, `postal_code`, `latitude`, `longitude` and
`public_visibility` — and which nothing in `src/` had ever read or written. It
was empty in production, so migration `0036` adds the one column it lacked
(`maps_url`) plus a unique index on `(vendor_id, type)`; without that index a
second save would silently create a second business address.

The link is stored as pasted, not parsed into `latitude`/`longitude`. Maps URLs
arrive as `maps.app.goo.gl` short links, `/place/` URLs and `@lat,lng` URLs, and
the short ones only resolve by following a redirect — guessing coordinates would
put wrong pins on maps. Resolve them in a job later if wanted; the columns are
already there.

**`undefined` and `''` are deliberately different.** Two forms post to
`saveProfileAction` — the wizard's Business step and `/vendor-dashboard/onboarding`
— and the service skips the address write entirely when both fields are absent.
Had an absent field sent `''`, saving on one form would have erased an address
entered on the other. Both forms carry the fields now; the guard is what stops
the next one that does not. Covered by `tests/vendor-address.test.ts`.

Files: `supabase/migrations/0036_vendor_address_and_map_link.sql` (new),
`features/vendors/schema.ts`, `features/vendors/actions.ts`,
`server/services/vendor-onboarding.ts` (`saveVendorAddress`),
`server/dal/vendor-workspace.ts`, `components/vendor/wizard-steps.tsx`,
`components/vendor/onboarding-forms.tsx`, `tests/vendor-address.test.ts` (new).

**Until `0036` is applied the two fields render but do not persist.** The write
fails on the missing column and is logged rather than thrown, so the rest of the
business details still save — but the address and link will not come back after
a reload.

### Exact next task

1. Apply `0035` with the command above, then `PGPASSWORD='...' npm run db:types`.
2. Delete two temporary shims that exist only because the schema is behind:
   the `supabase.rpc as unknown as` cast in `server/services/admin-vendors.ts`
   (`delete_vendor` is not in the generated types yet) and the `draft` fallback
   in `insertRegisteringVendor()` in `server/services/vendor-onboarding.ts`.
   Both say so in a comment above them.
3. `npm run db:rls` — 5 new probes (3 in onboarding, 6 in taxonomy) that have
   never been run.
4. Walk the flow in a browser: register → appears under Awaiting review →
   View / Edit / Approve / Reject / Delete.
5. The 9 existing `draft` vendors stay where they are. Decide whether to move
   the complete ones (Pearl Banquet hall, Krishna Vatika) into the queue by
   hand.
6. Pre-existing drift, found in passing and **not** fixed: *Krishna Vatika* has
   `vendor_listings.status = 'pending'` with `vendors.status = 'draft'`. There
   are two submit paths — `submit_vendor_for_review()` (vendor + listing) and
   `submit_listing_for_review()` (listing only) — so a business can sit in
   `/admin/listings` while absent from `/admin/vendors`.


## Notes

- All seed and demo data is fictional (PRD 2.3, Epic G). `npm run seed:demo -- --clean` removes the demo vendors.
- Grant yourself admin with `npm run grant-admin -- you@example.com`.
- Do not add a `loading.tsx` above any route that calls `notFound()` or `redirect()` — see ADR-016.
- E2E needs `npx playwright install chromium` once.
- Legal text in `supabase/seed.sql` is placeholder and must go to counsel before launch (PRD 14.3).
