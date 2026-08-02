import Image from 'next/image'
import Link from 'next/link'

import { NewsletterForm } from '@/components/public/newsletter-form'
import { site } from '@/lib/site'
import { listCategories, listCities } from '@/server/dal/taxonomy'

/**
 * Footer (PRD 6.1.11) — SEO links to real category and city routes, plus a
 * newsletter signup that actually records consent.
 *
 * Links are generated from taxonomy rows, never hard-coded, so the footer
 * cannot drift from what the site publishes.
 */
export async function SiteFooter() {
  const [categories, cities] = await Promise.all([listCategories(6), listCities(6)])

  return (
    <footer className="bg-brand-950 mt-24 text-white">
      <div className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            {/*
              The footer sits on the dark maroon panel, so the logo takes the
              same flat-white treatment the header uses over the hero. `alt`
              carries the name, because the artwork *is* the wordmark.
            */}
            <Image
              src="/logo-wordmark.png"
              alt={site.name}
              width={390}
              height={93}
              className="h-9 w-auto brightness-0 invert"
            />
            <p className="mt-3 max-w-sm text-sm text-white/65">{site.tagline}</p>

            <div className="mt-8 max-w-sm">
              <h2 className="text-sm font-semibold">Planning a wedding?</h2>
              <p className="mt-1 mb-4 text-sm text-white/65">
                Occasional guides on budgeting, timelines, and choosing vendors.
              </p>
              <NewsletterForm />
            </div>
          </div>

          <nav aria-labelledby="footer-categories">
            <h2 id="footer-categories" className="text-sm font-semibold">
              Popular categories
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-white/65">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/vendors/${category.slug}`}
                    className="transition-colors hover:text-white"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-cities">
            <h2 id="footer-cities" className="text-sm font-semibold">
              Popular cities
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-white/65">
              {cities.map((city) => (
                <li key={city.id}>
                  <Link
                    href={`/vendors?city=${city.slug}`}
                    className="transition-colors hover:text-white"
                  >
                    Vendors in {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-company">
            <h2 id="footer-company" className="text-sm font-semibold">
              Company
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-white/65">
              {[
                ['/about', 'About'],
                ['/contact', 'Contact'],
                ['/help', 'Help centre'],
                ['/blog', 'Wedding ideas'],
                ['/vendor/join', 'List your business'],
                ['/privacy', 'Privacy'],
                ['/terms', 'Terms'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="transition-colors hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p>
            Questions?{' '}
            <a href={`mailto:${site.supportEmail}`} className="underline hover:text-white">
              {site.supportEmail}
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
