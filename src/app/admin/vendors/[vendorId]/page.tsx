import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Image as ImageIcon } from 'lucide-react'

import { BankReveal } from '@/components/admin/bank-reveal'
import { DecisionForm } from '@/components/admin/decision-form'
import { DocumentLink } from '@/components/admin/document-link'
import { VendorBankEditor } from '@/components/admin/vendor-bank-editor'
import { VendorDeletePanel } from '@/components/admin/vendor-delete-panel'
import { VendorDocumentsManager } from '@/components/admin/vendor-documents-manager'
import { VendorEditForm } from '@/components/admin/vendor-edit-form'
import { AttributeForm } from '@/components/vendor/attribute-form'
import { saveAdminVendorAttributesAction } from '@/features/admin/vendor-actions'
import { NOINDEX } from '@/lib/seo'
import { can } from '@/lib/permissions'
import { formatDateTime } from '@/lib/dates'
import { requireElevatedAdmin } from '@/server/policies/require'
import { getAdminVendor, getAuditTrail } from '@/server/dal/admin'
import { getBankAccountSummary } from '@/server/dal/vendor-bank'
import { listAttributes, listCities } from '@/server/dal/taxonomy'
import { getVendorAttributeValues } from '@/server/dal/vendor-attributes'

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
  // Writing them is the finance desk's, not the verifier's — 0040 mirrors this.
  const canEditBank = can(actor, 'billing.manage')

  const [vendor, audit, cities, bank, allAttributes, attributeValues] = await Promise.all([
    getAdminVendor(vendorId),
    getAuditTrail(vendorId),
    // 200 rather than the public default of 24: an admin correcting a business
    // must be able to reach any city, not just the ones on the homepage.
    listCities(200),
    canSeeBank ? getBankAccountSummary(vendorId) : Promise.resolve(null),
    listAttributes(),
    getVendorAttributeValues(vendorId),
  ])
  if (!vendor) notFound()

  const canEdit = can(actor, 'vendor.verify') || can(actor, 'vendor.suspend')
  // Listing content, so the same right that approves a listing version —
  // mirrors `vendor_attribute_values: admin manage` in migration 0041.
  const canEditAttributes = can(actor, 'listing.moderate')
  const attributes = allAttributes.filter((a) => vendor.categoryIds.includes(a.categoryId))

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
        <div className="flex flex-wrap items-center gap-4">
          {/*
            The listing editor is the vendor's own wizard (0041) — photographs,
            categories, service areas, packages. The Edit details form below
            covers the registration fields only, which is why this is a separate
            destination rather than another section on this page.
          */}
          {can(actor, 'listing.moderate') ? (
            <Link
              href={`/admin/vendors/${vendor.id}/listing`}
              className="text-brand-700 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              <ImageIcon aria-hidden="true" className="size-3.5" />
              Edit listing &amp; photos
            </Link>
          ) : null}
          {vendor.status === 'active' ? (
            <Link
              href={`/vendor/${vendor.slug}`}
              className="text-brand-700 text-sm font-medium hover:underline"
            >
              View public profile
            </Link>
          ) : null}
        </div>
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

          {/*
            Amenities.

            `/admin/vendors/<id>/listing` (0041) reuses the vendor's own wizard,
            and that wizard has no attributes step — its steps are business,
            about, categories, areas, media, documents, bank, submit. The
            vendor's own answers live at `/vendor-dashboard/services`, which
            resolves the vendor as the signed-in user's own. So this panel is
            still the only place an attribute can be answered for a business the
            admin is not a member of. The RLS it relies on is already there:
            `vendor_attribute_values: admin manage` in 0041.
          */}
          <section
            id="amenities"
            className="border-sand-200 scroll-mt-6 rounded-[var(--radius-card)] border bg-white p-5"
          >
            <h2 className="font-display text-sand-900 text-lg">Amenities and services</h2>
            <p className="text-sand-600 mt-1 mb-4 text-sm">
              These answers drive both the category filters and the amenities grid on the public
              profile. Only the questions for {vendor.displayName}&rsquo;s categories are shown.
            </p>
            <AttributeForm
              vendorId={vendor.id}
              vendorSlug={vendor.slug}
              attributes={attributes}
              values={attributeValues}
              readOnly={!canEditAttributes}
              saveAction={saveAdminVendorAttributesAction}
              emptyMessage={`No questions have been set up for ${vendor.displayName}'s categories yet.`}
              successMessage="Saved. The public profile updates on its next request."
            />
            {!canEditAttributes ? (
              <p className="text-sand-600 mt-2 text-sm">
                Answering these requires the listing.moderate permission.
              </p>
            ) : null}
          </section>

          {/*
            Documents are added and removed here as well as read (0040). The
            list was read-only until then, which left a business signed up over
            the phone with no route for its paperwork at all — the person
            holding the GST certificate is the admin, not the owner.
          */}
          <section className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
            <h2 className="font-display text-sand-900 mb-3 text-lg">Verification documents</h2>
            <VendorDocumentsManager
              vendorId={vendor.id}
              documents={vendor.documents}
              canManage={can(actor, 'vendor.verify')}
            />
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
                  No payout details on file. Optional — a business can be published, verified and
                  taking enquiries without them.
                </p>
              )}

              {/*
                Editing arrives with 0040. Until it, this section could only be
                read, and said so: "Only the business owner can add them". That
                was true of the schema and useless in practice — the fallback
                was collecting account numbers over WhatsApp, which is what 0038
                was written to stop.
              */}
              <VendorBankEditor
                vendorId={vendor.id}
                hasAccount={Boolean(bank)}
                canManage={canEditBank}
                defaults={
                  bank
                    ? {
                        accountHolderName: bank.accountHolderName,
                        ifsc: bank.ifsc,
                        accountType: bank.accountType,
                        bankName: bank.bankName,
                        branchName: bank.branchName,
                        upiId: bank.upiId,
                      }
                    : null
                }
              />
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
