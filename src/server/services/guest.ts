import 'server-only'

import { ServiceError } from '@/lib/action-result'
import { logError } from '@/lib/observability/logger'
import { createClient } from '@/lib/supabase/server'
import type { Actor } from '@/lib/permissions'

/**
 * Booking without an account.
 *
 * A visitor who books is signed in anonymously (Supabase "anonymous sign-ins",
 * enabled per project under Authentication → Sign In / Providers). That gives
 * them a real `auth.users` row and session cookie, so the enquiry RPC, RLS,
 * the thread and the vendor's inbox all work exactly as for a registered
 * customer — nothing bypasses the security boundary. Their name and phone go
 * on the profile the `handle_new_user` trigger created, which is what the
 * vendor sees once contact consent is given.
 *
 * A signed-in customer passes straight through; the same name and phone are
 * written to their profile only where the profile has none, so a typo on the
 * booking form cannot overwrite a verified number.
 */
export async function ensureCustomerSession(
  actor: Actor,
  contact: { fullName: string; phone: string },
): Promise<Actor & { userId: string }> {
  const supabase = await createClient()

  if (actor.userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', actor.userId)
      .maybeSingle()
    const patch: { full_name?: string; phone?: string } = {}
    if (!profile?.full_name) patch.full_name = contact.fullName
    if (!profile?.phone) patch.phone = contact.phone
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('profiles').update(patch).eq('id', actor.userId)
      if (error) logError('guest.updateProfile', error, { userId: actor.userId })
    }
    return actor as Actor & { userId: string }
  }

  const { data, error } = await supabase.auth.signInAnonymously({
    options: { data: { full_name: contact.fullName } },
  })
  if (error || !data.user) {
    logError('guest.signInAnonymously', error)
    throw new ServiceError(
      'unavailable',
      'Booking without an account is not available right now. Please sign in to book.',
    )
  }

  // The profile row exists via the auth trigger; the trigger only knows the
  // name, so the phone is written here. Failure is logged, not fatal: the
  // booking message itself carries the number too.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: contact.fullName, phone: contact.phone })
    .eq('id', data.user.id)
  if (profileError) logError('guest.profile', profileError, { userId: data.user.id })

  return { userId: data.user.id, adminRoles: [], vendorRoles: {} }
}
