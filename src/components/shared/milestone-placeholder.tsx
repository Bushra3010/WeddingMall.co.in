import Link from 'next/link'
import { Construction } from 'lucide-react'

/**
 * Honest stub for a route the delivery plan has not reached yet (PRD 18).
 *
 * These exist so the information architecture in PRD 5 is navigable and
 * link-checkable from Milestone 1 onward. Replace each one with the real screen
 * in the milestone named on it — do not ship these to production.
 */
export function MilestonePlaceholder({
  title,
  milestone,
  description,
  prdSection,
}: {
  title: string
  milestone: string
  description: string
  prdSection: string
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">{title}</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">{description}</p>
      </header>

      <div className="border-sand-300 flex items-start gap-3 rounded-[var(--radius-card)] border border-dashed bg-white p-5">
        <Construction aria-hidden="true" className="text-accent-700 mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sand-900 text-sm font-medium">Scheduled for {milestone}</p>
          <p className="text-sand-600 mt-1 text-sm">
            Specified in PRD {prdSection}. See{' '}
            <code className="bg-sand-100 rounded px-1 py-0.5 text-xs">docs/STATUS.md</code> for the
            current position in the delivery plan.
          </p>
          <Link
            href="/"
            className="text-brand-700 mt-3 inline-block text-sm font-medium hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
