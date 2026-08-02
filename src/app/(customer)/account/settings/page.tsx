import Link from 'next/link'

import { NotificationPrefsForm, ProfileForm } from '@/components/customer/account-settings-forms'
import { NOINDEX } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/server/policies/require'

export const metadata = { title: 'Settings', ...NOINDEX }
export const dynamic = 'force-dynamic'

/**
 * Notification groups, described in terms of what arrives rather than by
 * template code. Transactional mail about your own enquiries is not listed
 * because it is not optional — a reply you cannot be told about is worse than
 * an email you did not want.
 */
const GROUPS = [
  {
    key: 'enquiry',
    label: 'Enquiry updates',
    description: 'When a vendor replies or your enquiry changes status.',
  },
  {
    key: 'message',
    label: 'New messages',
    description: 'When someone sends you a message in a thread.',
  },
  {
    key: 'review',
    label: 'Review outcomes',
    description: 'When a review you wrote is published.',
  },
  {
    key: 'marketing',
    label: 'Ideas and offers',
    description: 'Occasional planning guides. Never more than monthly.',
  },
]

export default async function AccountSettingsPage() {
  const actor = await requireUser('/account/settings')
  const supabase = await createClient()

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, phone, phone_verified_at')
      .eq('id', actor.userId)
      .maybeSingle(),
    supabase
      .from('notification_preferences')
      .select('notification_group, enabled')
      .eq('channel', 'email'),
  ])

  // A missing row means "on" — see the note in the action. Only an explicit
  // opt-out is stored.
  const disabled = new Set(
    (prefs ?? []).filter((row) => !row.enabled).map((row) => row.notification_group),
  )

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Settings</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Your details and what we email you about. For a copy of your data or to close your
          account, see{' '}
          <Link href="/account/privacy" className="text-brand-700 hover:underline">
            Privacy
          </Link>
          .
        </p>
      </header>

      <section
        aria-labelledby="settings-profile"
        className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5"
      >
        <h2 id="settings-profile" className="font-display text-sand-900 text-lg">
          Your details
        </h2>
        <p className="text-sand-600 mt-1 mb-4 text-sm">
          Your email address is your sign-in and cannot be changed here.
        </p>
        <ProfileForm
          fullName={profile?.full_name ?? null}
          phone={profile?.phone ?? null}
          phoneVerified={Boolean(profile?.phone_verified_at)}
        />
      </section>

      <section
        aria-labelledby="settings-notifications"
        className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5"
      >
        <h2 id="settings-notifications" className="font-display text-sand-900 text-lg">
          Email notifications
        </h2>
        <p className="text-sand-600 mt-1 text-sm">
          {/*
            Stated plainly rather than discovered: no email provider is
            configured yet, so these preferences are recorded but nothing is
            actually sent. Silently offering switches that do nothing would be
            worse than saying so.
          */}
          Email delivery is not yet switched on for this site. Your choices are saved and will apply
          as soon as it is.
        </p>
        <div className="mt-4">
          <NotificationPrefsForm
            groups={GROUPS.map((group) => ({ ...group, enabled: !disabled.has(group.key) }))}
          />
        </div>
      </section>
    </div>
  )
}
