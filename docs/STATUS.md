# Status

Updated: 2026-07-31

## Completed

- **Prompt 0 — repository blueprint.** Next.js 16 / React 19 / TS strict / Tailwind v4 scaffold, folder structure per PRD 8.2, dependency set pinned, env schema, CI.
- **Milestone 1 — foundation (partial).** App shell, three Supabase clients, SSR session refresh in middleware, profile-creation trigger, permission catalogue (TS + SQL), route-group protection, env validation, error/loading/not-found boundaries, design tokens.
- **Schema — all of PRD 9 written as migrations `0001`–`0007`,** including RLS on every exposed table, storage buckets and policies, public views, and `search_vendors`.
- **Public discovery vertical slice** ahead of plan: homepage, `/vendors`, `/vendors/[category]`, `/vendors/[category]/[city]`, `/vendor/[slug]`, sitemap, robots, structured data.

## Verified

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 warnings |
| `npm run typecheck` | pass |
| `npm run test` | **55 passed** (permissions, enquiry transitions, money/dates, search filters) |
| `npm run build` | pass, 63 routes |

## Blocked / unverified

1. **Migrations have never been executed.** No Docker or Postgres on the build machine, so `supabase db reset` could not run. The SQL is written carefully but is **unverified** — treat first execution as a debugging task, not a formality. This is the single highest-risk item in the repo.
2. **No RLS test suite yet.** PRD 10 and Epic A require one; it needs a live database. Blocked by (1).
3. **`src/types/database.ts` is a placeholder.** Regenerate with `npm run db:types` once the database is up, then remove the `as unknown as` casts in `server/dal/vendors.ts`, `server/dal/actor.ts`, and `app/(public)/vendor/[vendorSlug]/page.tsx`.
4. **Google OAuth and phone OTP not implemented.** PRD 6.4 requires Google; it is a provider-configuration task plus a button. Phone OTP sits behind `FEATURE_PHONE_AUTH`.
5. **Public pages currently render dynamically**, because `SiteHeader` reads the session. The public DAL is already cookie-free, so the fix is to isolate the auth-dependent header region behind a dynamic boundary. Deferred to Milestone 7 performance work.
6. **CSP not set.** Other security headers are in `next.config.ts`; a nonce-based CSP is a Milestone 7 task.
7. **45 routes are `MilestonePlaceholder` stubs.** They exist so the PRD 5 information architecture is navigable. Each names the milestone that replaces it.

## Next task

Run the database for the first time and fix what breaks:

```bash
supabase start && supabase db reset
```

Then, in order:

1. Fix any migration errors; re-run until `db reset` is clean.
2. `npm run db:types`, then delete the now-unnecessary `as unknown as` casts.
3. Verify `search_vendors` returns rows against seeded data, and that `total_count` is correct across pages.
4. Write the RLS test harness (PRD 17.2): customer cannot read another customer's enquiry; anon cannot read a draft listing; anon cannot read `vendor_documents`.
5. Only then start Milestone 2 (PRD 19.5 — vendor onboarding).

## Notes

- Seed data is fictional, per PRD 2.3 and Epic G.
- Legal text in `supabase/seed.sql` is a placeholder and must go to counsel before launch (PRD 14.3).
- Plan prices in the seed are placeholders pending PRD 21 decision 7.
