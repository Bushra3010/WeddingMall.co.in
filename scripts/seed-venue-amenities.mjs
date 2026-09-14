/**
 * Answers venue amenity attributes (PRD 6.2) from each vendor's OWN published
 * About text.
 *
 * Every value below is traceable to a phrase in that vendor's description — the
 * second element of each pair quotes it, and is printed as the script runs so a
 * reviewer can check the claim against the listing. A facility a venue does not
 * mention is left unanswered rather than guessed, so an absent card means "not
 * stated", never "not available".
 *
 * Three values are an upper bound taken from a stated range, because
 * `capacity` is a single number and the copy gives two: Blue Crystal (240-800
 * seated), Pearl (60-250), and Usha (1,000 seated of 1,500 floating). Change
 * them here if you would rather publish the lower figure.
 *
 * Service key, because this is a data-loading script rather than a UI path —
 * the same route scripts/seed-demo-vendors.mjs takes. RLS still governs every
 * request the application itself makes.
 *
 * Usage:
 *   npm run seed:amenities            # write
 *   npm run seed:amenities -- --clean # remove every answer it wrote
 */
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SVC = process.env.SUPABASE_SECRET_KEY
const CLEAN = process.argv.includes('--clean')

if (!URL_BASE || !SVC) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required')
}

async function rest(path, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  if (res.status >= 400) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

/** slug -> { attribute code: [value, the phrase it came from] } */
const ANSWERS = {
  'usha-resort': {
    capacity: [1000, 'Up to 1,000 seated'],
    rooms: [12, 'Guest Rooms: 12 rooms'],
    parking: [100, 'Parking: Space for approximately 100 cars'],
    halls: [1, 'Air-conditioned banquet hall'],
    lawns: [1, 'Spacious landscaped wedding lawn'],
    swimming_pool: [true, 'Swimming pool'],
    power_backup: [true, 'Power backup'],
    bridal_room: [true, 'Bridal room'],
    wifi: [true, 'Free Wi-Fi'],
    venue_type: ['Resort', 'a premium wedding resort'],
  },
  'raj-darbar-a-wedding-palace': {
    capacity: [2000, 'ideal for 2000+ guests in a single day'],
    rooms: [16, 'we have 16 Double rooms'],
    ac_rooms: [16, '16 Double rooms along with A/C'],
    halls: [1, '7000 sqft pillarless banquet'],
    lawns: [1, 'more than 27000 sqft open lawn'],
    wifi: [true, 'fully WiFi enabled campus'],
  },
  'rajdarbar-resort': {
    capacity: [1000, 'approximately 1,000 seated guests'],
    rooms: [10, 'Around 10 guest rooms available'],
    halls: [1, 'Large banquet hall and lawn'],
    lawns: [1, 'Large banquet hall and lawn'],
    venue_type: ['Resort', 'operates as both a resort and a banquet venue'],
  },
  'blue-crystal': {
    capacity: [800, 'Seating: approx 240 - 800 guests'],
    halls: [1, 'Indoor Banquet Hall + Lawn'],
    lawns: [1, 'Indoor Banquet Hall + Lawn'],
    venue_type: ['Banquet hall', 'a modern banquet + lawn venue'],
  },
  'lagoon-resort': {
    halls: [1, 'Indoor banquet hall + large open lawn'],
    lawns: [1, 'Indoor banquet hall + large open lawn'],
    swimming_pool: [true, 'Swimming pool & recreational facilities'],
    venue_type: ['Resort', 'designed as a destination-style venue'],
  },
  'the-blue-garden-banquet-resort': {
    lawns: [1, 'designed primarily as an open lawn venue'],
    garden: [true, 'Garden-style venue with open-air charm'],
    venue_type: ['Lawn', 'designed primarily as an open lawn venue'],
  },
  'the-buddha-resort': {
    halls: [1, 'Banquet Hall, conference halls'],
    swimming_pool: [true, 'swimming pool'],
    dining_area: [true, 'restaurant'],
    venue_type: ['Resort', 'one of the premium resorts in Bodhgaya'],
  },
  'krrish-farms': {
    halls: [1, 'Its indoor banquet hall'],
    lawns: [1, 'a large outdoor lawn'],
  },
  'j-k-celebration': {
    halls: [1, 'a spacious banquet hall'],
    dining_area: [true, 'our hotel restaurant'],
    venue_type: ['Hotel', 'Hotel J.K. Celebrations'],
  },
  'the-marine-drive-resort': {
    dining_area: [true, 'the best family restaurant in Patna'],
    venue_type: ['Resort', 'Marine Drive Resort'],
  },
  'pearl-banquet-hall-2': {
    capacity: [250, 'around 60 to 250 guests'],
  },
}

const [venues] = await rest('categories?select=id&slug=eq.venues')
if (!venues) throw new Error('no category with slug "venues"')

const definitions = await rest(`category_attributes?select=id,code&category_id=eq.${venues.id}`)
const byCode = Object.fromEntries(definitions.map((d) => [d.code, d.id]))

const slugs = Object.keys(ANSWERS)
const vendors = await rest(`vendors?select=id,slug,display_name&slug=in.(${slugs.join(',')})`)
const bySlug = Object.fromEntries(vendors.map((v) => [v.slug, v]))

if (CLEAN) {
  for (const vendor of vendors) {
    await rest(`vendor_attribute_values?vendor_id=eq.${vendor.id}`, { method: 'DELETE' })
  }
  console.log(`cleared every answer for ${vendors.length} vendors`)
  process.exit(0)
}

const rows = []
for (const [slug, answers] of Object.entries(ANSWERS)) {
  const vendor = bySlug[slug]
  if (!vendor) {
    console.log(`SKIP ${slug} — no such vendor`)
    continue
  }

  console.log(`\n${vendor.display_name}`)
  for (const [code, [value, source]] of Object.entries(answers)) {
    if (!byCode[code]) {
      console.log(`  SKIP ${code} — not an attribute of the venues category`)
      continue
    }
    console.log(`  ${code.padEnd(14)} = ${String(value).padEnd(13)} <- "${source}"`)
    rows.push({ vendor_id: vendor.id, category_attribute_id: byCode[code], value_json: value })
  }
}

if (rows.length === 0) {
  console.log('\nnothing to write')
  process.exit(0)
}

await rest('vendor_attribute_values?on_conflict=vendor_id,category_attribute_id', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(rows),
})

console.log(`\nwrote ${rows.length} answers across ${Object.keys(bySlug).length} vendors`)
