import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BankReveal } from '@/components/admin/bank-reveal'
import { DecisionForm } from '@/components/admin/decision-form'
import { DocumentLink } from '@/components/admin/document-link'
import { VendorDeletePanel } from '@/components/admin/vendor-delete-panel'
import { VendorEditForm } from '@/components/admin/vendor-edit-form'
import { NOINDEX } from '@/lib/seo'
import { can } from '@/lib/permissions'
import { formatDateTime } from '@/lib/dates'
import { requireElevatedAdmin } from '@/server/policies/require'
import { getAdminVendor, getAuditTrail } from '@/server/dal/admin'
import { getBankAccountSummary } from '@/server/dal/vendor-bank'
import { listCities } from '@/server/dal/taxonomy'

export const metadata = { title: 'Vendor detail', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function AdminVendorDetailPage({
  params,
}: {
  params: Promise<{ vendorId: string }>
}) {
  const actor = await requireElevatedAdmin('vendor.read')
  const { vendorId } = await params

  // Mirrors the `vendor_bank_accounts: owner read` policy in 0038. Checked here
  // as well so the query is not even issued for an admin RLS would refuse —
  // and so the section is absent rather than empty, which would read as "this
  // business has no payout details" to someone simply not allowed to see them.
  const canSeeBank = can(actor, 'billing.manage') || can(actor, 'vendor.verify')

  const [vendor, audit, cities, bank] = await Promise.all([
    getAdminVendor(vendorId),
    getAuditTrail(vendorId),
    // 200 rather than the public default of 24: an admin correcting a business
    // must be able to reach any city, not just the ones on the homepage.
    listCities(200),
    canSeeBank ? getBankAccountSummary(vendorId) : Promise.resolve(null),
  ])
  if (!vendor) notFound()

  const canEdit = can(actor, 'vendor.verify') || can(actor, 'vendor.suspend')

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

          {/* `id` is the target of the Edit link on the vendor list, so an
              admin arrives with the form already in view. */}
          <section
            id="edit"
            className="border-sand-200 scroll-mt-6 rounded-[var(--radius-card)] border bg-white p-5"
          >
            <h2 className="font-display text-sand-900 text-lg">Edit details</h2>
            {canEdit ? (
              <>
                <p className="text-sand-600 mt-1 mb-4 text-sm">
                  Corrections made on the business&rsquo;s behalf. Publication and verification are
                  decided in the panel alongside, not here.
                </p>
                <VendorEditForm
                  vendor={{
                    id: vendor.id,
                    displayName: vendor.displayName,
                    legalName: vendor.legalName,
                    slug: vendor.slug,
                    primaryCityId: vendor.primaryCityId,
                    cityName: vendor.cityName,
                    email: vendor.email,
                    phone: vendor.phone,
                    website: vendor.website,
                    foundedYear: vendor.foundedYear,
                    about: vendor.about,
                  }}
                  cities={cities}
                />
              </>
            ) : (
              <p className="text-sand-600 mt-2 text-sm">
                Editing a business requires the vendor.verify or vendor.suspend permission.
              </p>
            )}
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

          {/*
            Payout details.

            Gated twice, on purpose. RLS (0038) restricts the row to
            `billing.manage` or `vendor.verify` — an analyst, a content admin or
            a support agent reads nothing — and this section is not rendered for
            anyone else either, so the page does not show an empty panel that
            looks like "this business has not entered any".

            The account number is never in this HTML. `getBankAccountSummary`
            masks it in the DAL; the full value comes from `BankReveal`, which
            audits first.
          */}
          {canSeeBank ? (
            <section className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
              <h2 className="font-display text-sand-900 text-lg">Payout details</h2>
              {bank ? (
                <>
                  <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {[
                      ['Account holder', bank.accountHolderName],
                      ['Account number', bank.accountNumberMasked],
                      ['IFSC', bank.ifsc],
                      ['Account type', bank.accountType],
                      ['Bank', bank.bankName],
                      ['Branch', bank.branchName],
                      ['UPI', bank.upiId],
                      [
                        'Verified',
                        bank.verifiedAt ? formatDateTime(bank.verifiedAt) : 'Not checked yet',
                      ],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <dt className="text-sand-500 text-xs tracking-wide uppercase">{label}</dt>
                        <dd className="text-sand-900 text-sm">{value || '—'}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="border-sand-200 mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <BankReveal vendorId={vendor.id} />
                    {bank.chequeDocumentId ? (
                      <span className="flex items-center gap-2 text-sm">
                        <span className="text-sand-700">Cancelled cheque</span>
                        <DocumentLink documentId={bank.chequeDocumentId} />
                      </span>
                    ) : (
                      <span className="text-sand-500 text-xs">No cancelled cheque uploaded.</span>
                    )}
                  </div>

                  <p className="text-sand-500 mt-3 text-xs">
                    Revealing the account number is recorded against your account.
                  </p>
                </>
              ) : (
                <p className="text-sand-600 mt-2 text-sm">
                  No payout details on file. Only the business owner can add them.
                </p>
              )}
            </section>
          ) : null}

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
          >
            {can(actor, 'admin.manage') ? (
              <VendorDeletePanel vendorId={vendor.id} displayName={vendor.displayName} />
            ) : null}
          </DecisionForm>
        </div>
      </div>
    </div>
  )
}
