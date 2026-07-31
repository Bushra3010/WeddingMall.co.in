/**
 * Seeds fictional demo vendors (PRD Epic G — seed data is fictional).
 *
 * Kept out of supabase/seed.sql because vendors need rows in auth.users, which
 * only the Auth admin API can create. Every business, person, and price below
 * is invented.
 *
 * Idempotent: re-running replaces the demo set rather than duplicating it.
 * Every demo row is tagged so cleanup is exact — see DEMO_TAG.
 *
 * Usage: node --env-file=.env.local scripts/seed-demo-vendors.mjs [--clean]
 */
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SVC = process.env.SUPABASE_SECRET_KEY

const DEMO_TAG = 'demo-seed'
const DEMO_EMAIL_DOMAIN = 'demo.weddingmall.test'

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
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (res.status >= 400) {
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${JSON.stringify(body)}`)
  }
  return body
}

async function authAdmin(path, init = {}) {
  const res = await fetch(`${URL_BASE}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  return res.status === 204 ? null : res.json()
}

// --- cleanup of any previous demo run -------------------------------------

console.log('removing any previous demo data…')
const existing = await rest(`vendors?select=id,owner_user_id&suspended_reason=eq.${DEMO_TAG}`)
for (const v of existing) {
  await rest(`vendors?id=eq.${v.id}`, { method: 'DELETE' })
}
const users = await authAdmin('admin/users?per_page=200')
for (const u of users?.users ?? []) {
  if (u.email?.endsWith(DEMO_EMAIL_DOMAIN)) {
    await authAdmin(`admin/users/${u.id}`, { method: 'DELETE' })
  }
}
console.log(`  removed ${existing.length} vendor(s)`)

if (process.argv.includes('--clean')) {
  console.log('clean only — done')
  process.exit(0)
}

// --- lookups ---------------------------------------------------------------

const cities = await rest('cities?select=id,name,slug')
const categories = await rest('categories?select=id,name,slug')
const cityBy = Object.fromEntries(cities.map((c) => [c.slug, c]))
const catBy = Object.fromEntries(categories.map((c) => [c.slug, c]))

/** All fictional. Prices in paise (INR minor units). */
const DEMO = [
  {
    name: 'Marigold Courtyard',
    city: 'jaipur',
    category: 'venues',
    years: 12,
    about:
      'A restored courtyard property on the edge of the old city, suited to ceremonies of 150 to 400 guests. Two lawns, a covered hall for the monsoon months, and 22 rooms on site.',
    rating: 4.6,
    reviews: 38,
    packages: [
      { name: 'Lawn ceremony', min: 45000000, max: 78000000, unit: 'event', type: 'range' },
      { name: 'Per plate — vegetarian', min: 185000, type: 'starting_at', unit: 'plate' },
    ],
  },
  {
    name: 'Saffron & Salt Photography',
    city: 'mumbai',
    category: 'photographers',
    years: 8,
    about:
      'Two-person team shooting candid and documentary coverage. Packages include a second shooter, 600+ edited images, and a short film delivered within eight weeks.',
    rating: 4.8,
    reviews: 64,
    packages: [
      { name: 'Single day coverage', min: 12500000, type: 'starting_at', unit: 'day' },
      { name: 'Three-function package', min: 31000000, max: 45000000, type: 'range' },
    ],
  },
  {
    name: 'Neelam Studio',
    city: 'bengaluru',
    category: 'makeup-artists',
    years: 6,
    about:
      'Bridal makeup and hair for South Indian and North Indian ceremonies. Trials available at the studio; travel within the city is included.',
    rating: 4.7,
    reviews: 51,
    packages: [
      { name: 'Bridal — per function', min: 3500000, type: 'starting_at', unit: 'function' },
      { name: 'Family package (4 people)', min: 6000000, type: 'fixed' },
    ],
  },
  {
    name: 'The Copper Pot',
    city: 'pune',
    category: 'caterers',
    years: 15,
    about:
      'Multi-cuisine catering with live counters. Minimum 200 guests. Tastings held on the first Saturday of each month.',
    rating: 4.4,
    reviews: 29,
    packages: [
      { name: 'Vegetarian, per plate', min: 145000, type: 'starting_at', unit: 'plate' },
      { name: 'Premium buffet, per plate', min: 240000, type: 'starting_at', unit: 'plate' },
    ],
  },
  {
    name: 'Lantern & Vine Events',
    city: 'udaipur',
    category: 'planners',
    years: 9,
    about:
      'Full-service planning for destination weddings, including vendor coordination, guest logistics, and on-day management.',
    rating: 4.9,
    reviews: 22,
    packages: [
      { name: 'Full planning', min: 85000000, max: 180000000, type: 'range' },
      { name: 'Day-of coordination', min: 15000000, type: 'starting_at' },
    ],
  },
  {
    name: 'Bloom Street Decor',
    city: 'new-delhi',
    category: 'decorators',
    years: 7,
    about:
      'Floral styling, mandap design, and lighting. Works to a fixed brief and shares a render before the event.',
    rating: 4.3,
    reviews: 41,
    packages: [{ name: 'Mandap and stage', min: 22000000, max: 65000000, type: 'range' }],
  },
  {
    name: 'Riverstone Retreat',
    city: 'panaji',
    category: 'venues',
    years: 5,
    about:
      'Riverside venue for smaller celebrations of 60 to 180 guests. Outside catering permitted. Closed during the monsoon.',
    rating: 4.5,
    reviews: 17,
    packages: [{ name: 'Full-day hire', min: 32000000, max: 55000000, type: 'range' }],
  },
  {
    name: 'Dhol & Co.',
    city: 'mumbai',
    category: 'music-and-dj',
    years: 11,
    about:
      'DJs, dhol players, and live bands. Sound and lighting equipment included in every package.',
    rating: 4.2,
    reviews: 33,
    packages: [{ name: 'DJ + dhol, one function', min: 5500000, type: 'starting_at' }],
  },
]

console.log('\nseeding demo vendors…')

for (const [index, item] of DEMO.entries()) {
  const slugBase = item.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const owner = await authAdmin('admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: `owner-${slugBase}@${DEMO_EMAIL_DOMAIN}`,
      password: `DemoVendor!${index}${Date.now()}`,
      email_confirm: true,
      user_metadata: { full_name: `${item.name} Owner` },
    }),
  })
  if (!owner?.id) throw new Error(`could not create owner for ${item.name}`)

  const city = cityBy[item.city]
  const category = catBy[item.category]

  const [vendor] = await rest('vendors', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      display_name: item.name,
      legal_name: `${item.name} (demo)`,
      slug: slugBase,
      owner_user_id: owner.id,
      status: 'active',
      verification_status: index % 3 === 0 ? 'verified' : 'unverified',
      primary_city_id: city?.id,
      founded_year: 2026 - item.years,
      // Tag so --clean can find exactly these rows and nothing else.
      suspended_reason: DEMO_TAG,
      rating_average: item.rating,
      rating_count: item.reviews,
      listing_quality: 0.8,
      response_score: 0.7,
      plan_boost: index === 1 ? 0.9 : 0,
      is_featured: index === 1,
      published_at: new Date(Date.now() - index * 86400000).toISOString(),
    }),
  })

  await rest('vendor_memberships', {
    method: 'POST',
    body: JSON.stringify({
      vendor_id: vendor.id,
      user_id: owner.id,
      role: 'vendor_owner',
      status: 'active',
    }),
  })

  await rest('vendor_listings', {
    method: 'POST',
    body: JSON.stringify({
      vendor_id: vendor.id,
      status: 'approved',
      about: item.about,
      experience_years: item.years,
      languages: ['English', 'Hindi'],
      completion_score: 85,
      published_at: new Date().toISOString(),
    }),
  })

  if (category) {
    await rest('vendor_categories', {
      method: 'POST',
      body: JSON.stringify({ vendor_id: vendor.id, category_id: category.id, is_primary: true }),
    })
  }

  if (city) {
    await rest('vendor_service_areas', {
      method: 'POST',
      body: JSON.stringify({ vendor_id: vendor.id, city_id: city.id, travel_available: true }),
    })
  }

  for (const [order, pkg] of item.packages.entries()) {
    await rest('vendor_packages', {
      method: 'POST',
      body: JSON.stringify({
        vendor_id: vendor.id,
        category_id: category?.id,
        name: pkg.name,
        price_type: pkg.type,
        min_amount_minor: pkg.min ?? null,
        max_amount_minor: pkg.max ?? null,
        currency: 'INR',
        unit: pkg.unit ?? null,
        active: true,
        sort_order: order,
      }),
    })
  }

  console.log(`  ${item.name} — /vendor/${slugBase}`)
}

// The search index is maintained by triggers on listings/categories/packages,
// but those fired before every child row existed. Refresh explicitly.
console.log('\nrefreshing search text…')
const all = await rest(`vendors?select=id&suspended_reason=eq.${DEMO_TAG}`)
for (const v of all) {
  await fetch(`${URL_BASE}/rest/v1/rpc/refresh_vendor_search_text`, {
    method: 'POST',
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: v.id }),
  })
}

console.log(`\nseeded ${DEMO.length} demo vendors`)
