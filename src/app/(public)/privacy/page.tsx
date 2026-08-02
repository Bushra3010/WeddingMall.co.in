import { notFound } from 'next/navigation'

import { Prose } from '@/components/public/prose'
import { buildMetadata } from '@/lib/seo'
import { getPage } from '@/server/dal/cms'

const SLUG = 'privacy'

export const revalidate = 3600

export async function generateMetadata() {
  const page = await getPage(SLUG)
  return buildMetadata({
    title: page?.seoTitle ?? page?.title ?? 'Privacy policy',
    description: page?.seoDescription ?? undefined,
    path: `/${SLUG}`,
  })
}

/**
 * Editable in the CMS rather than hard-coded (PRD 6.11).
 *
 * 404s when the page is missing or still a draft. A legal page that silently
 * renders an empty shell is worse than one that is honestly absent — the shell
 * looks like the policy.
 */
export default async function StaticContentPage() {
  const page = await getPage(SLUG)
  if (!page) notFound()

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-sand-900 text-3xl sm:text-4xl">{page.title}</h1>
      {page.publishedAt ? (
        <p className="text-sand-500 mt-2 text-sm">
          Last updated{' '}
          <time dateTime={page.publishedAt}>{new Date(page.publishedAt).toLocaleDateString()}</time>
        </p>
      ) : null}
      <Prose body={page.body} />
    </article>
  )
}
