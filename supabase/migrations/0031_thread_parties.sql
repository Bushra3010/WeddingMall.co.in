-- ---------------------------------------------------------------------------
-- 0031 — Let the two parties in a thread see each other's names
--
-- Reported: the chat should show real names, never "Customer" or "Vendor".
-- The reason it did not is that neither side can read the other's row:
--
--   * `profiles: own row read` limits `profiles` to your own row (or an admin
--     with `user.support`), so the vendor could not resolve the customer's
--     name and the customer could not resolve the replying staff member's;
--   * `vendor_memberships` is scoped to your own memberships, so the customer
--     could not tell that a reply came from the vendor's side at all — it fell
--     through to "not a participant".
--
-- Both are correct as general rules. This function is the narrow exception:
-- for an enquiry the caller may already access, it returns the two parties'
-- display names and the vendor's member ids.
--
-- ## What it deliberately does not expose
--
-- Names only. No email, no phone. Contact details stay behind the per-enquiry
-- consent gate and its audit trail (PRD 2.3) — being in a conversation with
-- someone is a reason to know what to call them, not a reason to receive their
-- phone number.
--
-- The `can_access_enquiry` guard is what keeps this from becoming a directory:
-- ask about an enquiry you are not party to and the function returns nothing.
-- ---------------------------------------------------------------------------

create or replace function public.enquiry_thread_parties(p_enquiry_id uuid)
returns table (
  customer_id       uuid,
  customer_name     text,
  vendor_id         uuid,
  vendor_name       text,
  vendor_member_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.customer_id,
    cp.full_name,
    e.vendor_id,
    v.display_name,
    coalesce(
      array(
        select vm.user_id
        from public.vendor_memberships vm
        where vm.vendor_id = e.vendor_id
      ),
      '{}'::uuid[]
    )
  from public.enquiries e
  join public.vendors v on v.id = e.vendor_id
  left join public.profiles cp on cp.id = e.customer_id
  where e.id = p_enquiry_id
    -- The whole security boundary. Same predicate the read policy uses, so a
    -- caller learns nothing here they could not already learn from the thread.
    and public.can_access_enquiry(p_enquiry_id);
$$;

comment on function public.enquiry_thread_parties(uuid) is
  'Display names of both parties in a thread, for participants only. Names only — never contact details.';

revoke execute on function public.enquiry_thread_parties(uuid) from public;
grant execute on function public.enquiry_thread_parties(uuid) to authenticated;
