import { describe, expect, it } from 'vitest'

import { toCsv } from '@/lib/csv'

describe('toCsv', () => {
  it('quotes values containing a delimiter, quote, or newline', () => {
    const csv = toCsv([{ a: 'plain', b: 'has,comma', c: 'has"quote', d: 'has\nnewline' }])
    expect(csv).toContain('plain')
    expect(csv).toContain('"has,comma"')
    expect(csv).toContain('"has""quote"')
    expect(csv).toContain('"has\nnewline"')
  })

  /*
   * The one that matters. Excel and Google Sheets execute a cell beginning
   * `=`, `+`, `-`, or `@` as a formula on open, so a vendor could name their
   * business `=HYPERLINK(...)` and have an admin's export phone home when they
   * double-click it.
   */
  it.each([['=HYPERLINK("http://evil.test","click")'], ['+1+1'], ['-2+3'], ['@SUM(A1:A9)']])(
    'neutralises the formula %s',
    (value) => {
      const csv = toCsv([{ name: value }])
      const cell = csv.split('\r\n')[1]
      expect(cell.startsWith("'") || cell.startsWith('"\'')).toBe(true)
    },
  )

  it('leaves an ordinary value untouched', () => {
    expect(toCsv([{ name: 'Marigold Courtyard' }])).toBe('name\r\nMarigold Courtyard\r\n')
  })

  it('emits a header row even when there are no rows, given columns', () => {
    expect(toCsv([], ['a', 'b'])).toBe('a,b\n')
  })

  it('returns empty output for no rows and no columns', () => {
    expect(toCsv([])).toBe('')
  })

  it('renders null and undefined as empty cells rather than the words', () => {
    expect(toCsv([{ a: null, b: undefined, c: 0 }])).toBe('a,b,c\r\n,,0\r\n')
  })
})
