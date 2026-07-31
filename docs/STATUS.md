# Status

Updated: 2026-08-01

## Completed

- **Prompt 0 — repository blueprint.** Next.js 16 / React 19 / TS strict / Tailwind v4, structure per PRD 8.2, pinned dependencies, env schema, CI.
- **Milestone 1 — foundation.** App shell, three Supabase clients, SSR session refresh, profile trigger, permission catalogue (TS + SQL), route protection, env validation, error boundaries, design tokens.
- **Milestone 2 — vendor onboarding.** Taxonomy admin, vendor organisations and memberships, onboarding draft with completion score, private verification uploads, submission, admin approve / request-changes / reject / suspend with audit events.
- **Milestone 3 — listings and discovery.** Versioned listing editor, packages, portfolio with media moderation, availability, admin listing moderation with before/after comparison, slug redirects, and attribute-driven category filters.
- **Schema:** migrations `0001`–`0013` applied to the live project.

## Verified

| Check               | Result                                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| `npm run lint`      | pass, 0 warnings                                                        |
| `npm run typecheck` | pass                                                                    |
| `npm run test`      | **90 passed** across 6 files                                            |
| `npm run build`     | pass                                                                    |
| `npm run db:rls`    | **116 passed** (28 anon + 24 cross-tenant + 38 onboarding + 26 listing) |
| Migrations          | 13/13 applied clean                                                     |
| Route smoke test    | public 200, dashboards 307, genuine 404 → **404**                       |

### What the Milestone 3 probes prove

The central guarantee is that an edit to an approved listing does not reach the public until a moderator approves it. Every one of these failed before migration 0011:

- Editing the draft does not change the public page, and the unreviewed text is not searchable.
- Submitting an edit leaves the published version live; a second submission is refused while one is pending.
- Anon cannot read a pending version, a draft listing row, or an unmoderated image.
- A vendor cannot approve their own edit; an admin without `listing.moderate` cannot either.
- `request_changes` is refused without a reason, and rejecting an edit leaves the published version untouched.
- Approving publishes the new text, archives the version it replaces (rather than deleting it), and makes the new text searchable.
- Availability rows are unreadable by anon; the public view exposes the status signal and no private note.
- Renaming records a redirect, a second rename does not create a chain, and a live slug never redirects to itself.

## Fixed during Milestone 3

1. **Unreviewed edits went live instantly.** `public_vendors` read `vendor_listings` directly and `vendor_listing_versions` was never written to (ADR-015). Fixed in `0011`.
2. **Draft content was publicly readable.** `vendor_listings` keeps `status = 'approved'` on the draft row after publication, so its public-read policy exposed the vendor's unreviewed working copy to anon — the exact content 0011 was written to protect. Fixed in `0013`.
3. **Every 404 on the site returned HTTP 200.** A root `loading.tsx` wrapped all routes in Suspense, so streaming began before `notFound()` ran and the status could no longer be set. Soft 404s get indexed. Same cause made `permanentRedirect()` degrade to a meta-refresh (ADR-016).
4. **The public availability signal never worked.** `public_vendor_availability` was `security_invoker` over a table anon cannot read, so it always returned zero rows (ADR-013 pattern again). Fixed in `0013`.
5. **A render-phase `setState`** in the package editor would have thrown in React.

## Blocked / outstanding

1. **Numeric attribute filters are exact-match only.** Range filtering needs an `attributeRanges` parameter in `search_vendors` — the seeded `capacity` and `price_per_plate` attributes are only usable as exact values today (ADR-018).
2. **Media has no bulk reordering UI.** `reorderMedia` exists in the service layer but nothing calls it; ordering is by upload order plus cover selection.
3. **Media is approved wholesale with the listing.** An admin cannot reject one image while approving the rest.
4. **Enquiries, reviews, billing, and CMS remain stubs** — Milestones 4–6.
5. **Google OAuth not configured.** Project has email auth only; PRD 6.4 requires Google.
6. **Playwright E2E has never been run.** Journey 2 was verified manually in Milestone 2; the specs are still `test.skip`.
7. **No check that the TS and SQL permission matrices agree** (ADR-004).
8. **Public pages render dynamically** because `SiteHeader` reads the session. Milestone 7.
9. **CSP not set.** Milestone 7.

## Credentials note

`.env.local` holds the live project URL, anon key, service-role key, and a generated `CRON_SECRET`. It is gitignored and was never committed. **The anon key, service-role key, and database password were shared in a chat transcript** — rotate all three before this project handles real user data.

## Next task

Milestone 4 (PRD 19.7) — customer and enquiry:

1. Wedding profile and shortlist.
2. Enquiry submission with idempotency and explicit contact consent.
3. Lifecycle events on every transition (`enquiry_events` is append-only by design).
4. Participant-authorised conversation thread and messages.
5. In-app and email notifications.
6. E2E journey 1.

The transition map already exists and is unit-tested in `src/features/enquiries/status.ts` — wire the service layer to it rather than re-deriving the rules.

Keep extending `npm run db:rls` with each boundary, in **both** directions: that the unauthorised are denied and that the authorised can see what they need. That asymmetry hid two separate bugs across Milestones 2 and 3.

## Notes

- All seed and demo data is fictional (PRD 2.3, Epic G). `node --env-file=.env.local scripts/seed-demo-vendors.mjs --clean` removes the demo vendors.
- Grant yourself admin with `npm run grant-admin -- you@example.com`. There is no public admin sign-up (PRD 6.4).
- Do not add a `loading.tsx` above any route that calls `notFound()` or `redirect()` — see ADR-016.
- Legal text in `supabase/seed.sql` is placeholder and must go to counsel before launch (PRD 14.3).
