import { PlatformSettingsForm } from '@/components/admin/platform-settings-form'
import { NOINDEX } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { requireElevatedAdmin } from '@/server/policies/require'

export const metadata = { title: 'Settings', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  await requireElevatedAdmin('admin.manage')
  const supabase = await createClient()

  const [{ data: sla }, { data: review }, { data: eligible }] = await Promise.all([
    supabase.from('sla_policy').select('first_response_hours').eq('id', true).maybeSingle(),
    supabase.from('review_policy').select('edit_window_hours').eq('id', true).maybeSingle(),
    supabase.from('review_eligible_statuses').select('status'),
  ])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Settings</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Platform-wide policy. These values are read by SQL, not just by the application, so a
          change takes effect for anything reaching the database — including a client calling the
          API directly.
        </p>
      </header>

      <section
        aria-labelledby="settings-policy"
        className="border-sand-200 max-w-xl rounded-[var(--radius-card)] border bg-white p-5"
      >
        <h2 id="settings-policy" className="font-display text-sand-900 mb-4 text-lg">
          Response and review policy
        </h2>
        <PlatformSettingsForm
          firstResponseHours={sla?.first_response_hours ?? 24}
          reviewEditWindowHours={review?.edit_window_hours ?? 720}
        />
      </section>

      <section aria-labelledby="settings-eligibility">
        <h2 id="settings-eligibility" className="font-display text-sand-900 text-lg">
          Review eligibility
        </h2>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          A customer may review a vendor once their enquiry has reached one of these states. The
          rule is enforced by a trigger, so it holds for a client calling the API directly and not
          only for the review form.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(eligible ?? []).map((row) => (
            <li
              key={row.status}
              className="border-sand-300 text-sand-700 rounded-full border bg-white px-3 py-1 text-sm"
            >
              {row.status}
            </li>
          ))}
        </ul>
        <p className="text-sand-500 mt-3 text-xs">
          {/*
            Honest about the limit rather than shipping a control that looks
            editable: widening this changes who may review a business, so it
            goes through a migration where it is reviewable.
          */}
          Changing this list is done with a migration so the change is reviewable.
        </p>
      </section>
    </div>
  )
}
