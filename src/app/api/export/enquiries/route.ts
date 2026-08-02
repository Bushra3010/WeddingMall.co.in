import { NextResponse, type NextRequest } from 'next/server'

import { toCsv } from '@/lib/csv'
import { can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { getActor } from '@/server/dal/actor'
import { getEntitlements } from '@/server/dal/billing'
import { logError } from '@/lib/observability/logger'
import { audit } from '@/lib/security/audit'

/**
 * Enquiry export (PRD 6.9 "export according to plan/permission", 6.11).
 *
 * Two independent gates, and both are needed:
 *
 *   * **Permission** — an admin with `lead.read` may export across vendors.
 *   * **Entitlement** — a vendor may export only their own leads, and only on
 *     a plan that includes export.
 *
 * Neither is a UI concern. The plan page can hide the button, but this route is
 * reachable directly, so it re-derives both from the session.
 *
 * Rows come from the request-scoped client, so RLS scopes them a third time:
 * even if the checks above were wrong, a vendor member cannot read another
 * vendor's enquiries.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (!actor.userId) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const vendorId = request.nextUrl.searchParams.get('vendorId')
  const isAdmin = can(actor, 'lead.read')

  if (!isAdmin) {
    if (!vendorId || !actor.vendorRoles[vendorId]) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const entitlements = await getEntitlements(vendorId)
    if (!entitlements.export) {
      return NextResponse.json(
        { error: 'Your plan does not include data export.' },
        { status: 402 },
      )
    }
  }

  try {
    const supabase = await createClient()
    let query = supabase
      .from('enquiries')
      .select(
        'id, status, created_at, delivered_at, first_response_at, event_date, guest_count, budget_min_minor, budget_max_minor, currency, quote_amount_minor, lost_reason, vendors(display_name)',
      )
      .order('created_at', { ascending: false })
      .limit(5000)

    if (vendorId) query = query.eq('vendor_id', vendorId)

    const { data, error } = await query
    if (error) throw error

    /*
     * Deliberately omits customer name, email, and phone. Export is a bulk
     * egress path, and PRD 2.3 releases contact details one enquiry at a time
     * with consent — not in a spreadsheet of every lead at once.
     */
    const rows = (data ?? []).map((row) => ({
      enquiry_id: row.id,
      vendor: row.vendors?.display_name ?? '',
      status: row.status,
      created_at: row.created_at,
      delivered_at: row.delivered_at ?? '',
      first_response_at: row.first_response_at ?? '',
      event_date: row.event_date ?? '',
      guest_count: row.guest_count ?? '',
      budget_min_minor: row.budget_min_minor ?? '',
      budget_max_minor: row.budget_max_minor ?? '',
      currency: row.currency,
      quote_amount_minor: row.quote_amount_minor ?? '',
      lost_reason: row.lost_reason ?? '',
    }))

    // PRD 10.3 audits exports. Recorded after the rows are gathered so the
    // count is real, and before the response so a client that disconnects
    // mid-download is still on the record as having requested it.
    void audit({
      action: 'data.export',
      entityType: 'enquiries',
      entityId: vendorId,
      actorUserId: actor.userId,
      actorType: isAdmin ? 'admin' : 'vendor',
      after: { rows: rows.length, scope: vendorId ? 'vendor' : 'all' },
    })

    const filename = `enquiries-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(toCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        // An export is per-user data; it must never sit in a shared cache.
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    logError('export.enquiries', error, { vendorId })
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
