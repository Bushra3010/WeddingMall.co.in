import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { VendorCard } from '@/components/public/vendor-card'
import type { VendorSearchResult } from '@/server/dal/search'

// Explicit, because `globals` is off in vitest.config.ts — see decision-form.test.tsx.
afterEach(cleanup)

function result(overrides: Partial<VendorSearchResult> = {}): VendorSearchResult {
  return {
    vendorId: 'v1',
    slug: 'usha-resort',
    displayName: 'Usha Resort',
    citySlug: 'patna',
    cityName: 'Patna',
    ratingAverage: 0,
    ratingCount: 0,
    verificationStatus: 'verified',
    isFeatured: false,
    startingAmountMinor: null,
    currency: 'INR',
    coverPath: null,
    rankScore: 0,
    photoCount: 0,
    highlights: [],
    ...overrides,
  }
}

describe('the vendor card', () => {
  it('shows the headline numbers the vendor answered', () => {
    render(
      <VendorCard
        vendor={result({
          highlights: [
            { code: 'capacity', value: 1000, noun: 'guests' },
            { code: 'parking', value: 100, noun: 'cars' },
          ],
        })}
      />,
    )

    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.getByText('guests')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('cars')).toBeInTheDocument()
  })

  it('claims no capacity when nobody gave one', () => {
    render(<VendorCard vendor={result()} />)

    // The whole strip is absent rather than rendering empty chips.
    expect(screen.queryByText('guests')).not.toBeInTheDocument()
  })

  it('counts the photographs exactly, with no "+"', () => {
    render(<VendorCard vendor={result({ photoCount: 31 })} />)

    const badge = screen.getByText('31')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).not.toContain('+')
  })

  it('does not badge a vendor with a single photo', () => {
    // One photo is the cover; "1" next to a camera reads as a broken gallery.
    render(<VendorCard vendor={result({ photoCount: 1 })} />)

    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })
})
