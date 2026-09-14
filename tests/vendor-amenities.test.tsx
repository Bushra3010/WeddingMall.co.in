import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { VendorAmenities } from '@/components/public/vendor-amenities'
import { selectPublicAttributes } from '@/server/dal/vendors'
import type { PublicVendorAttribute } from '@/server/dal/vendors'

// Explicit, because `globals` is off in vitest.config.ts — see decision-form.test.tsx.
afterEach(cleanup)

function definition(overrides: Partial<{
  id: string
  code: string
  label: string
  input_type: string
  unit: string | null
  sort_order: number
}>) {
  return {
    id: 'a1',
    code: 'wifi',
    label: 'Wi-Fi',
    input_type: 'boolean',
    unit: null,
    sort_order: 1,
    ...overrides,
  }
}

function attribute(overrides: Partial<PublicVendorAttribute> = {}): PublicVendorAttribute {
  return {
    id: 'a1',
    code: 'wifi',
    label: 'Wi-Fi',
    inputType: 'boolean',
    unit: null,
    sortOrder: 1,
    value: true,
    ...overrides,
  }
}

describe('which answers reach the page', () => {
  it('drops an attribute the vendor never answered', () => {
    const rows = [
      { value_json: null, category_attributes: definition({ id: 'a1' }) },
      { value_json: '', category_attributes: definition({ id: 'a2', input_type: 'text' }) },
      { value_json: [], category_attributes: definition({ id: 'a3', input_type: 'multiselect' }) },
    ]

    expect(selectPublicAttributes(rows)).toEqual([])
  })

  it('keeps an explicit "no" and an explicit zero', () => {
    const rows = [
      { value_json: false, category_attributes: definition({ id: 'a1', sort_order: 1 }) },
      {
        value_json: 0,
        category_attributes: definition({
          id: 'a2',
          code: 'parking',
          label: 'Parking capacity',
          input_type: 'number',
          unit: 'cars',
          sort_order: 2,
        }),
      },
    ]

    expect(selectPublicAttributes(rows).map((row) => row.value)).toEqual([false, 0])
  })

  it('leaves money to the packages section', () => {
    const rows = [
      {
        value_json: 1200,
        category_attributes: definition({
          code: 'price_per_plate',
          label: 'Price per plate',
          input_type: 'number',
          unit: 'INR',
        }),
      },
    ]

    expect(selectPublicAttributes(rows)).toEqual([])
  })

  it('orders by the admin-set sort order, then by label', () => {
    const rows = [
      { value_json: true, category_attributes: definition({ id: 'a1', label: 'Wi-Fi', sort_order: 3 }) },
      { value_json: true, category_attributes: definition({ id: 'a2', label: 'Garden', sort_order: 1 }) },
      { value_json: true, category_attributes: definition({ id: 'a3', label: 'Bridal room', sort_order: 1 }) },
    ]

    expect(selectPublicAttributes(rows).map((row) => row.label)).toEqual([
      'Bridal room',
      'Garden',
      'Wi-Fi',
    ])
  })
})

describe('the amenities grid', () => {
  it('leads a count with its number and groups the digits', () => {
    render(
      <VendorAmenities
        headingId="h"
        attributes={[
          attribute({
            code: 'capacity',
            label: 'Guest capacity',
            inputType: 'number',
            unit: 'guests',
            value: 12000,
          }),
        ]}
      />,
    )

    expect(screen.getByText('12,000')).toBeInTheDocument()
    expect(screen.getByText('Guest capacity')).toBeInTheDocument()
  })

  it('says so when a facility is present and when it is not', () => {
    render(
      <VendorAmenities
        headingId="h"
        attributes={[
          attribute({ id: 'a1', label: 'Swimming pool', value: true }),
          attribute({ id: 'a2', label: 'Bridal room', value: false, sortOrder: 2 }),
        ]}
      />,
    )

    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('Not available')).toBeInTheDocument()
  })

  it('lists a multiselect answer', () => {
    render(
      <VendorAmenities
        headingId="h"
        attributes={[
          attribute({
            code: 'cuisine',
            label: 'Cuisine',
            inputType: 'multiselect',
            value: ['North Indian', 'Jain'],
          }),
        ]}
      />,
    )

    expect(screen.getByText('North Indian, Jain')).toBeInTheDocument()
  })

  it('still renders a card for a code it has no icon for', () => {
    render(
      <VendorAmenities
        headingId="h"
        attributes={[attribute({ code: 'helipad', label: 'Helipad', value: true })]}
      />,
    )

    expect(screen.getByText('Helipad')).toBeInTheDocument()
  })

  it('renders nothing when the vendor has answered nothing', () => {
    const { container } = render(<VendorAmenities headingId="h" attributes={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
