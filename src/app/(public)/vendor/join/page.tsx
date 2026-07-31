import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BadgeCheck, LineChart, MessageSquareText } from 'lucide-react'

import { CreateVendorForm } from '@/components/vendor/create-vendor-form'
import { buttonVariants } from '@/components/ui/button'
import { buildMetadata } from '@/lib/seo'
import { cn } from '@/lib/utils'
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
        </div>

        <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-6">
          {actor.userId ? (
            <>
              <h2 className="font-display text-sand-900 text-xl">Tell us about your business</h2>
              <p className="text-sand-600 mt-1 text-sm">
                Three quick details to get started. You can change all of them later.
              </p>
              <div className="mt-5">
                <CreateVendorForm categories={categories} cities={cities} />
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-sand-900 text-xl">Create your account</h2>
              <p className="text-sand-600 mt-1 text-sm">
                You need an account before you can list a business. It takes a minute.
              </p>
              <Link
                href="/auth/sign-up?next=%2Fvendor%2Fjoin"
                className={cn(buttonVariants({ size: 'lg' }), 'mt-5 w-full')}
              >
                Sign up
              </Link>
              <Link
                href="/auth/sign-in?next=%2Fvendor%2Fjoin"
                className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 w-full')}
              >
                I already have an account
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
