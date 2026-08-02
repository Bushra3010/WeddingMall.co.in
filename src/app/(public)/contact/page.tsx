import { Mail, MessageSquareText, Store } from 'lucide-react'
import Link from 'next/link'

import { Prose } from '@/components/public/prose'
import { buildMetadata } from '@/lib/seo'
import { site } from '@/lib/site'
import { getPage } from '@/server/dal/cms'

export const revalidate = 3600

export const metadata = buildMetadata({
  title: 'Contact us',
  description: `Get in touch with the ${site.name} team.`,
  path: '/contact',
})

/**
 * Contact routes rather than a form.
 *
 * PRD 10.3 requires rate limiting and risk-based CAPTCHA on contact forms;
 * neither the CAPTCHA nor an SMTP provider exists yet, so a form here would
 * either drop messages silently or become a spam relay. Pointing people at
 * routes that do work is the honest interim.
 */
export default async function ContactPage() {
  const page = await getPage('contact')

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-sand-900 text-3xl sm:text-4xl">Contact us</h1>
      <Prose body={page?.body ?? null} />

      <ul className="mt-8 space-y-3">
        <li className="border-sand-200 flex gap-3 rounded-[var(--radius-card)] border bg-white p-4">
          <MessageSquareText aria-hidden="true" className="text-brand-600 mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sand-900 font-medium">Question about an enquiry?</p>
            <p className="text-sand-600 text-sm">
              Message the vendor directly in{' '}
              <Link href="/account/enquiries" className="text-brand-700 hover:underline">
                your enquiries
              </Link>
              — the thread stays with the booking.
            </p>
          </div>
        </li>
        <li className="border-sand-200 flex gap-3 rounded-[var(--radius-card)] border bg-white p-4">
          <Store aria-hidden="true" className="text-brand-600 mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sand-900 font-medium">Want to list your business?</p>
            <p className="text-sand-600 text-sm">
              Start at{' '}
              <Link href="/vendor/join" className="text-brand-700 hover:underline">
                list your business
              </Link>
              . Listing is free.
            </p>
          </div>
        </li>
        <li className="border-sand-200 flex gap-3 rounded-[var(--radius-card)] border bg-white p-4">
          <Mail aria-hidden="true" className="text-brand-600 mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sand-900 font-medium">Anything else</p>
            <p className="text-sand-600 text-sm">
              Email{' '}
              <a href={`mailto:${site.supportEmail}`} className="text-brand-700 hover:underline">
                {site.supportEmail}
              </a>
              .
            </p>
          </div>
        </li>
      </ul>
    </div>
  )
}
