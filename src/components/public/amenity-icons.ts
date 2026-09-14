import {
  BedDouble,
  Building2,
  Camera,
  Car,
  ChefHat,
  Crown,
  Flower2,
  Package,
  Plane,
  Snowflake,
  Sofa,
  Sparkles,
  Trees,
  UtensilsCrossed,
  Users,
  Waves,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Amenity presentation shared by the profile grid and the vendor card, so one
 * facility never picks up two different marks across a journey — the same
 * reason `category-icons.ts` exists.
 *
 * `category_attributes.code` is set by an admin, so this is a presentation
 * hint, not a contract: an unrecognised code still gets a usable mark.
 */
export const AMENITY_ICONS: Record<string, LucideIcon> = {
  ac_rooms: Snowflake,
  bridal_room: Crown,
  capacity: Users,
  catering_policy: ChefHat,
  cuisine: UtensilsCrossed,
  deliverables: Package,
  dining_area: UtensilsCrossed,
  garden: Flower2,
  halls: Building2,
  lawns: Trees,
  minimum_guests: Users,
  parking: Car,
  power_backup: Zap,
  rooms: BedDouble,
  sitting_capacity: Sofa,
  style: Camera,
  swimming_pool: Waves,
  travel: Plane,
  trial_available: Sparkles,
  venue_type: Building2,
  wifi: Wifi,
}

export function amenityIcon(code: string): LucideIcon {
  return AMENITY_ICONS[code] ?? Sparkles
}

/** Card chips are always counts, so a generic sparkle would read as noise. */
export function highlightIcon(code: string): LucideIcon {
  return AMENITY_ICONS[code] ?? Users
}
