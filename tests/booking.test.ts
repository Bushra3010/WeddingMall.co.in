import { describe, expect, it } from 'vitest'

import {
  bookingMessage,
  bookingSchema,
  enquirySchema,
  normaliseIndianMobile,
} from '@/features/enquiries/schema'

const BASE = {
  vendorId: '7b0c8f0e-1f1a-4c1e-9a55-0d5d3c1b2a01',
  fullName: 'Priya Sharma',
  phone: '98765 43210',
  eventDate: '2027-02-14',
  contactConsent: true,
  idempotencyKey: '0f8b2c4d-3e5f-4a6b-8c7d-9e0f1a2b3c4d',
}

describe('bookingSchema', () => {
  it('books with just a date and consent', () => {
    expect(bookingSchema.safeParse(BASE).success).toBe(true)
  })

  it('needs a date', () => {
    expect(bookingSchema.safeParse({ ...BASE, eventDate: '' }).success).toBe(false)
  })

  it('needs a name and an Indian mobile number, and normalises the number', () => {
    expect(bookingSchema.safeParse({ ...BASE, fullName: '' }).success).toBe(false)
    expect(bookingSchema.safeParse({ ...BASE, phone: '12345' }).success).toBe(false)
    const parsed = bookingSchema.safeParse(BASE)
    expect(parsed.success).toBe(true)
    expect(parsed.data?.phone).toBe('+919876543210')
  })

  it('needs the customer to agree to share their contact details', () => {
    const result = bookingSchema.safeParse({ ...BASE, contactConsent: false })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['contactConsent'])
  })
})

describe('bookingMessage', () => {
  it('always clears the enquiry message minimum, even with nothing optional', () => {
    const message = bookingMessage({ eventDate: '2027-02-14' })
    expect(enquirySchema.safeParse({ ...BASE, message, contactConsent: true }).success).toBe(true)
  })

  it('includes the time, guests and note when given', () => {
    const message = bookingMessage({
      eventDate: '2027-02-14',
      eventTime: '18:30',
      guestCount: 4,
      note: 'Pickup from Boring Road',
    })
    expect(message).toContain('2027-02-14 at 18:30')
    expect(message).toContain('Guests: 4.')
    expect(message).toContain('Pickup from Boring Road')
  })
})

describe('normaliseIndianMobile', () => {
  it('accepts the ways people type a mobile number', () => {
    for (const raw of [
      '9876543210',
      '98765 43210',
      '098765-43210',
      '+91 98765 43210',
      '919876543210',
    ]) {
      expect(normaliseIndianMobile(raw)).toBe('+919876543210')
    }
  })

  it('rejects landlines, short numbers and foreign formats', () => {
    for (const raw of ['01123456789', '12345', '+44 7700 900123', '5876543210', '']) {
      expect(normaliseIndianMobile(raw)).toBeNull()
    }
  })
})
