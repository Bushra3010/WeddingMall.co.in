import { NewCategoryForm } from '@/components/admin/taxonomy-forms'
import { EmptyState } from '@/components/ui/states'
import { NOINDEX } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/server/policies/require'

export const metadata = { title: 'Categories', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Includes inactive rows: the taxonomy read policy grants admins the full set.
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug, active, sort_order, parent_id')
    .order('sort_order')
    .order('name')

  const categories = data ?? []
  const parents = categories.filter((c) => !c.parent_id).map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Categories</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Categories drive search, the homepage, and every /vendors URL.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {categories.length === 0 ? (
            <EmptyState title="No categories yet" description="Add the first one to get started." />
          ) : (
            <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
              <table className="w-full min-w-[34rem] text-sm">
                <caption className="sr-only">All categories</caption>
                <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Slug
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Order
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Visible
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-sand-200 divide-y bg-white">
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td className="text-sand-900 px-4 py-3 font-medium">
                        {category.parent_id ? <span className="text-sand-400">— </span> : null}
                        {category.name}
                      </td>
                      <td className="text-sand-600 px-4 py-3 font-mono text-xs">{category.slug}</td>
                      <td className="text-sand-700 px-4 py-3">{category.sort_order}</td>
                      <td className="px-4 py-3">
                        {category.active ? (
                          <span className="text-[var(--color-success)]">yes</span>
                        ) : (
                          <span className="text-sand-500">hidden</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <NewCategoryForm parents={parents} />
      </div>
    </div>
  )
}
