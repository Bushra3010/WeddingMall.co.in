# Status

Updated: 2026-07-31

## Completed

- **Prompt 0 — repository blueprint.** Next.js 16 / React 19 / TS strict / Tailwind v4 scaffold, folder structure per PRD 8.2, dependency set pinned, env schema, CI.
- **Milestone 1 — foundation.** App shell, three Supabase clients, SSR session refresh in middleware, profile-creation trigger, permission catalogue (TS + SQL), route-group protection, env validation, error/loading/not-found boundaries, design tokens.
- **Schema — all of PRD 9 applied to the live project.** Migrations `0001`–`0007`: 57 tables, 2 views, 13 enums, 88 foreign keys, 105 RLS policies, 4 storage buckets, `search_vendors()`.
- **Public discovery vertical slice** ahead of plan: homepage, `/vendors`, `/vendors/[category]`, `/vendors/[category]/[city]`, `/vendor/[slug]`, sitemap, robots, structured data.
- **Generated database types** with real column types, enums, and FK relationships.

## Verified

| Check               | Result                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`      | pass, 0 warnings                                                                                                     |
| `npm run typecheck` | pass                                                                                                                 |
| `npm run test`      | **55 passed** (permissions, enquiry transitions, money/dates, search filters)                                        |
| `npm run build`     | pass, 63 routes                                                                                                      |
| Migrations applied  | **7/7 clean** against the live project, first run                                                                    |
| `npm run db:rls`    | **52 passed** (28 anon probes + 24 cross-tenant probes)                                                              |
| Route smoke test    | 10/10 respond; seeded data renders                                                                                   |
| `search_vendors`    | ranking, category/city filters, full-text, verified filter, price sort, and pagination all correct against real rows |

### What the RLS probes actually prove

Run with `npm run db:rls`. They use real user JWTs over PostgREST — the same path a browser takes — and seed fixtures first, so a "denied" result means a row genuinely existed and was withheld:

- A signed-in customer (Mallory) reads **zero rows** of another customer's (Alice's) enquiry, messages, conversation, shortlist, wedding profile, and profile row.
- Mallory cannot change Alice's enquiry status, post into her thread, forge her as message sender, or review through an enquiry she does not own.
- A customer never sees vendor internal notes; a non-member cannot read vendor leads or edit the vendor.
- No signed-in user can self-grant `super_admin` or join a vendor team.
- Draft vendors are invisible to anon and absent from both `public_vendors` and search.
- The private `vendor-documents` bucket is not publicly fetchable.

## Fixed during first live run

Real defects the live database and generated types exposed:

1. **Ambiguous PostgREST embed** — `reviews` has two FKs to `profiles` (`customer_id`, `reviewer_id`), so `profiles(full_name)` returned **HTTP 300 PGRST201**. Every vendor profile with reviews would have failed. Now hinted `profiles!reviews_customer_id_fkey(...)`, which also guarantees the moderating admin never surfaces publicly.
2. **`review_responses` cardinality** — unique `review_id` makes it one-to-one, so it returns an object, not an array. The old `.find()` would have thrown.
3. **Logger flattened non-`Error` objects** to `[object Object]`, discarding Supabase error codes and messages.
4. **Public pages forced dynamic** because the footer read taxonomy through the cookie-reading client (see ADR-003).

## Blocked / outstanding

1. **Vendor and admin dashboards are stubs.** 45 routes render `MilestonePlaceholder`. This is by design (ADR-008) but it is the bulk of remaining product work.
2. **Google OAuth not configured.** The project has email auth only; PRD 6.4 requires Google. Needs a client ID/secret set in Authentication → Providers — a dashboard step.
3. **Email confirmations are off** in `supabase/config.toml` for local convenience, and no email provider is wired. `EMAIL_PROVIDER_API_KEY` is unset, so no transactional mail sends.
4. **Public pages still render dynamically** because `SiteHeader` reads the session. The public DAL is already cookie-free, so the remaining fix is isolating the auth-dependent header region. Milestone 7 performance work.
5. **CSP not set.** Other security headers are in `next.config.ts`; a nonce-based CSP is Milestone 7.
6. **No RLS check that the TS and SQL permission matrices agree** (ADR-004). They are maintained by hand in two places.
7. **Playwright E2E has not been run.** Specs exist; the three critical journeys are written but skipped pending their milestones.
8. **Demo vendors have ratings but no review rows.** `rating_average`/`rating_count` were set directly for display. Correct consequence: `aggregateRating` structured data is withheld, per PRD 11.2. Real reviews arrive in Milestone 5.

## Credentials note

`.env.local` holds the live project URL, anon key, service-role key, and a generated `CRON_SECRET`. It is gitignored and was never committed. **The anon key, service-role key, and database password were shared in a chat transcript** — rotate all three in Project Settings before this project handles real user data.

## Next task

Milestone 2 (PRD 19.5) — vendor onboarding as one vertical slice:

1. Taxonomy admin screens (categories, attributes, locations) replacing those stubs.
2. Vendor organisation creation + `vendor_memberships` invite flow.
3. Onboarding draft with completion score.
4. Private verification document upload to `vendor-documents` (signed URLs only).
5. Admin approve / request-change / reject with a required reason and an `audit_logs` entry.

Before starting, grant yourself admin — there is no public admin sign-up (PRD 6.4). Sign up through the UI, then run the SQL in `docs/DB.md`.

Extend `npm run db:rls` with each new boundary rather than adding tests at the end.

## Notes

- All seed and demo data is fictional (PRD 2.3, Epic G). `node --env-file=.env.local scripts/seed-demo-vendors.mjs --clean` removes the demo vendors.
- Legal text in `supabase/seed.sql` is a placeholder and must go to counsel before launch (PRD 14.3).
- Plan prices in the seed are placeholders pending PRD 21 decision 7.
