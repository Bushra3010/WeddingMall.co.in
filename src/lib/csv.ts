/**
 * Minimal RFC 4180 CSV writer.
 *
 * Hand-rolled rather than a dependency because the only hard parts are quoting
 * and injection, and both are a few lines.
 */

/**
 * Neutralises spreadsheet formula injection.
 *
 * A cell beginning `=`, `+`, `-`, or `@` is executed as a formula by Excel and
 * Google Sheets on open. A vendor could name their business `=HYPERLINK(...)`
 * and have an admin's export exfiltrate the row when they double-click it.
 * Prefixing a single quote is the standard neutralisation and is invisible in
 * the rendered cell.
 */
function neutralise(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = neutralise(String(value))
  // Quote when the value contains a delimiter, a quote, or a newline.
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return columns ? `${columns.join(',')}\n` : ''
  const keys = columns ?? Object.keys(rows[0])
  const header = keys.map(cell).join(',')
  const body = rows.map((row) => keys.map((key) => cell(row[key])).join(','))
  // CRLF per RFC 4180; Excel is happier with it and every other reader copes.
  return [header, ...body].join('\r\n') + '\r\n'
}
