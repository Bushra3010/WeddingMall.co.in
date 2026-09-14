import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The form conventions in `writeAttributeValues`, which both the vendor's own
 * Services form and the admin editor now share.
 *
 * Worth pinning down because every one of these is silent when wrong: an
 * answer is cleared, or kept, and nothing errors.
 */

const DEFINITIONS = [
  { id: 'num', code: 'capacity', data_type: 'number', input_type: 'number' },
  { id: 'bool', code: 'wifi', data_type: 'boolean', input_type: 'boolean' },
  { id: 'text', code: 'note', data_type: 'string', input_type: 'text' },
  { id: 'multi', code: 'cuisine', data_type: 'array', input_type: 'multiselect' },
  // Belongs to a category this vendor is not in, so no form ever renders it.
  { id: 'other', code: 'style', data_type: 'array', input_type: 'multiselect' },
]

const captured = { upserted: [] as unknown[], cleared: [] as string[] }

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from(table: string) {
      if (table === 'category_attributes') {
        return { select: async () => ({ data: DEFINITIONS, error: null }) }
      }
      return {
        upsert: async (rows: unknown[]) => {
          captured.upserted = rows
          return { error: null }
        },
        delete: () => ({
          eq: () => ({
            in: async (_column: string, ids: string[]) => {
              captured.cleared = ids
              return { error: null }
            },
          }),
        }),
      }
    },
  }),
}))

const { writeAttributeValues } = await import('@/server/services/vendor-attributes')

beforeEach(() => {
  captured.upserted = []
  captured.cleared = []
})
afterEach(() => vi.clearAllMocks())

function valueFor(id: string) {
  const row = captured.upserted.find(
    (r): r is { category_attribute_id: string; value_json: unknown } =>
      typeof r === 'object' && r !== null && (r as { category_attribute_id: string }).category_attribute_id === id,
  )
  return row?.value_json
}

describe('writing attribute answers', () => {
  it('stores an unchecked box as a real "no", not as unanswered', async () => {
    const form = new FormData()
    form.set('attr__bool__present', '1')

    await writeAttributeValues('v1', form)

    expect(valueFor('bool')).toBe(false)
    expect(captured.cleared).not.toContain('bool')
  })

  it('leaves a boolean alone when the form never carried it', async () => {
    await writeAttributeValues('v1', new FormData())

    expect(captured.upserted).toEqual([])
    expect(captured.cleared).toEqual([])
  })

  it('clears a multiselect the admin emptied', async () => {
    const form = new FormData()
    form.set('attr__multi__present', '1')

    await writeAttributeValues('v1', form)

    expect(captured.cleared).toEqual(['multi'])
  })

  it('does NOT clear a multiselect the form never rendered', async () => {
    // The regression this guards: the loop walks every definition in the
    // database, but a form only renders the vendor's own categories. Keying
    // "empty" on an absent field wiped answers a save had nothing to do with.
    const form = new FormData()
    form.set('attr__multi__present', '1')
    form.append('attr__multi', 'North Indian')

    await writeAttributeValues('v1', form)

    expect(captured.cleared).not.toContain('other')
    expect(valueFor('multi')).toEqual(['North Indian'])
  })

  it('stores a number as a number and a blank as a clear', async () => {
    const form = new FormData()
    form.set('attr__num', '1500')
    form.set('attr__text', '   ')

    await writeAttributeValues('v1', form)

    expect(valueFor('num')).toBe(1500)
    expect(captured.cleared).toEqual(['text'])
  })

  it('reports what it did', async () => {
    const form = new FormData()
    form.set('attr__num', '12')
    form.set('attr__text', '')

    await expect(writeAttributeValues('v1', form)).resolves.toEqual({ saved: 1, cleared: 1 })
  })
})
