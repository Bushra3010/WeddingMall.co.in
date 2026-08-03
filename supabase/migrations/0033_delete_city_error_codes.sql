-- 0033  Give `delete_city()` error codes only it can raise (PRD 15).
--
-- 0032 raised its refusal as `foreign_key_violation` (23503), which reads
-- nicely but is the same code Postgres raises when a constraint is hit
-- directly. The caller has to decide whether a message is safe to show, and it
-- was deciding on the code alone — so a genuine constraint violation, whose
-- message names the constraint and the child table, would have been passed
-- straight to the screen as if we had written it. A unit test caught it before
-- this shipped; the code was doing two jobs and could not tell them apart.
--
-- `PTxxx` is PostgREST's convention for "respond with HTTP xxx", so PT409 and
-- PT404 give the right status *and* are codes Postgres itself never raises.
-- Discrimination is now exact, with no sniffing of message text.

create or replace function public.delete_city(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name    text;
  v_areas   integer;
  v_service integer;
  v_vendors integer;
  v_addr    integer;
  v_enq     integer;
  v_rfq     integer;
  v_prof    integer;
begin
  -- `for update` conflicts with the `for key share` an FK insert takes on its
  -- parent row, so from here until commit nothing new can point at this city.
  select name into v_name from public.cities where id = p_id for update;
  if v_name is null then
    raise exception 'That city no longer exists.' using errcode = 'PT404';
  end if;

  select count(*) into v_areas   from public.areas                where city_id = p_id;
  select count(*) into v_service from public.vendor_service_areas where city_id = p_id;
  select count(*) into v_vendors from public.vendors              where primary_city_id = p_id;
  select count(*) into v_addr    from public.vendor_addresses     where city_id = p_id;
  select count(*) into v_enq     from public.enquiries            where city_id = p_id;
  select count(*) into v_rfq     from public.rfq_requests         where city_id = p_id;
  select count(*) into v_prof    from public.wedding_profiles     where primary_city_id = p_id;

  -- Reported as one list rather than one blocker at a time: clearing them one
  -- refusal per attempt would make removing a city a guessing game.
  if v_areas + v_service + v_vendors + v_addr + v_enq + v_rfq + v_prof > 0 then
    raise exception '% is still in use (%). Hide it instead — that removes it from public filters and keeps the links working.',
      v_name,
      array_to_string(array_remove(array[
        case when v_vendors > 0 then v_vendors || ' vendor' || case when v_vendors = 1 then '' else 's' end || ' based there' end,
        case when v_service > 0 then v_service || ' vendor' || case when v_service = 1 then '' else 's' end || ' covering it' end,
        case when v_areas   > 0 then v_areas   || ' area'   || case when v_areas   = 1 then '' else 's' end end,
        case when v_addr    > 0 then v_addr    || case when v_addr = 1 then ' address'  else ' addresses' end end,
        case when v_enq     > 0 then v_enq     || case when v_enq  = 1 then ' enquiry'  else ' enquiries' end end,
        case when v_rfq     > 0 then v_rfq     || ' request' || case when v_rfq = 1 then '' else 's' end end,
        case when v_prof    > 0 then v_prof    || ' wedding profile' || case when v_prof = 1 then '' else 's' end end
      ], null), ', ')
      using errcode = 'PT409';
  end if;

  -- Subject to the caller's RLS: `cities: taxonomy write` still has to pass.
  delete from public.cities where id = p_id;
  if not found then
    raise exception 'You do not have permission to delete that city.' using errcode = 'PT403';
  end if;

  -- The slug is gone, so a redirect pointing at it would now forward visitors
  -- to a 404 — worse than the 404 they would get directly.
  delete from public.slug_redirects where entity_type = 'city' and entity_id = p_id;
end;
$$;

comment on function public.delete_city(uuid) is
  'Deletes a city only when nothing references it; otherwise raises PT409 naming what is in the way. SECURITY INVOKER — RLS still applies.';
