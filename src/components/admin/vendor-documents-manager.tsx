'use client'

import { Trash2, Upload } from 'lucide-react'

import { fieldError, FormMessage, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { DocumentLink } from '@/components/admin/document-link'
import {
  adminDeleteVendorDocumentAction,
  adminUploadVendorDocumentAction,
} from '@/features/admin/vendor-support-actions'
import { ADMIN_DOCUMENT_KINDS } from '@/features/admin/vendor-documents'
import { formatDate } from '@/lib/dates'

/**
 * Verification documents, from the admin side (migration 0040).
 *
 * The list itself was here before and was read-only — an admin could open a
 * document and never add one. Businesses signed up over the phone or at a
 * wedding fair hand their GST certificate to the salesperson, not to a login
 * form, so the paperwork had nowhere to go.
 *
 * `canManage` decides whether the controls render; the server refuses
 * independently of what this component decided (CLAUDE.md invariant 2). Both
 * writes are recorded in the audit trail rendered further down the same page,
 * because this is somebody editing a record that is not theirs.
 */
export function VendorDocumentsManager({
  vendorId,
  documents,
  canManage,
}: {
  vendorId: string
  documents: { id: string; documentType: string; createdAt: string }[]
  canManage: boolean
}) {
  const [uploadState, upload] = useAction(adminUploadVendorDocumentAction)
  const [deleteState, remove] = useAction(adminDeleteVendorDocumentAction)

  const label = (value: string) =>
    ADMIN_DOCUMENT_KINDS.find((kind) => kind.value === value)?.label ?? value

  return (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <p className="text-sand-600 text-sm">No documents uploaded.</p>
      ) : (
        <ul className="divide-sand-200 border-sand-200 divide-y rounded-lg border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sand-900 text-sm font-medium">{label(doc.documentType)}</p>
                <p className="text-sand-500 text-xs">Uploaded {formatDate(doc.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <DocumentLink documentId={doc.id} />
                {canManage ? (
                  <form action={remove}>
                    <input type="hidden" name="documentId" value={doc.id} />
                    <input type="hidden" name="vendorId" value={vendorId} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${label(doc.documentType)}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormMessage state={deleteState} successMessage="Document removed." />

      <p className="text-sand-500 text-xs">
        Documents open through a link that expires after two minutes. Opening one is recorded.
      </p>

      {canManage ? (
        <form action={upload} className="border-sand-200 space-y-3 border-t pt-4">
          <input type="hidden" name="vendorId" value={vendorId} />

          <div>
            <h3 className="text-sand-900 text-sm font-medium">Add a document</h3>
            <p className="text-sand-500 mt-0.5 text-xs">
              For paperwork collected over the phone or in person. It is stored privately, never
              shown on the public profile, and adding it is recorded against your account.
            </p>
          </div>

          {/*
            Not a plain `FormMessage`: uploading a cancelled cheque can succeed
            while attaching it to the payout account does not — attaching needs
            billing.manage, uploading needs vendor.verify — and the file is
            stored either way. One boolean cannot say that.
          */}
          {uploadState?.ok ? (
            <p
              role="status"
              className={
                uploadState.data.attached
                  ? 'rounded-lg bg-[color-mix(in_oklch,var(--color-success)_12%,white)] px-3 py-2 text-sm text-[var(--color-success)]'
                  : 'bg-accent-100 text-accent-700 rounded-lg px-3 py-2 text-sm'
              }
            >
              {uploadState.data.attached
                ? 'Cheque uploaded and attached to the payout details.'
                : (uploadState.data.reason ?? 'Document uploaded.')}
            </p>
          ) : (
            <FormMessage state={uploadState} />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Document type" error={fieldError(uploadState, 'documentType')} required>
              {({ id, describedBy, invalid }) => (
                <select
                  id={id}
                  name="documentType"
                  required
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  className="border-sand-300 h-11 w-full rounded-lg border bg-white px-3 text-sm"
                >
                  {ADMIN_DOCUMENT_KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="File" hint="PDF, JPEG, or PNG. Up to 10 MB." required>
              {({ id }) => (
                <input
                  id={id}
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  required
                  className="border-sand-300 mt-1.5 block w-full rounded-lg border bg-white p-2 text-sm"
                />
              )}
            </Field>
          </div>

          <SubmitButton pendingLabel="Uploading…">
            <Upload aria-hidden="true" />
            Upload document
          </SubmitButton>
        </form>
      ) : (
        <p className="border-sand-200 text-sand-500 border-t pt-4 text-xs">
          Adding or removing a document needs the vendor.verify permission.
        </p>
      )}
    </div>
  )
}
