import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BadgeCheck, LineChart, MessageSquareText } from 'lucide-react'

import { RegisterVendorForm } from '@/components/vendor/register-vendor-form'
import { buildMetadata } from '@/lib/seo'
import { getActor } from '@/server/dal/actor'
import { getMyVendors } from '@/server/dal/vendor-workspace'
import { listCategories, listCities } from '@/server/dal/taxonomy'

export const metadata = buildMetadata({
  title: 'List your wedding business',
  description:
    'Showcase your work, receive qualified enquiries, and grow your wedding business. Free to list.',
  path: '/vendor/join',
})

export const dynamic = 'force-dynamic'

export default async function VendorJoinPage() {
  const actor = await getActor()

  // Already running a business here — go straight to the workspace.
  if (actor.userId) {
    const mine = await getMyVendors()
    if (mine.length > 0) redirect('/vendor-dashboard')
  }

  const [categories, cities] = await Promise.all([listCategories(40), listCities(60)])

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div>
          <h1 className="font-display text-sand-900 text-3xl sm:text-4xl">
            Grow your wedding business
          </h1>
          <p className="text-sand-700 mt-3 max-w-prose">
            Showcase your work, receive enquiries from couples who are actively planning, and manage
            every conversation in one place.
          </p>

          <ul className="mt-8 space-y-5">
            {[
              {
                icon: MessageSquareText,
                title: 'Qualified enquiries',
                body: 'Couples share their date, budget, and requirements before they contact you.',
              },
              {
                icon: BadgeCheck,
                title: 'A verified badge',
                body: 'Submit your business documents once. Verified listings earn more trust.',
              },
              {
                icon: LineChart,
                title: 'Know what is working',
                body: 'See profile views, shortlist adds, and how quickly you respond.',
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <item.icon aria-hidden="true" className="text-brand-600 mt-0.5 size-5 shrink-0" />
                <div>
                  <h2 className="text-sand-900 font-medium">{item.title}</h2>
                  <p className="text-sand-600 text-sm">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Shareable link for vendors */}
          <div className="border-sand-200 mt-8 rounded-[var(--radius-card)] border bg-white p-4">
            <p className="text-sand-800 text-sm font-medium">Share this page with a vendor</p>
            <p className="text-sand-500 mt-1 text-xs">
              Copy the link below and send it to vendors who want to list their business.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                value={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://weddingmall.co.in'}/vendor/join`}
                className="border-sand-300 flex-1 rounded-lg border bg-sand-50 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://weddingmall.co.in'}/vendor/join`,
                  )
                }}
                className="border-sand-300 rounded-lg border bg-white px-3 py-2 text-xs font-medium hover:bg-sand-50"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-6">
          {actor.userId ? (
            <>
              <h2 className="font-display text-sand-900 text-xl">List your business</h2>
              <p className="text-sand-600 mt-1 text-sm">
                Create your business profile and start receiving enquiries.
              </p>
              <div className="mt-5">
                <RegisterVendorForm categories={categories} cities={cities} />
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-sand-900 text-xl">Create your account &amp; business</h2>
              <p className="text-sand-600 mt-1 text-sm">
                Create your account and business profile in one go. It takes about 2 minutes.
              </p>
              <div className="mt-5">
                <RegisterVendorForm categories={categories} cities={cities} />
              </div>
              <p className="text-sand-500 mt-4 text-xs">
                Already have an account?{' '}
                <Link
                  href="/auth/sign-in?next=/vendor-dashboard"
                  className="text-brand-700 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
