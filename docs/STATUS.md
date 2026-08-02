# Status

Updated: 2026-08-01

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

Keep probing before building. A live privilege escalation has been found this way in each of the last three milestones — reviews (ADR-031), vendor columns (ADR-032), analytics (ADR-035) — and in every case reading the code looked fine.

## Notes

- All seed and demo data is fictional (PRD 2.3, Epic G). `npm run seed:demo -- --clean` removes the demo vendors.
- Grant yourself admin with `npm run grant-admin -- you@example.com`.
- Do not add a `loading.tsx` above any route that calls `notFound()` or `redirect()` — see ADR-016.
- E2E needs `npx playwright install chromium` once.
- Legal text in `supabase/seed.sql` is placeholder and must go to counsel before launch (PRD 14.3).
