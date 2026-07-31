import Link from 'next/link'

import { EmptyState } from '@/components/ui/states'
import { buildMetadata } from '@/lib/seo'
import { listCategories } from '@/server/dal/taxonomy'

export const metadata = buildMetadata({
  title: 'Wedding vendor categories',
  description:
    'Every kind of wedding professional on the platform — venues, photographers, makeup artists, caterers, and more.',
  path: '/categories',
})

export const revalidate = 3600

export default async function CategoriesPage() {
  const categories = await listCategories(60)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-sand-900 text-3xl">Categories</h1>
      <p className="text-sand-600 mt-2 max-w-prose text-sm">
        Browse every kind of wedding professional on the platform.
      </p>

      {categories.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No categories published yet" />
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/vendors/${category.slug}`}
                className="border-sand-200 hover:border-brand-300 flex h-full flex-col rounded-[var(--radius-card)] border bg-white p-4"
              >
                <span className="text-sand-900 font-medium">{category.name}</span>
                {category.description ? (
                  <span className="text-sand-600 mt-1 text-sm">{category.description}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
