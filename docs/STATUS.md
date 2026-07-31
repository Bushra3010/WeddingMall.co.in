# Status

Updated: 2026-07-31

## Completed

- **Prompt 0 — repository blueprint.** Next.js 16 / React 19 / TS strict / Tailwind v4, structure per PRD 8.2, pinned dependencies, env schema, CI.
- **Milestone 1 — foundation.** App shell, three Supabase clients, SSR session refresh, profile trigger, permission catalogue (TS + SQL), route protection, env validation, error boundaries, design tokens.
- **Milestone 2 — vendor onboarding.** Taxonomy admin, vendor organisations and memberships, onboarding draft with completion score, private verification uploads, submission, and admin approve / request-changes / reject / suspend with audit events.
- **Public discovery** (ahead of plan): homepage, search, category and category × city SEO routes, vendor profile, sitemap, robots, structured data.
- **Schema:** migrations `0001`–`0010` applied to the live project. 57 tables, 2 views, 13 enums, 88 FKs, 4 storage buckets, generated types.

## Verified

| Check                | Result                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run lint`       | pass, 0 warnings                                                                                |
| `npm run typecheck`  | pass                                                                                            |
| `npm run test`       | **69 passed** (permissions, enquiry transitions, money/dates, search filters, completion score) |
| `npm run build`      | pass                                                                                            |
| `npm run db:rls`     | **90 passed** (28 anon + 24 cross-tenant + 38 onboarding)                                       |
| Migrations           | 10/10 applied clean                                                                             |
| Journey 2 (PRD 17.4) | **walked end to end in a browser** — see below                                                  |

### Journey 2, driven through the real UI

Sign up → create business → onboarding (completion moved 34% → 49% as fields were saved) → submit for review → sign out → sign in as admin → verification queue → vendor detail → approve. Result: the listing became public, carried the verified badge, and was searchable by keyword and by category × city, all confirmed as an anonymous visitor.

The Playwright spec for this is still skipped (see outstanding #5) — the walkthrough was manual.

### What the Milestone 2 probes prove

- An owner can create a business, bootstrap their own membership, and submit — but an outsider cannot use the bootstrap policy to join someone else's business.
- A draft is invisible to anon _and_ to other signed-in users; submitting does not publish anything.
- An editor can edit the listing but cannot invite members, submit for review, or read verification documents.
- A manager cannot mint an owner.
- Verification documents are readable only by vendor managers and admins holding `vendor.verify`; the private bucket is not publicly fetchable.
- An admin without `vendor.verify` cannot approve; a vendor cannot approve itself; `vendor.verify` alone cannot suspend.
- Every decision except approval is refused without a reason, and each writes an audit row that neither the vendor nor a non-`admin.manage` admin can read.

## Fixed during Milestone 2

1. **Onboarding was impossible** — three compounding RLS gaps in `0004` (ADR-012). Fixed in `0008`.
2. **Admins could not see what they were approving** — five child tables had no admin read policy, so the verification queue showed "Category: —" (ADR-013). Fixed in `0010`. Found by driving the UI, not by probes.
3. **Validation message crashed on the error path.** `missing || 'text'` in `submit_vendor_for_review` is ambiguous and raised `22P02`; the happy path passed while the "what's still needed" message failed. Fixed in `0009` with `array_append`.
4. **Two type-generator defects** — partial unique indexes mistyped as one-to-one, and `text[]` degrading to `unknown[]` (ADR-014).
5. **No way to sign out.** The `signOut` action existed but was wired to nothing. Added to the public header and both dashboard layouts.

## Blocked / outstanding

1. **Listing editor, packages, portfolio, availability are still stubs** — Milestone 3. The onboarding page collects the basics; the richer editors do not exist.
2. **Team invitations require the invitee to already have an account.** `invite_vendor_member()` raises a clear error if not. Email invitations need the notification work in Milestone 4.
3. **Slug changes are refused** in taxonomy admin — renaming would break published URLs without a `slug_redirects` entry. Milestone 3.
4. **Google OAuth not configured.** Project has email auth only; PRD 6.4 requires Google. Needs a client ID/secret in the Supabase dashboard.
5. **Playwright E2E has never been run.** Journey 2 is verified manually but its spec is still `test.skip`.
6. **No check that the TS and SQL permission matrices agree** (ADR-004).
7. **Public pages render dynamically** because `SiteHeader` reads the session. Milestone 7.
8. **CSP not set.** Milestone 7.
9. **Category attributes have no admin UI.** The table and seed data exist; `/admin/attributes` is still a stub.

## Credentials note

`.env.local` holds the live project URL, anon key, service-role key, and a generated `CRON_SECRET`. It is gitignored and was never committed. **The anon key, service-role key, and database password were shared in a chat transcript** — rotate all three before this project handles real user data.

## Next task

Milestone 3 (PRD 19.6) — listing and public discovery:

1. Versioned listing editor (`vendor_listing_versions`) so an approved listing stays published while an edit is in review.
2. Packages, portfolio upload with moderation, availability.
3. Slug redirects, then enable renaming in taxonomy admin.
4. Category attributes admin + attribute-driven search filters.
5. Re-verify that a published listing never shows unapproved edits.

Extend `npm run db:rls` with each new boundary. Add both directions: that the unauthorised are denied **and** that the authorised can actually see what they need — that asymmetry is what hid ADR-013.

## Notes

- All seed and demo data is fictional (PRD 2.3, Epic G). `node --env-file=.env.local scripts/seed-demo-vendors.mjs --clean` removes the demo vendors.
- Grant yourself admin with `npm run grant-admin -- you@example.com` after signing up. There is no public admin sign-up (PRD 6.4).
- Legal text in `supabase/seed.sql` is placeholder and must go to counsel before launch (PRD 14.3).
