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
 * Two sources, in order. `homepage_sections` with code `hero` may carry
 * `{"imagePath": "<bucket path>"}`, and that still wins — ADR-024 exists so the
 * hero can be changed without a deploy. Failing that, the shipped artwork in
 * `public/Images/hero.png` is the default.
 *
 * The gradient is no longer an either/or: it renders underneath the photograph
 * always, so the headline sits on a known colour for the frame before the image
 * decodes, and a missing or broken file degrades to what the site shipped with
 * rather than to white text on white.
 *
 * Explicit dimensions and `priority` keep LCP honest and CLS at zero
 * (PRD 6.1 acceptance, 14.1).
 *
 * On mobile the hero is a compact rounded card that the search box overhangs,
 * so the first screen shows the promise, the search, and the top of the
 * category list together. `overflow-hidden` therefore lives on the backdrop
 * rather than the section — the section has to let the search box escape its
 * bounds, while the backdrop still has to clip its own rounded corners and
 * decorative blur.
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
  const image = storagePublicUrl('vendor-media', imagePath) ?? '/Images/hero.png'

  return (
    <section className="relative isolate">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 overflow-hidden rounded-b-[2rem] lg:rounded-none"
      >
        <div className="from-brand-950 via-brand-800 to-brand-600 absolute inset-0 bg-gradient-to-br" />
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover motion-safe:animate-[slow-zoom_24s_ease-in-out_infinite_alternate]"
        />

        {/*
          Scrim (PRD 7.3). Two of them, because the two layouts put the text in
          different places, and one gradient cannot serve both.

          From `lg` the headline occupies the left half of a wide canvas, so the
          scrim is strong there and gone by 60% of the width — the right-hand
          two-fifths of the photograph render at full strength. The version
          before this ran `/95` to `/70` edge to edge: contrast to spare, and
          the whole image turned into a maroon wash, scrimming the photograph it
          exists to show.

          Below `lg` the hero is a compact card whose text spans its full width,
          so that same left-to-right fade leaves the end of the headline on open
          sky. Top-down instead.

          Measured, not judged by eye — the artwork is brightest exactly where a
          horizontal scrim is thinnest, so the worst case is the *end* of the
          headline. Sampling the composited layers across each text box:

            1440px   headline 4.38:1   paragraph and statistics 5.96:1
             375px   headline 9.16:1   paragraph 6.80:1

          against the 3:1 WCAG AA asks of this display size and 4.5:1 of the
          smaller text. The phone figures are what the top-down scrim bought:
          the horizontal one measured 1.54:1 and 2.22:1 there, which is white on
          a sunset. Lightening either further starts to fail, and both numbers
          belong to this photograph — re-measure if the artwork is swapped.
        */}
        <div className="from-brand-950/88 via-brand-950/72 to-brand-950/45 absolute inset-0 bg-gradient-to-b lg:hidden" />
        {/* From `lg` the headline occupies the left half and the photograph
            carries the rest. */}
        <div className="from-brand-950/92 via-brand-950/45 absolute inset-0 hidden bg-gradient-to-r via-40% to-transparent lg:block" />
        {/* Foot only: the search card overhangs this edge and needs to land on
            something darker than a sunlit aisle. */}
        <div className="from-brand-950/70 absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t to-transparent" />

        {/* Floating decorative blooms; purely ornamental, and kept faint enough
            not to tint the artwork. */}
        <div className="bg-blush-500/10 absolute -top-24 -left-16 size-96 rounded-full blur-3xl motion-safe:animate-[drift_14s_ease-in-out_infinite_alternate]" />
        <div className="absolute top-1/3 -right-24 size-[28rem] rounded-full bg-rose-400/10 blur-3xl motion-safe:animate-[drift_18s_ease-in-out_infinite_alternate-reverse]" />
      </div>

      <div className="mx-auto max-w-[90rem] px-4 pt-20 pb-4 sm:px-6 sm:pt-24 lg:px-10 lg:pt-28 lg:pb-10">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-medium text-white backdrop-blur sm:text-xs lg:mb-6 lg:px-4">
              <Sparkles aria-hidden="true" className="text-gold-300 size-3.5" />
              {eyebrow}
            </p>
          ) : null}

          <h1 className="font-display text-3xl leading-[1.08] font-semibold text-white sm:text-6xl sm:leading-[1.05] lg:text-7xl">
            Plan your dream wedding
            <span className="from-gold-300 to-blush-300 block bg-gradient-to-r bg-clip-text text-transparent">
              with vendors you can trust
            </span>
          </h1>

          <p className="mt-3 max-w-xl text-sm text-white/85 sm:mt-6 sm:text-lg">
            Compare verified wedding professionals, see real pricing and moderated reviews, and send
            one enquiry with your requirements.
          </p>

          {/*
            Desktop only. On a phone these move into `StatStrip` further down
            the page — four figures between the headline and the search box
            would push the search below the fold.
          */}
          {stats.length > 0 ? (
            <dl className="mt-10 hidden flex-wrap gap-x-10 gap-y-6 lg:flex">
              {stats.map((stat) => (
                // `flex-col-reverse` shows the figure above its label while
                // keeping the required dt-before-dd order in the markup. The
                // label used to be repeated — once visually and once as an
                // `sr-only` dt — which read the whole row twice aloud.
                <div key={stat.key} className="flex flex-col-reverse">
                  <dt className="mt-0.5 text-sm text-white/70">{stat.label}</dt>
                  <dd className="font-display text-3xl font-semibold text-white sm:text-4xl">
                    <CountUp value={stat.value} decimals={stat.decimals ?? 0} />
                    {stat.suffix ? <span className="text-gold-300">{stat.suffix}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {/*
          The negative margin lets the card overhang the hero's rounded edge.
          The page below compensates with matching top padding, so nothing is
          overlapped — see the categories section in the homepage.
        */}
        <div className="relative z-10 mt-6 -mb-14 motion-safe:animate-[reveal_0.7s_cubic-bezier(0.22,1,0.36,1)_0.15s_both] lg:mt-16 lg:mb-0">
          <HeroSearch categories={categories} cities={cities} popular={popular} />
        </div>
      </div>
    </section>
  )
}
