import { VendorCard } from '@/components/public/vendor-card'
import { Reveal } from '@/components/shared/reveal'
import { cn } from '@/lib/utils'
import type { VendorSearchResult } from '@/server/dal/search'

/**
 * A list of vendor cards that is a swipeable rail on a phone and a grid from
 * `sm` up (PRD 6.1.4).
 *
 * On mobile the rail is deliberately allowed to bleed past the page gutter and
 * each card is sized under a full viewport width, so the next card is always
 * partly visible. That sliver is what tells someone the row scrolls — a rail
 * whose cards align exactly to the edge reads as a single static card.
 *
 * It stays a plain scroll container: no custom drag handling, so momentum,
 * keyboard scrolling, and screen-reader navigation keep working.
 */
export function VendorRail({
  vendors,
  save = false,
  className,
}: {
  vendors: VendorSearchResult[]
  /** Show a save control on each card; it resolves its own state (ADR-030). */
  save?: boolean
  className?: string
}) {
  if (vendors.length === 0) return null

  return (
    <ul
      className={cn(
        // `scroll-px-4` matters: without it the snapport starts at the padding
        // box, so the browser scrolls the first card flush to the viewport edge
        // and the row loses its left gutter.
        'no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2',
        'sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0',
        'lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {vendors.map((vendor, index) => (
        <Reveal
          as="li"
          key={vendor.vendorId}
          delay={index * 60}
          className="w-[78vw] max-w-xs shrink-0 snap-start sm:w-auto sm:max-w-none"
        >
          <VendorCard vendor={vendor} save={save} />
        </Reveal>
      ))}
    </ul>
  )
}
