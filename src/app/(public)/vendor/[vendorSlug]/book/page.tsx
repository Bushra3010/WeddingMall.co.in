import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BookingForm } from '@/components/customer/booking-form'
import { buttonVariants } from '@/components/ui/button'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { getActor, getProfile } from '@/server/dal/actor'
import { getPublicVendor } from '@/server/dal/vendors'

export const metadata = { title: 'Book now', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function BookPage({ params }: { params: Promise<{ vendorSlug: string }> }) {
  const { vendorSlug } = await params
  const vendor = await getPublicVendor(vendorSlug)
  if (!vendor) notFound()

  // No sign-in wall: a guest books with name and phone, and gets an
  // anonymous account behind the scenes (see `services/guest.ts`).
  const actor = await getActor()
  const profile = actor.userId ? await getProfile() : null

  const primaryCategory = vendor.categories.find((row) => row.is_primary)?.categories

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sand-500 text-xs">
        <Link href={`/vendor/${vendor.slug}`} className="hover:text-brand-700">
          {vendor.display_name}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-sand-700">Book now</span>
      </nav>

      <h1 className="font-display text-sand-900 mt-3 text-3xl">Book {vendor.display_name}</h1>
      <p className="text-sand-600 mt-2 text-sm">
        Pick your date and book directly. No quote, no payment, no account needed.
      </p>

      <div className="border-sand-200 mt-8 rounded-[var(--radius-card)] border bg-white p-6">
        <BookingForm
          vendorId={vendor.id}
          vendorName={vendor.display_name}
          categoryId={primaryCategory?.id ?? null}
          cityId={vendor.primary_city_id}
          defaultName={profile?.full_name}
          defaultPhone={profile?.phone}
          signedIn={Boolean(actor.userId)}
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
