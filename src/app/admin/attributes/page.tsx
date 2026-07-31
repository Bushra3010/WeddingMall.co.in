import { AttributeDefinitionForm } from '@/components/admin/attribute-definition-form'
import { EmptyState } from '@/components/ui/states'
import { NOINDEX } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/server/policies/require'
import { listAttributes } from '@/server/dal/taxonomy'

export const metadata = { title: 'Attributes', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function AdminAttributesPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [{ data: categories }, attributes] = await Promise.all([
    supabase.from('categories').select('id, name').order('sort_order').order('name'),
    listAttributes(),
  ])

  const byCategory = new Map((categories ?? []).map((c) => [c.id, c.name]))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Category attributes</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Attributes define the category-specific questions vendors answer and the filters couples
          search with. Marking one filterable adds it to the search sidebar.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div>
          {attributes.length === 0 ? (
            <EmptyState title="No attributes yet" description="Add the first one to get started." />
          ) : (
            <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
              <table className="w-full min-w-[42rem] text-sm">
                <caption className="sr-only">Category attributes</caption>
                <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Label
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Code
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Filter
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-sand-200 divide-y bg-white">
                  {attributes.map((attribute) => (
                    <tr key={attribute.id}>
                      <td className="text-sand-700 px-4 py-3">
                        {byCategory.get(attribute.categoryId) ?? '—'}
                      </td>
                      <td className="text-sand-900 px-4 py-3 font-medium">{attribute.label}</td>
                      <td className="text-sand-600 px-4 py-3 font-mono text-xs">
                        {attribute.code}
                      </td>
                      <td className="text-sand-700 px-4 py-3">{attribute.inputType}</td>
                      <td className="px-4 py-3">
                        {attribute.filterable ? (
                          <span className="text-[var(--color-success)]">yes</span>
                        ) : (
                          <span className="text-sand-500">no</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <AttributeDefinitionForm categories={categories ?? []} />
      </div>
    </div>
  )
}
