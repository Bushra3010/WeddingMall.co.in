import { CountUp } from '@/components/shared/count-up'
import { cn } from '@/lib/utils'
import type { HomeStat } from '@/server/dal/homepage'

/**
 * Trust statistics as a standalone card — the mobile presentation of the
 * figures the hero carries on desktop (PRD 6.1.2).
 *
 * On a phone the hero has no room for a stat row underneath the headline
 * without pushing the search box below the fold, so the numbers move into
 * their own strip further down the page. Same `HomeStat[]`, same live counts:
 * every value is queried, and a stat with nothing behind it never reaches this
 * component (PRD 6.1 forbids hard-coded numerical claims).
 *
 * Three across is the widest that stays legible at 360px, so the list is
 * capped rather than wrapped into a ragged second row.
 */
export function StatStrip({ stats, className }: { stats: HomeStat[]; className?: string }) {
  const shown = stats.slice(0, 3)
  if (shown.length === 0) return null

  return (
    <dl
      className={cn(
        'border-sand-200 divide-sand-200 grid divide-x rounded-[var(--radius-panel)] border bg-white py-5 shadow-[var(--shadow-soft)]',
        shown.length === 3 ? 'grid-cols-3' : shown.length === 2 ? 'grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {shown.map((stat) => (
        // `flex-col-reverse` puts the figure above its label visually while
        // keeping the dt-before-dd order a definition list requires.
        <div key={stat.key} className="flex flex-col-reverse px-2 text-center">
          <dt className="text-sand-500 mt-0.5 text-[11px] leading-tight">{stat.label}</dt>
          <dd className="font-display text-sand-900 text-2xl font-semibold">
            <CountUp value={stat.value} decimals={stat.decimals ?? 0} />
            {stat.suffix ? <span className="text-brand-600">{stat.suffix}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
