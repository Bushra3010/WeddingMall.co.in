# Moving to a new Supabase project and Vercel account

Runbook for the move. Every step is idempotent; re-run a step if it fails.

Source today: Supabase `cbkggpptjylhkziostbv` (ap-southeast-2), Vercel project `weddingmallco` in team `nikhizencodxs-projects`.

## 0. What you need before starting

| Item                                    | Where it comes from                                               |
| --------------------------------------- | ----------------------------------------------------------------- |
| New Supabase project ref + DB password  | Dashboard → create project (pick **Mumbai, ap-south-1**)          |
| New project publishable + secret keys   | Dashboard → Project Settings → API keys                           |
| Old project DB password + secret key    | Old dashboard (reset the DB password if lost)                     |
| New Vercel account logged in on the CLI | `vercel login` (opens the browser)                                |
| Email, Razorpay, `CRON_SECRET` values   | Current Vercel project env (`vercel env pull` on the old account) |

Pick Mumbai for Supabase: the Vercel function runs in `bom1`, and the current project sits in Sydney, so every query crosses an ocean today.

## 1. Schema on the new project

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<new-ref>.supabase.co PGPASSWORD='<new db password>' \
  node scripts/apply-migrations.mjs
```

Applies `supabase/migrations/0001`–`0044` in order. Do **not** pass `--seed`; the data dump in the next step carries the live rows of every seeded table.

## 2. Data

```bash
SRC_REF=cbkggpptjylhkziostbv SRC_PGPASSWORD='<old db password>' \
DST_REF=<new-ref>            DST_PGPASSWORD='<new db password>' \
  bash scripts/migrate-supabase-data.sh
```

Dumps `public` plus `auth.users`, `auth.identities`, `auth.mfa_factors` into `tmp/migration/`, truncates the target's public tables, loads everything in one transaction with triggers silenced, then refreshes vendor search text and prints row counts. Password hashes travel with `auth.users`, so nobody has to reset a password.

If the direct host times out (it is IPv6-only), add `SRC_DB_HOST=aws-0-ap-southeast-2.pooler.supabase.com` and `DST_DB_HOST=aws-0-ap-south-1.pooler.supabase.com` (check the exact host under Connect → Session pooler).

## 3. Files

```bash
SRC_SUPABASE_URL=https://cbkggpptjylhkziostbv.supabase.co SRC_SUPABASE_SERVICE_KEY='<old secret key>' \
DST_SUPABASE_URL=https://<new-ref>.supabase.co            DST_SUPABASE_SERVICE_KEY='<new secret key>' \
  node scripts/copy-storage.mjs --dry-run   # counts only
```

Drop `--dry-run` to copy. 932 objects / ~198 MB across four buckets as of 2026-10-23. Re-running skips objects already present.

## 4. Auth settings (not in the database)

In the new project's dashboard → Authentication → URL Configuration:

- Site URL: `https://www.weddingmall.co.in`
- Redirect URLs: `https://www.weddingmall.co.in/**`, `https://weddingmall.co.in/**`, `https://<new-vercel-alias>.vercel.app/**`, `http://localhost:3000/**`

Re-enter any OAuth provider credentials and custom SMTP if they were set on the old project; those are not exported.

## 5. Vercel

```bash
vercel login                      # new account
rm -rf .vercel && vercel link     # new project, framework Next.js, region stays bom1 via vercel.json
```

Set the env vars (production), same names as before:

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_APP_URL=https://www.weddingmall.co.in`, `CRON_SECRET`, `ADMIN_MFA_REQUIRED`, `EMAIL_FROM`, `FEATURE_ONLINE_PAYMENTS`, `FEATURE_PHONE_AUTH`, `FEATURE_REALTIME_CHAT`, `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`, `NEXT_TELEMETRY_DISABLED`, plus the email provider key and `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production   # repeat per variable, or paste a file with `vercel env add < file`
vercel --prod
```

Then add the domain on the new project (`vercel domains add www.weddingmall.co.in`) and point Hostinger DNS at it: A `@` → `216.198.79.1`, CNAME `www` → `cname.vercel-dns.com`, plus the `_vercel` TXT the dashboard shows. Remove the domain from the old project first if Vercel refuses it.

## 5b. Netlify instead of Vercel

`netlify.toml` is back in the repo (Next.js runtime is auto-detected; no plugin to install). Free tier: 100 GB bandwidth, 300 build minutes, 125k function invocations and 100 function-hours a month. The 20-second refresh loop that drained Vercel is fixed, so a normal month fits.

```bash
netlify login                               # new account
netlify sites:create --name weddingmallco   # or: netlify link
netlify env:import .env.production          # same variable names as step 5, one KEY=value per line
netlify deploy --build --prod
```

Add the domain under Site → Domain management, then at Hostinger point A `@` → `75.2.60.5` and CNAME `www` → `<site>.netlify.app` (the dashboard shows the exact values). Put the Netlify alias in the Supabase redirect list (step 4) and delete `.env.production` after the import.

## 6. Verify

```bash
curl -sI https://www.weddingmall.co.in | grep -iE "^(HTTP|x-vercel)"
NEXT_PUBLIC_SUPABASE_URL=https://<new-ref>.supabase.co PGPASSWORD='...' npm run db:rls
```

Sign in with an existing account, open a vendor page with images, send one enquiry message, and check the Razorpay webhook URL points at the live domain.

## 7. Afterwards

- Revoke every token that was pasted into chat (Vercel → Settings → Tokens; Supabase → Account → Access Tokens).
- Pause or delete the old Supabase project once the new one has run for a few days.
- Read `docs/STATUS.md` → "Why both Vercel accounts were disabled" before expecting a third Hobby account to behave differently.
