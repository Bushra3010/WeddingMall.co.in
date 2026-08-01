import {
  Building2,
  Cake,
  Camera,
  Flower2,
  Gem,
  Music,
  Palette,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

/**
 * Category presentation shared by the desktop carousel and the mobile circles
 * (PRD 6.1.3), so a category never picks up two different marks on one page.
 *
 * `categories.icon` is nullable and currently unset for every seeded row, so
 * the slug map is the real source. An admin adding a category still gets a
 * usable tile — it falls through to the generic mark rather than breaking.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  venues: Building2,
  photographers: Camera,
  'makeup-artists': Sparkles,
  caterers: UtensilsCrossed,
  decorators: Flower2,
  'music-and-dj': Music,
  'mehendi-artists': Palette,
  planners: Gem,
  cakes: Cake,
}

export function categoryIcon(slug: string): LucideIcon {
  return CATEGORY_ICONS[slug] ?? Sparkles
}

/** Rotating gradient tints so a row of tiles is not monotone. */
export const CATEGORY_TINTS = [
  'from-brand-500 to-rose-500',
  'from-blush-500 to-brand-500',
  'from-rose-400 to-brand-600',
  'from-gold-500 to-blush-500',
  'from-brand-600 to-blush-600',
  'from-rose-500 to-gold-500',
]

export function categoryTint(index: number): string {
  return CATEGORY_TINTS[index % CATEGORY_TINTS.length]
}

/**
 * Live count, never a decorative number (PRD 6.1). Singular/plural matters
 * here because our real counts are small.
 */
export function vendorCountLabel(count: number): string {
  if (count === 0) return 'Coming soon'
  return `${count} ${count === 1 ? 'vendor' : 'vendors'}`
}
