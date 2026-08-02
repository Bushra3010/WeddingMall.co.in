import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DecisionForm } from '@/components/admin/decision-form'
import { DocumentLink } from '@/components/admin/document-link'
import { NOINDEX } from '@/lib/seo'
import { can } from '@/lib/permissions'
import { formatDateTime } from '@/lib/dates'
import { requireElevatedAdmin } from '@/server/policies/require'
import { getAdminVendor, getAuditTrail } from '@/server/dal/admin'

export const metadata = { title: 'Vendor detail', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function AdminVendorDetailPage({
  params,
}: {
  params: Promise<{ vendorId: string }>
}) {
  const actor = await requireElevatedAdmin('vendor.read')
  const { vendorId } = await params

  const [vendor, audit] = await Promise.all([getAdminVendor(vendorId), getAuditTrail(vendorId)])
  if (!vendor) notFound()

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sand-500 text-xs">
        <Link href="/admin/vendors" className="hover:text-brand-700">
          Vendors
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-sand-700">{vendor.displayName}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-sand-900 text-2xl">{vendor.displayName}</h1>
          <p className="text-sand-600 mt-1 text-sm">
            {vendor.status} · verification {vendor.verificationStatus}
            {vendor.submittedAt ? ` · submitted ${formatDateTime(vendor.submittedAt)}` : ''}
          </p>
        </div>
        {vendor.status === 'active' ? (
          <Link
            href={`/vendor/${vendor.slug}`}
            className="text-brand-700 text-sm font-medium hover:underline"
          >
            View public profile
          </Link>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
            <h2 className="font-display text-sand-900 text-lg">Business</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ['Legal name', vendor.legalName],
                ['City', vendor.cityName],
                ['Categories', vendor.categories.join(', ') || null],
                ['Service areas', vendor.serviceAreas.join(', ') || null],
                ['Owner', vendor.ownerName],
                ['Founded', vendor.foundedYear ? String(vendor.foundedYear) : null],
                ['Experience', vendor.experienceYears ? `${vendor.experienceYears} years` : null],
                ['Website', vendor.website],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-sand-500 text-xs tracking-wide uppercase">{label}</dt>
                  <dd className="text-sand-900 text-sm">{value || '—'}</dd>
                </div>
              ))}
            </dl>

            {/* Contact details are PII: shown only to admins who hold
                user.support, per PRD 10.2. */}
            {can(actor, 'user.support') ? (
              <dl className="border-sand-200 mt-4 grid gap-x-6 gap-y-3 border-t pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sand-500 text-xs tracking-wide uppercase">Email</dt>
                  <dd className="text-sand-900 text-sm">{vendor.email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-sand-500 text-xs tracking-wide uppercase">Phone</dt>
                  <dd className="text-sand-900 text-sm">{vendor.phone || '—'}</dd>
                </div>
              </dl>
            ) : (
              <p className="border-sand-200 text-sand-500 mt-4 border-t pt-4 text-xs">
                Contact details are hidden. They require the user.support permission.
              </p>
            )}
          </section>

          <section className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
            <h2 className="font-display text-sand-900 text-lg">About</h2>
            <p className="text-sand-700 mt-2 text-sm whitespace-pre-line">
              {vendor.about || 'No description provided.'}
            </p>
          </section>

          <section className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
            <h2 className="font-display text-sand-900 text-lg">Verification documents</h2>
            {vendor.documents.length === 0 ? (
              <p className="text-sand-600 mt-2 text-sm">No documents uploaded.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {vendor.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-sand-800">{doc.documentType}</span>
                    <DocumentLink documentId={doc.id} />
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sand-500 mt-3 text-xs">
              Documents open through a link that expires after two minutes. Opening one is recorded.
            </p>
          </section>

          <section className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
            <h2 className="font-display text-sand-900 text-lg">Audit trail</h2>
            {audit.length === 0 ? (
              <p className="text-sand-600 mt-2 text-sm">No recorded actions yet.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {audit.map((entry) => (
                  <li key={entry.id} className="border-sand-200 border-l-2 pl-3 text-sm">
                    <p className="text-sand-900 font-medium">{entry.action}</p>
                    <p className="text-sand-500 text-xs">
                      {entry.actor_type} · {formatDateTime(entry.created_at)}
                    </p>
                    {entry.reason ? <p className="text-sand-700 mt-1">{entry.reason}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <DecisionForm
            vendorId={vendor.id}
            status={vendor.status}
            canVerify={can(actor, 'vendor.verify')}
            canSuspend={can(actor, 'vendor.suspend')}
          />
        </div>
      </div>
    </div>
  )
}
