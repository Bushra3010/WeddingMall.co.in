import Link from 'next/link'

import { VendorCreateForm } from '@/components/admin/vendor-create-form'
import { PermissionDenied } from '@/components/ui/states'
import { NOINDEX } from '@/lib/seo'
import { can } from '@/lib/permissions'
import { requireElevatedAdmin } from '@/server/policies/require'
import { listCategories, listCities } from '@/server/dal/taxonomy'

export const metadata = { title: 'Add a business', ...NOINDEX }
export const dynamic = 'force-dynamic'

/**
 * Creating a business from the admin panel (migration 0039).
 *
 * Gated on `vendor.verify`, not `vendor.read`. Creating a listing that can be
 * published in the same click is a moderation act — `vendor.read` is held by
 * analysts and support agents, and would let either of them put a business in
 * front of couples.
 *
 * `requireElevatedAdmin` gives the redirect; `admin_create_vendor()` re-checks
 * the permission itself, because a Server Action and PostgREST are both public
 * endpoints and neither is protected by this page having rendered.
 */
export default async function AdminNewVendorPage() {
  const actor = await requireElevatedAdmin('vendor.read')

  if (!can(actor, 'vendor.verify')) {
    return <PermissionDenied />
  }

  // Wider than the public defaults for the reason the edit page gives: an admin
  // signing up a business over the phone must be able to reach any city or
  // category, not just the ones the homepage happens to show.
  const [categories, cities] = await Promise.all([listCategories(200), listCities(200)])

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sand-500 text-xs">
        <Link href="/admin/vendors" className="hover:text-brand-700">
          Vendors
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-sand-700">Add a business</span>
      </nav>

      <header>
        <h1 className="font-display text-sand-900 text-2xl">Add a business</h1>
        <p className="text-sand-600 mt-1 max-w-prose text-sm">
          For businesses signed up over the phone or at an event, where the details are with you
          rather than with them. Save it as a draft for the vendor to finish, or publish it now.
        </p>
      </header>

      <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-5">
        <VendorCreateForm categories={categories} cities={cities} />
      </div>
    </div>
  )
}
