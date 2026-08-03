import Link from 'next/link'
import { Heart, MessageSquareText, Star } from 'lucide-react'

import { EmptyState } from '@/components/ui/states'
import { createClient } from '@/lib/supabase/server'
import { getActor, getProfile } from '@/server/dal/actor'

export const metadata = { title: 'Your account' }

/**
 * Customer overview (PRD 6.5). Counts are read under the customer's own RLS
 * context, so a bug here cannot expose another customer's data.
 */
export default async function AccountPage() {
  const [actor, profile] = await Promise.all([getActor(), getProfile()])
  const supabase = await createClient()

  const [shortlist, enquiries, reviews] = await Promise.all([
    supabase.from('shortlists').select('id', { count: 'exact', head: true }),
    supabase.from('enquiries').select('id', { count: 'exact', head: true }),
    supabase.from('reviews').select('id', { count: 'exact', head: true }),
  ])

  const cards = [
    {
      href: '/account/shortlist',
      icon: Heart,
      label: 'Saved vendors',
      value: shortlist.count ?? 0,
    },
    {
      href: '/account/enquiries',
      icon: MessageSquareText,
      label: 'Enquiries',
      value: enquiries.count ?? 0,
    },
    { href: '/account/reviews', icon: Star, label: 'Reviews written', value: reviews.count ?? 0 },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-sand-900 text-2xl">
          {profile?.full_name ? `Hello, ${profile.full_name.split(' ')[0]}` : 'Your account'}
        </h1>
        <p className="text-sand-600 mt-1 text-sm">
          Track your shortlist, enquiries, and replies in one place.
        </p>
      </header>

      {/* Three across even on the narrowest phone: each card is a number
          and a two-word label, so stacking them full-width spent most of the
          first screen on three figures. */}
      <ul className="grid grid-cols-3 gap-3 sm:gap-4">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="border-sand-200 hover:border-brand-300 block h-full rounded-[var(--radius-card)] border bg-white p-3 sm:p-5"
            >
              <card.icon aria-hidden="true" className="text-brand-600 size-5" />
              <p className="text-sand-900 mt-2 text-xl font-semibold sm:mt-3 sm:text-2xl">
                {card.value}
              </p>
              <p className="text-sand-600 text-xs sm:text-sm">{card.label}</p>
            </Link>
          </li>
        ))}
      </ul>

      {(shortlist.count ?? 0) === 0 && (enquiries.count ?? 0) === 0 ? (
        <EmptyState
          title="Start by finding a few vendors"
          description="Search by category and city, save the ones you like, then send a single enquiry with your requirements."
          action={{ label: 'Browse vendors', href: '/vendors' }}
        />
      ) : null}

      {/* Milestone 4 fills in the wedding-profile completeness meter here. */}
      {!actor.userId ? null : null}
    </div>
  )
}
