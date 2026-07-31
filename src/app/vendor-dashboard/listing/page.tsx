import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, ExternalLink, XCircle } from 'lucide-react'

import { ListingForm } from '@/components/vendor/onboarding-forms'
import { SubmitListingCard } from '@/components/vendor/submit-listing-card'
import { PermissionDenied } from '@/components/ui/states'
import { canVendor } from '@/lib/permissions'
import { formatDateTime } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import { getListingVersions } from '@/server/dal/listings'
import { getMyVendors, getVendorWorkspace } from '@/server/dal/vendor-workspace'

export const metadata = { title: 'Listing', ...NOINDEX }
export const dynamic = 'force-dynamic'

const VERSION_ICON: Record<string, typeof CheckCircle2> = {
  approved: CheckCircle2,
  pending: Clock,
  rejected: XCircle,
  archived: CheckCircle2,
}

/**
 * Listing editor (PRD 6.9). Edits go into a draft; the published version stays
 * live until an admin approves the new one, so this page has to make the
 * difference between "saved" and "published" unmistakable.
 */
export default async function ListingPage() {
  const actor = await getActor()
  const mine = await getMyVendors()
  if (mine.length === 0) redirect('/vendor/join')

  const vendorId = mine[0].vendor.id
  const [vendor, versions] = await Promise.all([
    getVendorWorkspace(vendorId),
    getListingVersions(vendorId),
  ])
  if (!vendor) return <PermissionDenied />

  const published = versions.find((v) => v.status === 'approved')
  const pending = versions.find((v) => v.status === 'pending')
  const lastRejected = versions.find((v) => v.status === 'rejected')
  const canEdit = canVendor(actor, vendorId, 'listing.edit')

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-sand-900 text-2xl">Listing</h1>
          <p className="text-sand-600 mt-1 max-w-prose text-sm">
            Changes are saved as a draft. Your published listing stays live until an editor approves
            the update.
          </p>
        </div>
        {published && vendor.status === 'active' ? (
          <Link
            href={`/vendor/${vendor.slug}`}
            className="text-brand-700 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            View published version
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </Link>
        ) : null}
      </header>

      {pending ? (
        <div className="border-accent-300 bg-accent-100 flex items-start gap-3 rounded-[var(--radius-card)] border p-4">
          <Clock aria-hidden="true" className="text-accent-700 mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sand-900 font-medium">Version {pending.versionNo} is in review</p>
            <p className="text-sand-700 mt-0.5 text-sm">
              {published
                ? `Version ${published.versionNo} stays published until this is approved.`
                : 'Nothing is published yet.'}{' '}
              You can keep editing, but you cannot submit again until this is decided.
            </p>
          </div>
        </div>
      ) : lastRejected?.reason && !published ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-danger)] bg-[color-mix(in_oklch,var(--color-danger)_8%,white)] p-4">
          <XCircle
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-[var(--color-danger)]"
          />
          <div>
            <p className="text-sand-900 font-medium">Changes requested</p>
            <p className="text-sand-700 mt-0.5 text-sm">{lastRejected.reason}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <ListingForm vendor={vendor} readOnly={!canEdit} />
          {canVendor(actor, vendorId, 'listing.submit') ? (
            <SubmitListingCard
              vendorId={vendorId}
              hasPending={Boolean(pending)}
              hasPublished={Boolean(published)}
              aboutLength={vendor.about?.trim().length ?? 0}
            />
          ) : null}
        </div>

        <section
          aria-labelledby="version-history"
          className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5 lg:sticky lg:top-6 lg:self-start"
        >
          <h2 id="version-history" className="text-sand-900 font-medium">
            Version history
          </h2>
          {versions.length === 0 ? (
            <p className="text-sand-600 mt-2 text-sm">
              Nothing submitted yet. Your listing has never been published.
            </p>
          ) : (
            <ol className="mt-3 space-y-3">
              {versions.map((version) => {
                const Icon = VERSION_ICON[version.status] ?? Clock
                return (
                  <li key={version.id} className="flex gap-2 text-sm">
                    <Icon
                      aria-hidden="true"
                      className={`mt-0.5 size-4 shrink-0 ${
                        version.status === 'approved'
                          ? 'text-[var(--color-success)]'
                          : version.status === 'rejected'
                            ? 'text-[var(--color-danger)]'
                            : 'text-sand-400'
                      }`}
                    />
                    <div>
                      <p className="text-sand-900 font-medium">
                        Version {version.versionNo}
                        <span className="text-sand-500 ml-1.5 font-normal">
                          {version.status === 'approved'
                            ? 'published'
                            : version.status === 'archived'
                              ? 'replaced'
                              : version.status}
                        </span>
                      </p>
                      <p className="text-sand-500 text-xs">
                        {formatDateTime(version.publishedAt ?? version.createdAt)}
                      </p>
                      {version.reason ? (
                        <p className="text-sand-600 mt-1 text-xs">{version.reason}</p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
