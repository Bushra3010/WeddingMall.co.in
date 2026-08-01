import { WeddingProfileForm } from '@/components/customer/wedding-profile-form'
import { NOINDEX } from '@/lib/seo'
import { getWeddingProfile } from '@/server/dal/enquiries'
import { listCategories, listCities } from '@/server/dal/taxonomy'

export const metadata = { title: 'Wedding profile', ...NOINDEX }
export const dynamic = 'force-dynamic'

export default async function WeddingProfilePage() {
  const [profile, cities, categories] = await Promise.all([
    getWeddingProfile(),
    listCities(60),
    listCategories(40),
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">Wedding profile</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          Fill this in once and we can prefill your enquiries. Only you can see it — vendors see
          only what you choose to send them.
        </p>
      </header>

      <WeddingProfileForm profile={profile} cities={cities} categories={categories} />
    </div>
  )
}
