import Image from 'next/image'
import Link from 'next/link'

import { EmptyState } from '@/components/ui/states'
import { buildMetadata } from '@/lib/seo'
import { storagePublicUrl } from '@/lib/supabase/storage'
import { listPosts } from '@/server/dal/cms'

export const metadata = buildMetadata({
  title: 'Ideas and guides',
  description: 'Planning guides, real weddings, and vendor advice.',
  path: '/blog',
})

// Published content changes rarely; moderation revalidates it.
export const revalidate = 600

export default async function BlogIndexPage() {
  const posts = await listPosts()

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header>
        <h1 className="font-display text-sand-900 text-3xl sm:text-4xl">Ideas and guides</h1>
        <p className="text-sand-600 mt-2 max-w-prose">
          Planning guides, real weddings, and advice from the professionals on WeddingMall.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="mt-10">
          {/*
            An honest empty state rather than placeholder articles. Inventing
            editorial content would put words in the marketplace's mouth.
          */}
          <EmptyState
            title="Nothing published yet"
            description="Guides and real weddings will appear here as our editors publish them."
            action={{ label: 'Browse vendors', href: '/vendors' }}
          />
        </div>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const cover = storagePublicUrl('vendor-media', post.coverPath)
            return (
              <li
                key={post.slug}
                className="border-sand-200 overflow-hidden rounded-[var(--radius-card)] border bg-white"
              >
                <Link href={`/blog/${post.slug}`} className="group block">
                  {cover ? (
                    <div className="bg-sand-100 relative aspect-16/9">
                      <Image
                        src={cover}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="p-4">
                    {post.category ? (
                      <p className="text-brand-700 text-xs font-medium tracking-wide uppercase">
                        {post.category}
                      </p>
                    ) : null}
                    <h2 className="text-sand-900 group-hover:text-brand-700 mt-1 font-medium transition-colors">
                      {post.title}
                    </h2>
                    {post.excerpt ? (
                      <p className="text-sand-600 mt-1 line-clamp-3 text-sm">{post.excerpt}</p>
                    ) : null}
                    {post.publishedAt ? (
                      <p className="text-sand-400 mt-2 text-xs">
                        {new Date(post.publishedAt).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
