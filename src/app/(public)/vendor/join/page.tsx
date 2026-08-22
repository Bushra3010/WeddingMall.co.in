import Link from 'next/link'
import { BadgeCheck, LineChart, MessageSquareText } from 'lucide-react'

import { CopyLinkButton } from '@/components/vendor/copy-link-button'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'List your wedding business',
  description:
    'Showcase your work, receive qualified enquiries, and grow your wedding business. Free to list.',
  path: '/vendor/join',
})

export const dynamic = 'force-dynamic'

export default function VendorJoinPage() {
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://weddingmall.co.in'}/vendor/join`

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
        {/* Left — benefits + share link */}
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

          {/* Shareable link */}
          <div className="border-sand-200 mt-8 rounded-[var(--radius-card)] border bg-white p-4">
            <p className="text-sand-800 text-sm font-medium">Share this page with a vendor</p>
            <p className="text-sand-500 mt-1 text-xs">
              Copy the link below and send it to vendors who want to list their business.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="border-sand-300 flex-1 rounded-lg border bg-sand-50 px-3 py-2 text-xs"
              />
              <CopyLinkButton url={shareUrl} />
            </div>
          </div>
        </div>

        {/* Right — simple sign up / sign in */}
        <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-6 sm:p-8">
          <h2 className="font-display text-sand-900 text-xl sm:text-2xl">
            List your business
          </h2>
          <p className="text-sand-600 mt-1 text-sm">
            Create your account and set up your listing in minutes.
          </p>

          <div className="mt-6 space-y-3">
            <Link
              href="/auth/sign-up?next=/vendor-dashboard/list"
              className="bg-brand-600 hover:bg-brand-700 flex w-full items-center justify-center rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors"
            >
              Create an account
            </Link>
            <Link
              href="/auth/sign-in?next=/vendor-dashboard/list"
              className="border-sand-300 flex w-full items-center justify-center rounded-lg border bg-white px-6 py-3 text-sm font-medium text-sand-800 hover:bg-sand-50 transition-colors"
            >
              I already have an account
            </Link>
          </div>

          <p className="text-sand-500 mt-5 text-xs text-center">
            Nothing is published until you submit for review and our team approves it.
          </p>
        </div>
      </div>
    </div>
  )
}
