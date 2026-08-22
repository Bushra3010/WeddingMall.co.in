import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CheckCircle2 } from 'lucide-react'
import { NOINDEX } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import { getMyVendors } from '@/server/dal/vendor-workspace'

export const metadata = { title: 'Registration complete', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function VendorRegisterSuccessPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const actor = await getActor()

  if (!actor.userId) {
    redirect('/auth/sign-in?next=/vendor-dashboard/list')
  }

  const mine = await getMyVendors()
  if (mine.length > 0) {
    redirect('/vendor-dashboard/list')
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6 sm:py-20">
      <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-8 text-center">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="text-[var(--color-success)] size-8" />
        </div>

        <h1 className="font-display text-sand-900 text-2xl sm:text-3xl">
          Almost there!
        </h1>
        <p className="text-sand-600 mt-3 text-sm">
          We sent a confirmation link to your email. Verify your account to start
          setting up your business profile.
        </p>

        <div className="border-sand-200 mt-6 space-y-3 rounded-lg border p-4 text-left">
          <p className="text-sand-800 text-sm font-medium">What happens next:</p>
          <ol className="text-sand-600 space-y-2 text-xs sm:text-sm">
            <li className="flex gap-2">
              <span className="bg-brand-600 text-white flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">1</span>
              Verify your email address
            </li>
            <li className="flex gap-2">
              <span className="bg-brand-600 text-white flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">2</span>
              Complete your business profile
            </li>
            <li className="flex gap-2">
              <span className="bg-brand-600 text-white flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">3</span>
              Add your first package and photos
            </li>
            <li className="flex gap-2">
              <span className="bg-brand-600 text-white flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">4</span>
              Submit for review — goes live after approval
            </li>
          </ol>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/auth/sign-in?next=/vendor-dashboard/list"
            className="bg-brand-600 hover:bg-brand-700 inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Already verified? Continue
          </Link>
          <Link
            href="/vendor/join"
            className="text-sand-600 text-sm hover:text-sand-900 hover:underline"
          >
            Need to register a different business?
          </Link>
        </div>
      </div>
    </div>
  )
}
