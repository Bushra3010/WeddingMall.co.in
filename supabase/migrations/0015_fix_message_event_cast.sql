-- 0015  Fix an uncast CASE in the message trigger.
--
-- `on_message_sent` inserted into enquiry_events.actor_type (an enum) from a
-- CASE expression that Postgres types as `text`, raising 42804 and aborting the
-- INSERT. Every message send failed.
--
-- It slipped through the first manual check because that only exercised
-- submit_enquiry, which writes its events with literal enum values. The probe
-- assertions around messaging then passed *trivially* — "an unrelated user
-- cannot read the thread" is satisfied by there being no thread at all. Worth
-- remembering: an assertion that something is absent proves nothing unless the
-- happy path is asserted alongside it.

create or replace function public.on_message_sent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e      public.enquiries%rowtype;
  sender uuid := new.sender_user_id;
  role   public.actor_type;
begin
  select en.* into e
  from public.enquiries en
  join public.conversations c on c.enquiry_id = en.id
  where c.id = new.conversation_id;

  if not found then return null; end if;

  role := case when sender = e.customer_id then 'customer' else 'vendor' end;

  if role = 'customer' then
    perform public.queue_notification(
      m.user_id, 'message.new',
      jsonb_build_object('enquiryId', e.id, 'from', 'customer')
    )
    from public.vendor_memberships m
    where m.vendor_id = e.vendor_id and m.status = 'active';
  else
    perform public.queue_notification(
      e.customer_id, 'message.new',
      jsonb_build_object('enquiryId', e.id, 'from', 'vendor')
    );

    -- First vendor reply stops the SLA clock (PRD 6.6).
    if e.first_response_at is null then
      update public.enquiries set first_response_at = now() where id = e.id;
      insert into public.enquiry_events (enquiry_id, actor_user_id, actor_type, event_type)
      values (e.id, sender, 'vendor', 'first_response');
    end if;
  end if;

  insert into public.enquiry_events (enquiry_id, actor_user_id, actor_type, event_type)
  values (e.id, sender, role, 'message_sent');

  return null;
end;
$$;
