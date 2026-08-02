import { MfaChallenge } from '@/components/admin/mfa-challenge'
import { MfaSetup } from '@/components/admin/mfa-setup'
import { PRIVILEGED_SESSION_MINUTES, getMfaState } from '@/lib/security/mfa'
import { NOINDEX } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/server/policies/require'

export const metadata = { title: 'Security', ...NOINDEX }
export const dynamic = 'force-dynamic'

/**
 * The one admin route that must stay reachable at aal1 (PRD 10.3).
 *
 * Every other admin page redirects here when a second factor is missing or
 * the session has gone stale. If this page required aal2 itself, the only
 * route that can resolve either situation would be unreachable — so it calls
 * `requireAdmin` and deliberately not `requireElevatedAdmin`.
 */
export default async function AdminSecurityPage() {
  await requireAdmin()

  const supabase = await createClient()
  const [{ data: factors }, state] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    getMfaState(),
  ])

  const verified = (factors?.totp ?? []).filter((factor) => factor.status === 'verified')
  const needsChallenge = state.status === 'challenge' || state.status === 'stale'

  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Security</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Administrators handle other people&apos;s data, so this account needs a second factor. An
          elevated session lasts {PRIVILEGED_SESSION_MINUTES} minutes before you are asked again.
        </p>
      </header>

      {needsChallenge && verified[0] ? (
        <section
          aria-labelledby="mfa-challenge"
          className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5"
        >
          <h2 id="mfa-challenge" className="font-display text-sand-900 mb-3 text-lg">
            Verify it is you
          </h2>
          <MfaChallenge
            factorId={verified[0].id}
            reason={
              state.status === 'stale'
                ? 'Your elevated session has expired. Enter a fresh code to continue.'
                : 'Enter the code from your authenticator app to reach the admin area.'
            }
          />
        </section>
      ) : null}

      <section
        aria-labelledby="mfa-setup"
        className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5"
      >
        <h2 id="mfa-setup" className="font-display text-sand-900 mb-3 text-lg">
          Two-factor authentication
        </h2>
        <MfaSetup
          enrolled={verified.map((factor) => ({
            id: factor.id,
            friendlyName: factor.friendly_name ?? null,
          }))}
        />
      </section>
    </div>
  )
}
