import Link from 'next/link'

import { site } from '@/lib/site'
import { listCategories, listCities } from '@/server/dal/taxonomy'

/**
 * SEO footer with category and city links (PRD 6.1.11). Links are real
 * taxonomy rows, never a hard-coded list.
 */
export async function SiteFooter() {
  const [categories, cities] = await Promise.all([listCategories(8), listCities(8)])

  return (
    <footer className="border-sand-200 mt-16 border-t bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-brand-800 text-lg font-semibold">{site.name}</p>
            <p className="text-sand-600 mt-2 max-w-xs text-sm">{site.tagline}</p>
          </div>

          <nav aria-labelledby="footer-categories">
            <h2 id="footer-categories" className="text-sand-900 text-sm font-semibold">
              Popular categories
            </h2>
            <ul className="text-sand-600 mt-3 space-y-2 text-sm">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link href={`/vendors/${category.slug}`} className="hover:text-brand-700">
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-cities">
            <h2 id="footer-cities" className="text-sand-900 text-sm font-semibold">
              Popular cities
            </h2>
            <ul className="text-sand-600 mt-3 space-y-2 text-sm">
              {cities.map((city) => (
                <li key={city.id}>
                  <Link href={`/vendors?city=${city.slug}`} className="hover:text-brand-700">
                    Wedding vendors in {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-company">
            <h2 id="footer-company" className="text-sand-900 text-sm font-semibold">
              Company
            </h2>
            <ul className="text-sand-600 mt-3 space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-brand-700">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-brand-700">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-brand-700">
                  Help centre
                </Link>
              </li>
              <li>
                <Link href="/vendor/join" className="hover:text-brand-700">
                  List your business
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-brand-700">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-brand-700">
                  Terms
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <p className="border-sand-200 text-sand-500 mt-10 border-t pt-6 text-xs">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
