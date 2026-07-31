import type { Metadata } from 'next'

import { env } from '@/lib/env'
import { site } from '@/lib/site'

export function absoluteUrl(path = '/'): string {
  return new URL(path, env.NEXT_PUBLIC_APP_URL).toString()
}

interface MetaInput {
  title: string
  description?: string
  path?: string
  image?: string
  noindex?: boolean
  type?: 'website' | 'article' | 'profile'
}

export function buildMetadata({
  title,
  description = site.description,
  path = '/',
  image,
  noindex = false,
  type = 'website',
}: MetaInput): Metadata {
  const url = absoluteUrl(path)
  const ogImage = image ?? absoluteUrl('/og-default.png')

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: site.name,
      type,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

/** Dashboards, auth, and preview routes must never be indexed (PRD 11.1). */
export const NOINDEX: Metadata = { robots: { index: false, follow: false } }

export interface Crumb {
  name: string
  path: string
}

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  }
}

interface VendorSchemaInput {
  name: string
  slug: string
  description?: string | null
  city?: string | null
  image?: string | null
  ratingAverage: number
  ratingCount: number
}

/**
 * AggregateRating is emitted only when approved reviews are actually visible on
 * the page (PRD 11.2). Never synthesise it.
 */
export function vendorSchema(vendor: VendorSchemaInput) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: vendor.name,
    url: absoluteUrl(`/vendor/${vendor.slug}`),
  }

  if (vendor.description) schema.description = vendor.description
  if (vendor.image) schema.image = vendor.image
  if (vendor.city) {
    schema.address = { '@type': 'PostalAddress', addressLocality: vendor.city }
  }
  if (vendor.ratingCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: vendor.ratingAverage,
      reviewCount: vendor.ratingCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return schema
}
