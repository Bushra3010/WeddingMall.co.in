import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import { GUEST, type Actor, type AdminRole, type VendorRole } from '@/lib/permissions'

/**
 * Data Access Layer entry point for authorisation facts (PRD 8.3).
 *
 * `cache()` deduplicates within a single request so a page and its nested
 * components resolve the actor once. This is a convenience for rendering — RLS
 * remains the enforcement boundary.
 */
export const getActor = cache(async (): Promise<Actor> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return GUEST

  const [adminResult, vendorResult] = await Promise.all([
    supabase
      .from('admin_memberships')
      .select('status, admin_roles(code)')
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('vendor_memberships')
      .select('vendor_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ])

  const adminRoles = (adminResult.data ?? [])
    .map((row) => {
      const roles = row.admin_roles
      const record = Array.isArray(roles) ? roles[0] : roles
      return record?.code as AdminRole | undefined
    })
    .filter((code): code is AdminRole => Boolean(code))

  const vendorRoles: Record<string, VendorRole> = {}
  for (const row of vendorResult.data ?? []) {
    vendorRoles[row.vendor_id as string] = row.role as VendorRole
  }

  return { userId: user.id, adminRoles, vendorRoles }
})

/** Current auth user, or null. Prefer `getActor()` when permissions matter. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export const getProfile = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_path, locale, timezone, status')
    .eq('id', user.id)
    .maybeSingle()
  return data
})
