import { Check, X, type LucideIcon } from 'lucide-react'

import { amenityIcon } from '@/components/public/amenity-icons'
import { cn } from '@/lib/utils'
import type { PublicVendorAttribute } from '@/server/dal/vendors'

/**
 * Facilities (PRD 6.2), rendered from the vendor's attribute answers rather
 * than a hard-coded list per category — the same rows the search filters match
 * against, so a venue cannot advertise a swimming pool here and be absent from
 * the swimming-pool filter.
 *
 * Nothing is invented. An attribute the vendor has not answered is not shown,
 * and an explicit "no" is shown as one rather than quietly dropped, because a
 * grid that only ever says "Available" tells a couple nothing about what is
 * missing.
 */

/** Grouping separators, not decoration: 12000 guests reads as 12,000. */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function VendorAmenities({
  attributes,
  headingId,
}: {
  attributes: PublicVendorAttribute[]
  headingId: string
}) {
  if (attributes.length === 0) return null

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="font-display text-sand-900 text-xl">
        Amenities
      </h2>

      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {attributes.map((attribute) => (
          <AmenityCard key={attribute.id} attribute={attribute} />
        ))}
      </ul>
    </section>
  )
}

function AmenityCard({ attribute }: { attribute: PublicVendorAttribute }) {
  const Icon = amenityIcon(attribute.code)
  const { value } = attribute

  // A yes/no facility: the tile is tinted by the answer so the grid can be
  // read at a glance without parsing every line of text.
  if (typeof value === 'boolean') {
    return (
      <Card
        icon={Icon}
        tone={value ? 'yes' : 'no'}
        title={attribute.label}
        detail={
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              value ? 'text-[var(--color-success)]' : 'text-sand-500',
            )}
          >
            {value ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <X aria-hidden="true" className="size-3.5" />
            )}
            {value ? 'Available' : 'Not available'}
          </span>
        }
      />
    )
  }

  // A count: the number leads, because that is what someone is scanning for.
  if (typeof value === 'number') {
    const unit = attribute.unit && attribute.unit !== attribute.label ? ` ${attribute.unit}` : ''
    return (
      <Card
        icon={Icon}
        tone="count"
        title={
          <span className="text-sand-900 text-lg font-semibold">
            {formatNumber(value)}
            {unit ? <span className="text-sand-600 text-sm font-normal">{unit}</span> : null}
          </span>
        }
        detail={<span className="text-sand-600 text-xs">{attribute.label}</span>}
      />
    )
  }

  const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value)

  return (
    <Card
      icon={Icon}
      tone="count"
      title={attribute.label}
      detail={<span className="text-sand-600 text-xs">{text}</span>}
    />
  )
}

function Card({
  icon: Icon,
  tone,
  title,
  detail,
}: {
  icon: LucideIcon
  tone: 'yes' | 'no' | 'count'
  title: React.ReactNode
  detail: React.ReactNode
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius-card)] border p-3',
        tone === 'yes' ? 'border-sand-200 bg-white' : null,
        tone === 'no' ? 'border-sand-200 bg-sand-50' : null,
        tone === 'count' ? 'border-sand-200 bg-white' : null,
      )}
    >
      <span
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-xl',
          tone === 'no' ? 'bg-sand-100 text-sand-400' : 'bg-brand-50 text-brand-700',
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>

      <span className="min-w-0">
        <span className="text-sand-900 block truncate text-sm font-medium">{title}</span>
        <span className="mt-0.5 block">{detail}</span>
      </span>
    </li>
  )
}
