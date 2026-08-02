import Link from 'next/link'

import { PageForm } from '@/components/admin/content-forms'
import { formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { requireElevatedAdmin } from '@/server/policies/require'

export const metadata = { title: 'Content', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>
}) {
  await requireElevatedAdmin('cms.publish')

  const { slug } = await searchParams
  const supabase = await createClient()

  const { data: pages } = await supabase
    .from('pages')
    .select('id, slug, title, status, body, seo_description, updated_at')
    .order('slug')

  const editing = slug ? (pages ?? []).find((p) => p.slug === slug) : undefined

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Content</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Static pages. Bodies render as structured text rather than HTML — see the hint on the body
          field. A page set to draft returns 404 rather than an empty shell, because an empty shell
          looks like the policy.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
        <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
          <table className="w-full min-w-[26rem] text-sm">
            <caption className="sr-only">Static pages</caption>
            <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Page
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Updated
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-sand-200 divide-y bg-white">
              {(pages ?? []).map((page) => (
                <tr key={page.id} className={cn(page.slug === slug && 'bg-brand-50')}>
                  <td className="px-4 py-3">
                    <span className="text-sand-900 font-medium">{page.title}</span>
                    <span className="text-sand-400 block font-mono text-xs">/{page.slug}</span>
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3',
                      page.status === 'published' ? 'text-[var(--color-success)]' : 'text-sand-500',
                    )}
                  >
                    {page.status}
                  </td>
                  <td className="text-sand-600 px-4 py-3 whitespace-nowrap">
                    {formatRelative(page.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/content?slug=${page.slug}`}
                      className="text-brand-700 text-sm hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
          <h2 className="font-display text-sand-900 mb-4 text-lg">
            {editing ? `Edit ${editing.title}` : 'New page'}
          </h2>
          <PageForm
            key={editing?.slug ?? 'new'}
            page={
              editing
                ? {
                    slug: editing.slug,
                    title: editing.title,
                    body: editing.body,
                    seoDescription: editing.seo_description,
                    published: editing.status === 'published',
                  }
                : undefined
            }
          />
          {editing ? (
            <Link
              href="/admin/content"
              className="text-sand-600 mt-3 inline-block text-sm hover:underline"
            >
              Cancel and start a new page
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
