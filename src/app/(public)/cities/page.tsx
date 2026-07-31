import Link from 'next/link'

import { EmptyState } from '@/components/ui/states'
import { buildMetadata } from '@/lib/seo'
import { listCities } from '@/server/dal/taxonomy'

export const metadata = buildMetadata({
  title: 'Wedding vendors by city',
  description: 'Find verified wedding professionals in the cities we currently cover.',
  path: '/cities',
})

export const revalidate = 3600

export default async function CitiesPage() {
  const cities = await listCities(200)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-sand-900 text-3xl">Cities</h1>
      <p className="text-sand-600 mt-2 max-w-prose text-sm">
        We are live in these cities. More are added as vendors are verified.
      </p>

      {cities.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No cities published yet" />
        </div>
      ) : (
        <ul className="mt-8 flex flex-wrap gap-2">
          {cities.map((city) => (
            <li key={city.id}>
              <Link
                href={`/vendors?city=${city.slug}`}
                className="border-sand-300 text-sand-700 hover:border-brand-300 hover:text-brand-700 inline-flex rounded-full border bg-white px-4 py-2 text-sm"
              >
                {city.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
