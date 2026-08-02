import Link from 'next/link'

import { NOINDEX } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { requireOwnVendorId } from '@/server/policies/require'

export const metadata = { title: 'Settings', ...NOINDEX }
export const dynamic = 'force-dynamic'

/**
 * Vendor account settings (PRD 6.9).
 *
 * Business details, categories, media and packages each already have their own
 * screen, so this deliberately does not duplicate them — it answers "where is
 * my business in the process, and what am I allowed to do" and points at the
 * screen that owns each thing.
 */
export default async function VendorSettingsPage() {
  const vendorId = await requireOwnVendorId()
  const supabase = await createClient()

  const [{ data: vendor }, { data: subscription }, { data: members }] = await Promise.all([
    supabase
      .from('vendors')
      .select('display_name, slug, status, verification_status, is_featured, published_at')
      .eq('id', vendorId)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('status, plans(name)')
      .eq('vendor_id', vendorId)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('vendor_memberships')
      .select('id')
      .eq('vendor_id', vendorId)
      .eq('status', 'active'),
  ])

  const rows = [
    {
      label: 'Business name',
      value: vendor?.display_name ?? '—',
      href: '/vendor-dashboard/profile',
    },
    { label: 'Public address', value: vendor?.slug ? `/vendor/${vendor.slug}` : '—', href: null },
    { label: 'Publication', value: vendor?.status ?? '—', href: '/vendor-dashboard/listing' },
    { label: 'Verification', value: vendor?.verification_status ?? '—', href: null },
    { label: 'Plan', value: subscription?.plans?.name ?? 'Free', href: '/vendor-dashboard/plan' },
    {
      label: 'Featured placement',
      value: vendor?.is_featured ? 'Yes' : 'No',
      href: '/vendor-dashboard/plan',
    },
    {
      label: 'Team members',
      value: String((members ?? []).length),
      href: '/vendor-dashboard/team',
    },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Settings</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Where your business stands, and where to change each thing.
        </p>
      </header>

      <dl className="border-sand-200 divide-sand-100 divide-y rounded-[var(--radius-card)] border bg-white">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <dt className="text-sand-600 text-sm">{row.label}</dt>
            <dd className="text-sand-900 flex items-center gap-3 text-sm font-medium">
              <span>{row.value}</span>
              {row.href ? (
                <Link
                  href={row.href}
                  className="text-brand-700 text-xs font-normal hover:underline"
                >
                  Change
                </Link>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-sand-600 max-w-prose text-sm">
        {/*
          Says why the two most-asked-about fields are not editable here, rather
          than leaving a vendor hunting for a control that does not exist.
        */}
        Publication and verification are decided by review, not set from this page — a vendor cannot
        publish or verify their own listing. Featured placement follows your plan.
      </p>
    </div>
  )
}
