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

## Blocked / outstanding

1. **No SMTP provider, and Supabase rejects test domains.** The default mail is rate-limited to a few per hour, and Auth refuses reserved domains (`example.com`, `.test`) at public sign-up. So sign-up confirmations and the sign-up E2E test cannot run reliably. Set `EMAIL_PROVIDER_API_KEY` + `EMAIL_FROM` (Resend, per PRD 8.1) and use a real domain — the adapter is written and will pick it up (ADR-022).
2. **Email notifications are logged, not sent,** for the same reason. `sendEmail()` falls back to a console provider that records a redacted line.
3. **Message attachments are not implemented.** PRD 6.7 wants them, but they need malware scanning first; `message_attachments` has no insert policy, so the table is inert rather than half-open.
4. **Realtime is not wired.** `FEATURE_REALTIME_CHAT` is false; the thread refreshes on navigation.
5. **Numeric attribute filters are exact-match only** (ADR-018).
6. **Media is approved wholesale with the listing** — an admin cannot reject one image.
7. **Reviews, billing, and CMS remain stubs** — Milestones 5 and 6.
8. **Google OAuth not configured.** Project has email auth only; PRD 6.4 requires Google.
9. **Permission-catalogue parity is still unchecked** (ADR-004). The technique now exists — apply ADR-020's approach to `vendor_can()`.
10. ~~Public pages render dynamically.~~ Fixed 2026-08-02 (ADR-030). Remaining dynamic public routes are `/vendors*` (search parameters) and `/vendor/[slug]*` (personalised enquiry state), both legitimately so.
11. **CSP not set.** Milestone 7.

## Credentials note

**The Vercel token, Supabase anon key, service-role key, and database password were all shared in a chat transcript.** Rotate all four. The service-role key is the urgent one — it bypasses RLS entirely. After rotating Supabase keys, update `.env.local` _and_ the Vercel environment.

## Next task

Milestone 5 (PRD 19.8) — vendor CRM and reviews:

1. Enquiry pipeline and table views, assignment, internal notes, follow-up dates.
2. SLA reminder job (`enquiry_events` already records `first_response`).
3. `vendor_metrics_daily` aggregation.
4. Review eligibility (an enquiry that reached a qualifying state), moderation, vendor response.
5. Rating aggregates recompute from approved reviews only — the trigger exists in `0005`.
6. E2E journey 2.

Reviews will need the same treatment as enquiries: eligibility enforced in SQL, not only in the service.

Keep extending `npm run db:rls` in **both** directions — denied _and_ permitted. That asymmetry has now hidden bugs in three consecutive milestones (ADR-013, ADR-021).

## Notes

- All seed and demo data is fictional (PRD 2.3, Epic G). `npm run seed:demo -- --clean` removes the demo vendors.
- Grant yourself admin with `npm run grant-admin -- you@example.com`.
- Do not add a `loading.tsx` above any route that calls `notFound()` or `redirect()` — see ADR-016.
- E2E needs `npx playwright install chromium` once.
- Legal text in `supabase/seed.sql` is placeholder and must go to counsel before launch (PRD 14.3).
