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

Soft-luxury restyle: deep purple brand tokens, blush neutrals, champagne accents; sticky navbar that goes solid on scroll; full-bleed hero with a six-field search card and tabs; live-counted trust statistics; category carousel with gradient icon tiles; premium vendor cards; testimonial carousel; multi-column footer with a working newsletter signup.

Three judgement calls worth knowing about:

- **Statistics are counted, not claimed** (ADR-023). The design specified "5,000+ vendors / 50,000+ couples"; the hero renders the real 3+ / 8+ / 8+ / 4.6 instead, because PRD 6.1 forbids hard-coded unverifiable claims.
- **The hero image is admin-configured** (ADR-024), with a gradient fallback. No stock photograph of people was invented.
- **Every animation degrades to the finished state** (ADR-025) — reveals, counters, and the carousel are all safe under reduced motion, no JavaScript, and crawling.

Sections in the brief that were not built, because no data model backs them: wedding packages, the Pinterest-style inspiration gallery, and per-vendor response-time badges. Adding them would mean inventing content.

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
10. **Public pages render dynamically** because `SiteHeader` reads the session. Milestone 7.
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
