import { describe, expect, it } from 'vitest'

import { missingRequiredAttributes } from '@/server/services/vendor-attributes'

const defs = [
  { id: 'model', input_type: 'text', data_type: 'string', required: true },
  { id: 'fuel', input_type: 'select', data_type: 'string', required: true },
  { id: 'langs', input_type: 'multiselect', data_type: 'array', required: true },
  { id: 'gotra', input_type: 'text', data_type: 'string', required: false },
  { id: 'ac', input_type: 'boolean', data_type: 'boolean', required: true },
]

function form(entries: [string, string][]) {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

describe('missingRequiredAttributes', () => {
  it('names every required question left empty on the form', () => {
    const missing = missingRequiredAttributes(
      defs,
      form([
        ['attr__model', '  '],
        ['attr__fuel', ''],
        ['attr__langs__present', '1'],
        ['attr__gotra', ''],
        ['attr__ac__present', '1'],
      ]),
    )
    expect(missing).toEqual(['model', 'fuel', 'langs'])
  })

  it('passes once each required question is answered', () => {
    const missing = missingRequiredAttributes(
      defs,
      form([
        ['attr__model', 'Toyota Innova'],
        ['attr__fuel', 'Diesel'],
        ['attr__langs__present', '1'],
        ['attr__langs', 'Hindi'],
      ]),
    )
    expect(missing).toEqual([])
  })

  it('ignores questions the form never rendered (another category)', () => {
    expect(missingRequiredAttributes(defs, form([]))).toEqual([])
  })
})
