import { AlertTriangle, CheckCircle2, Clock, FileEdit, XCircle } from 'lucide-react'

import type { VendorWorkspace } from '@/server/dal/vendor-workspace'

/**
 * Publication status (PRD 6.9). A rejection or change request is only useful
 * with the reason attached, so the reason is always surfaced here.
 */
export function StatusBanner({ vendor }: { vendor: VendorWorkspace }) {
  const config = {
    draft: {
      icon: FileEdit,
      tone: 'border-sand-300 bg-sand-50 text-sand-800',
      title: vendor.rejectionReason ? 'Changes requested' : 'Draft — not yet visible',
      body: vendor.rejectionReason
        ? `Our team asked for changes: ${vendor.rejectionReason}`
        : 'Complete the required sections, then submit for review.',
    },
    pending_review: {
      icon: Clock,
      tone: 'border-accent-300 bg-accent-100 text-sand-900',
      title: 'Awaiting review',
      body: 'Our team is checking your details. You can still edit while you wait.',
    },
    active: {
      icon: CheckCircle2,
      tone: 'border-[var(--color-success)] bg-[color-mix(in_oklch,var(--color-success)_10%,white)] text-sand-900',
      title: 'Live',
      body: 'Your listing is published and can receive enquiries.',
    },
    rejected: {
      icon: XCircle,
      tone: 'border-[var(--color-danger)] bg-[color-mix(in_oklch,var(--color-danger)_8%,white)] text-sand-900',
      title: 'Not approved',
      body: vendor.rejectionReason ?? 'Contact support if you think this is a mistake.',
    },
    suspended: {
      icon: AlertTriangle,
      tone: 'border-[var(--color-danger)] bg-[color-mix(in_oklch,var(--color-danger)_8%,white)] text-sand-900',
      title: 'Suspended',
      body: vendor.suspendedReason ?? 'Contact support for details.',
    },
    archived: {
      icon: FileEdit,
      tone: 'border-sand-300 bg-sand-50 text-sand-800',
      title: 'Archived',
      body: 'This business is no longer active.',
    },
  }[vendor.status] ?? {
    icon: FileEdit,
    tone: 'border-sand-300 bg-sand-50 text-sand-800',
    title: vendor.status,
    body: '',
  }

  const Icon = config.icon

  return (
    <div
      className={`flex items-start gap-3 rounded-[var(--radius-card)] border p-4 ${config.tone}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-medium">{config.title}</p>
        {config.body ? <p className="mt-0.5 text-sm opacity-90">{config.body}</p> : null}
      </div>
    </div>
  )
}
