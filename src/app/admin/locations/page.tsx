import { MilestonePlaceholder } from '@/components/shared/milestone-placeholder'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Locations', ...NOINDEX }

export default function AdminLocationsPage() {
  return (
    <MilestonePlaceholder
      title={'Locations'}
      milestone={'Milestone 2'}
      prdSection={'6.11'}
      description={'Countries, states, cities, areas, coordinates, and aliases.'}
    />
  )
}
