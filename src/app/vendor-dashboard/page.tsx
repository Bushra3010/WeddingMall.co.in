import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, ExternalLink } from 'lucide-react'

import { CompletionMeter } from '@/components/vendor/completion-meter'
import { StatusBanner } from '@/components/vendor/status-banner'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState, PermissionDenied } from '@/components/ui/states'
import { nextAction } from '@/features/vendors/completion'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { getMyVendors, getVendorWorkspace } from '@/server/dal/vendor-workspace'

export const metadata = { title: 'Vendor dashboard', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function VendorDashboardPage() {
  const mine = await getMyVendors()
  if (mine.length === 0) redirect('/vendor/join')

  const vendor = await getVendorWorkspace(mine[0].vendor.id)
  if (!vendor) return <PermissionDenied />

  const next = nextAction(vendor.completion)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-sand-900 text-2xl">{vendor.displayName}</h1>
          <p className="text-sand-600 mt-1 text-sm">
            {mine[0].role.replace('vendor_', '').replace('_', ' ')} access
          </p>
        </div>
        {vendor.status === 'active' ? (
          <Link
            href={`/vendor/${vendor.slug}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            View public profile
            <ExternalLink aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      <StatusBanner vendor={vendor} />

      {next ? (
        <div className="border-brand-200 bg-brand-50 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border p-4">
          <div>
            <p className="text-brand-900 text-sm font-medium">Next: {next.label}</p>
            <p className="text-brand-800/80 text-sm">{next.hint}</p>
          </div>
          <Link href="/vendor-dashboard/onboarding" className={cn(buttonVariants({ size: 'sm' }))}>
            Continue
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {/* Enquiry metrics arrive with the CRM in Milestone 5; showing zeroes
              now would imply the pipeline exists. */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Packages', value: vendor.packageCount },
              { label: 'Photos', value: vendor.mediaCount },
              { label: 'Documents', value: vendor.documentCount },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-4"
              >
                <p className="text-sand-900 text-2xl font-semibold">{stat.value}</p>
                <p className="text-sand-600 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>

          <EmptyState
            title="No enquiries yet"
            description="Once your listing is live, enquiries from couples appear here."
          />
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <CompletionMeter completion={vendor.completion} />
        </div>
      </div>
    </div>
  )
}
