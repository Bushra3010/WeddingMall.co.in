import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { buildMetadata } from '@/lib/seo'
import { storagePublicUrl } from '@/lib/supabase/storage'
import { getPost } from '@/server/dal/cms'

export const revalidate = 600

export async function generateMetadata({ params }: { params: Promise<{ postSlug: string }> }) {
  const { postSlug } = await params
  const post = await getPost(postSlug)
  if (!post) return buildMetadata({ title: 'Not found', path: `/blog/${postSlug}` })

  return buildMetadata({
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    path: `/blog/${post.slug}`,
  })
}

export default async function BlogPostPage({ params }: { params: Promise<{ postSlug: string }> }) {
  const { postSlug } = await params
  const post = await getPost(postSlug)
  if (!post) notFound()

  const cover = storagePublicUrl('vendor-media', post.coverPath)

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sand-500 text-sm">
        <Link href="/blog" className="hover:underline">
          Ideas and guides
        </Link>
      </nav>

      <h1 className="font-display text-sand-900 mt-3 text-3xl sm:text-4xl">{post.title}</h1>
      {post.publishedAt ? (
        <p className="text-sand-500 mt-2 text-sm">
          <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString()}</time>
        </p>
      ) : null}

      {cover ? (
        <div className="bg-sand-100 relative mt-6 aspect-16/9 overflow-hidden rounded-[var(--radius-card)]">
          <Image
            src={cover}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      ) : null}

      {/*
        Rendered as plain text paragraphs, not `dangerouslySetInnerHTML`.
        Editor-supplied HTML would need sanitising first (PRD 12), and shipping
        an unsanitised sink into a public page to save a formatting feature is
        not a trade worth making.
      */}
      <div className="mt-8 space-y-4">
        {(post.body ?? '').split(/\n{2,}/).map((paragraph, index) => (
          <p key={index} className="text-sand-700 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  )
}
