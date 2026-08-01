import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { EnquiryForm } from '@/components/customer/enquiry-form'
import { buttonVariants } from '@/components/ui/button'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { getActor } from '@/server/dal/actor'
import { getPublicVendor } from '@/server/dal/vendors'

export const metadata = { title: 'Request a quote', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function EnquirePage({ params }: { params: Promise<{ vendorSlug: string }> }) {
  const { vendorSlug } = await params
  const vendor = await getPublicVendor(vendorSlug)
  if (!vendor) notFound()

  const actor = await getActor()
  if (!actor.userId) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(`/vendor/${vendorSlug}/enquire`)}`)
  }

  const primaryCategory = vendor.categories.find((row) => row.is_primary)?.categories

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sand-500 text-xs">
        <Link href={`/vendor/${vendor.slug}`} className="hover:text-brand-700">
          {vendor.display_name}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-sand-700">Request a quote</span>
      </nav>

      <h1 className="font-display text-sand-900 mt-3 text-3xl">
        Tell {vendor.display_name} what you need
      </h1>
      <p className="text-sand-600 mt-2 text-sm">
        They will reply in a private thread in your account. Nothing is shared publicly.
      </p>

      <div className="border-sand-200 mt-8 rounded-[var(--radius-card)] border bg-white p-6">
        <EnquiryForm
          vendorId={vendor.id}
          vendorName={vendor.display_name}
          categoryId={primaryCategory?.id ?? null}
          cityId={vendor.primary_city_id}
        />
      </div>

      <Link
        href={`/vendor/${vendor.slug}`}
        className={cn(buttonVariants({ variant: 'ghost' }), 'mt-4')}
      >
        Back to profile
      </Link>
    </div>
  )
}
