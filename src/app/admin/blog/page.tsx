import Link from 'next/link'

import { PostForm } from '@/components/admin/content-forms'
import { EmptyState } from '@/components/ui/states'
import { formatRelative } from '@/lib/dates'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/server/policies/require'

export const metadata = { title: 'Blog', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function AdminBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>
}) {
  await requireAdmin('cms.publish')

  const { slug } = await searchParams
  const supabase = await createClient()

  const { data: posts } = await supabase
    .from('posts')
    .select(
      'id, slug, title, status, category, excerpt, body, seo_description, published_at, updated_at',
    )
    .order('updated_at', { ascending: false })

  const editing = slug ? (posts ?? []).find((p) => p.slug === slug) : undefined

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Blog</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Guides and real weddings. Published posts appear at /blog and are indexed; drafts are not
          reachable by URL.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
        <div>
          {(posts ?? []).length === 0 ? (
            <EmptyState
              title="No posts yet"
              description="Write the first one with the form beside this."
            />
          ) : (
            <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
              <table className="w-full min-w-[26rem] text-sm">
                <caption className="sr-only">Blog posts</caption>
                <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Post
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
                  {(posts ?? []).map((post) => (
                    <tr key={post.id} className={cn(post.slug === slug && 'bg-brand-50')}>
                      <td className="px-4 py-3">
                        <span className="text-sand-900 font-medium">{post.title}</span>
                        <span className="text-sand-400 block font-mono text-xs">
                          /blog/{post.slug}
                          {post.category ? ` · ${post.category}` : ''}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3',
                          post.status === 'published'
                            ? 'text-[var(--color-success)]'
                            : 'text-sand-500',
                        )}
                      >
                        {post.status}
                      </td>
                      <td className="text-sand-600 px-4 py-3 whitespace-nowrap">
                        {formatRelative(post.updated_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/blog?slug=${post.slug}`}
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
          )}
        </div>

        <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
          <h2 className="font-display text-sand-900 mb-4 text-lg">
            {editing ? `Edit ${editing.title}` : 'New post'}
          </h2>
          <PostForm
            key={editing?.slug ?? 'new'}
            post={
              editing
                ? {
                    slug: editing.slug,
                    title: editing.title,
                    body: editing.body,
                    excerpt: editing.excerpt,
                    category: editing.category,
                    seoDescription: editing.seo_description,
                    published: editing.status === 'published',
                  }
                : undefined
            }
          />
          {editing ? (
            <Link
              href="/admin/blog"
              className="text-sand-600 mt-3 inline-block text-sm hover:underline"
            >
              Cancel and start a new post
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
