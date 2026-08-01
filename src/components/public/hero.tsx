import Image from 'next/image'
import { Sparkles } from 'lucide-react'

import { CountUp } from '@/components/shared/count-up'
import { HeroSearch } from '@/components/public/hero-search'
import { storagePublicUrl } from '@/lib/supabase/storage'
import type { HomeStat } from '@/server/dal/homepage'
import type { CategoryRow, CityRow } from '@/server/dal/taxonomy'

/**
 * Hero (PRD 6.1.2).
 *
 * The background image is admin-configured, not shipped: `homepage_sections`
 * with code `hero` may carry `{"imagePath": "<bucket path>"}`. Until one is
 * set, a layered gradient stands in — the site should look finished from the
 * first deploy without inventing a stock photograph of real people.
 *
 * Explicit dimensions and `priority` keep LCP honest and CLS at zero
 * (PRD 6.1 acceptance, 14.1).
 */
export function Hero({
  stats,
  categories,
  cities,
  popular,
  imagePath,
  eyebrow,
}: {
  stats: HomeStat[]
  categories: CategoryRow[]
  cities: CityRow[]
  popular: CategoryRow[]
  imagePath?: string | null
  eyebrow?: string | null
}) {
  const image = storagePublicUrl('vendor-media', imagePath)

  return (
    <section className="relative isolate overflow-hidden">
      {/* Backdrop */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover motion-safe:animate-[slow-zoom_24s_ease-in-out_infinite_alternate]"
          />
        ) : (
          <div className="from-brand-950 via-brand-800 to-brand-600 absolute inset-0 bg-gradient-to-br" />
        )}

        {/* Dark scrim so the headline always clears contrast (PRD 7.3). */}
        <div className="from-brand-950/95 via-brand-950/70 absolute inset-0 bg-gradient-to-r to-transparent" />
        <div className="from-brand-950/80 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />

        {/* Floating decorative blooms; purely ornamental. */}
        <div className="bg-blush-500/20 absolute -top-24 -left-16 size-96 rounded-full blur-3xl motion-safe:animate-[drift_14s_ease-in-out_infinite_alternate]" />
        <div className="bg-rose-400/20 absolute top-1/3 -right-24 size-[28rem] rounded-full blur-3xl motion-safe:animate-[drift_18s_ease-in-out_infinite_alternate-reverse]" />
      </div>

      <div className="mx-auto max-w-[90rem] px-4 pt-16 pb-10 sm:px-6 sm:pt-24 lg:px-10 lg:pt-28">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur">
              <Sparkles aria-hidden="true" className="text-gold-300 size-3.5" />
              {eyebrow}
            </p>
          ) : null}

          <h1 className="font-display text-4xl leading-[1.05] font-semibold text-white sm:text-6xl lg:text-7xl">
            Plan your dream wedding
            <span className="from-gold-300 to-blush-300 block bg-gradient-to-r bg-clip-text text-transparent">
              with vendors you can trust
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base text-white/85 sm:text-lg">
            Compare verified wedding professionals, see real pricing and moderated reviews, and send
            one enquiry with your requirements.
          </p>

          {stats.length > 0 ? (
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-6">
              {stats.map((stat) => (
                <div key={stat.key}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="font-display text-3xl font-semibold text-white sm:text-4xl">
                    <CountUp value={stat.value} decimals={stat.decimals ?? 0} />
                    {stat.suffix ? <span className="text-gold-300">{stat.suffix}</span> : null}
                  </dd>
                  <p className="mt-0.5 text-sm text-white/70">{stat.label}</p>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="mt-12 motion-safe:animate-[reveal_0.7s_cubic-bezier(0.22,1,0.36,1)_0.15s_both] lg:mt-16">
          <HeroSearch categories={categories} cities={cities} popular={popular} />
        </div>
      </div>
    </section>
  )
}
