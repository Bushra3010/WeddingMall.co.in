-- ---------------------------------------------------------------------------
-- 0030 — Only the two parties may write in a thread
--
-- `messages: participant send` gated inserts on `can_access_enquiry()`, which
-- returns true for the customer, for a vendor member, **and for any admin
-- holding `lead.read`**. That predicate is right for reading — support needs to
-- see a thread to resolve a dispute — and wrong for writing.
--
-- Observed in production: a `super_admin` account posted two messages into a
-- customer↔vendor thread. The vendor saw them attributed to the customer,
-- because the UI labelled any sender who was not the viewer as the
-- counterparty. So a third party could put words in a customer's mouth, and
-- nothing in the thread revealed it.
--
-- PRD 6.7: "vendor/customer cannot add arbitrary third parties". An admin
-- silently speaking as one of them is the same failure from the other
-- direction.
--
-- Reading is untouched. `can_access_enquiry` keeps its admin branch, and
-- `messages: participant read` keeps using it — an admin can still open a
-- thread, they simply cannot add to it.
-- ---------------------------------------------------------------------------

create or replace function public.is_enquiry_party(target_enquiry uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enquiries e
    where e.id = target_enquiry
      and (
        e.customer_id = (select auth.uid())
        or public.is_vendor_member(e.vendor_id)
      )
  )
$$;

comment on function public.is_enquiry_party(uuid) is
  'True only for the customer or a member of the vendor. Deliberately excludes admins — see 0030.';

revoke execute on function public.is_enquiry_party(uuid) from public;
grant execute on function public.is_enquiry_party(uuid) to authenticated;

drop policy if exists "messages: participant send" on public.messages;

create policy "messages: participant send"
  on public.messages for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.status = 'open'
        and public.is_enquiry_party(c.enquiry_id)
    )
  );
