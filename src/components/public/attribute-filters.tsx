import Link from 'next/link'

import { ATTRIBUTE_PREFIX, buildSearchUrl, type SearchFilters } from '@/features/search/filters'
import { cn } from '@/lib/utils'
import type { AttributeDefinition } from '@/server/dal/taxonomy'

/**
 * Category-specific filters (PRD 6.2), rendered from attribute definitions
 * rather than hard-coded per category.
 *
 * Each option is a plain link that toggles itself in the URL, so filtering
 * works without client JavaScript and every filtered view is shareable
 * (PRD 6.2 — "filters live in URL query parameters").
 */
export function AttributeFilters({
  attributes,
  filters,
  basePath,
}: {
  attributes: AttributeDefinition[]
  filters: SearchFilters
  basePath: string
}) {
  const choiceAttributes = attributes.filter(
    (attribute) =>
      (attribute.inputType === 'select' ||
        attribute.inputType === 'multiselect' ||
        attribute.inputType === 'boolean') &&
      (attribute.options.length > 0 || attribute.inputType === 'boolean'),
  )

  if (choiceAttributes.length === 0) return null

  function toggle(code: string, value: string): string {
    const current = filters.attributes[code] ?? []
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]

    const attributes = { ...filters.attributes }
    if (next.length === 0) delete attributes[code]
    else attributes[code] = next

    return buildSearchUrl({ ...filters, attributes, page: 1 }, basePath)
  }

  return (
    <div className="space-y-5">
      {choiceAttributes.map((attribute) => {
        const options = attribute.inputType === 'boolean' ? ['true'] : attribute.options
        const active = filters.attributes[attribute.code] ?? []

        return (
          <fieldset key={attribute.id}>
            <legend className="text-sand-900 text-sm font-medium">{attribute.label}</legend>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {options.map((option) => {
                const isActive = active.includes(option)
                const label = attribute.inputType === 'boolean' ? attribute.label : option
                return (
                  <li key={option}>
                    <Link
                      href={toggle(attribute.code, option)}
                      aria-pressed={isActive}
                      className={cn(
                        'inline-flex rounded-full px-3 py-1.5 text-xs transition-colors',
                        isActive
                          ? 'bg-brand-700 text-white'
                          : 'border-sand-300 text-sand-700 hover:border-brand-300 border bg-white',
                      )}
                    >
                      {attribute.inputType === 'boolean' ? `Only ${label.toLowerCase()}` : label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        )
      })}

      {Object.keys(filters.attributes).length > 0 ? (
        <Link
          href={buildSearchUrl({ ...filters, attributes: {}, page: 1 }, basePath)}
          className="text-brand-700 inline-block text-xs font-medium hover:underline"
        >
          Clear these filters
        </Link>
      ) : null}
    </div>
  )
}

export { ATTRIBUTE_PREFIX }
