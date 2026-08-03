import { CityRow } from '@/components/admin/city-rows'
import { StateToggle } from '@/components/admin/state-toggle'
import { NewCityForm } from '@/components/admin/taxonomy-forms'
import { EmptyState } from '@/components/ui/states'
import { NOINDEX } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { requireElevatedAdmin } from '@/server/policies/require'

export const metadata = { title: 'Locations', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function AdminLocationsPage() {
  await requireElevatedAdmin()
  const supabase = await createClient()

  const [{ data: cities }, { data: states }] = await Promise.all([
    supabase
      .from('cities')
      .select('id, name, slug, active, sort_order, state_id, states(name)')
      .order('sort_order')
      .order('name'),
    supabase.from('states').select('id, name, slug, active').order('name'),
  ])

  // Computed once and shared by every row's editor rather than per row.
  const activeStates = (states ?? []).filter((row) => row.active)

  // Cities per state, so an admin can see which states are worth activating
  // and which would show up empty.
  const cityCounts = new Map<string, number>()
  for (const city of cities ?? []) {
    if (!city.state_id) continue
    cityCounts.set(city.state_id, (cityCounts.get(city.state_id) ?? 0) + 1)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Locations</h1>
        <p className="text-sand-600 mt-1 text-sm">
          Cities appear in search filters and in every category × city landing page.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {(cities ?? []).length === 0 ? (
            <EmptyState title="No cities yet" description="Add the first one to get started." />
          ) : (
            <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
              <table className="w-full min-w-[34rem] text-sm">
                <caption className="sr-only">All cities</caption>
                <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      City
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      State
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Slug
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Visible
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-sand-200 divide-y bg-white">
                  {(cities ?? []).map((city) => (
                    <CityRow key={city.id} city={city} states={activeStates} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <NewCityForm states={activeStates} />
      </div>

      <section aria-labelledby="admin-states" className="space-y-3">
        <div>
          <h2 id="admin-states" className="font-display text-sand-900 text-lg">
            States and union territories
          </h2>
          <p className="text-sand-600 mt-1 max-w-prose text-sm">
            All 36 are available. A state stays hidden until it has cities worth showing — an empty
            state in a public filter is a dead end for someone browsing. Only visible states can be
            chosen when adding a city.
          </p>
        </div>

        <div className="border-sand-200 overflow-x-auto rounded-[var(--radius-card)] border">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">States and union territories</caption>
            <thead className="bg-sand-50 text-sand-600 text-left text-xs tracking-wide uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  State
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Cities
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  In public filters
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-sand-200 divide-y bg-white">
              {(states ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="text-sand-900 px-4 py-3 font-medium">{row.name}</td>
                  <td className="text-sand-700 px-4 py-3">{cityCounts.get(row.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    {row.active ? (
                      <span className="text-[var(--color-success)]">visible</span>
                    ) : (
                      <span className="text-sand-500">hidden</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StateToggle id={row.id} name={row.name} active={row.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
