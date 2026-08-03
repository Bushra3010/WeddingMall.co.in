-- 0032  Deleting a city, safely (PRD 6.11).
--
-- The admin Locations page had no delete, so nothing ever exercised the
-- foreign keys pointing at `cities`. Seven tables reference it, and they do not
-- agree on what should happen:
--
--   CASCADE   areas.city_id                  -- rows disappear
--   CASCADE   vendor_service_areas.city_id   -- rows disappear
--   SET NULL  enquiries.city_id
--   SET NULL  rfq_requests.city_id
--   SET NULL  vendor_addresses.city_id
--   SET NULL  vendors.primary_city_id
--   SET NULL  wedding_profiles.primary_city_id
--
-- A plain `delete from cities` where the row is in use is therefore silent
-- damage: a vendor's coverage rows vanish and their primary city becomes null,
-- so they drop out of search with nothing recorded and nobody told. Mumbai
-- currently has three of each.
--
-- Two changes, doing different jobs:
--
-- 1. The two CASCADEs become RESTRICT, so the database itself refuses. This is
--    the guarantee — it holds for any future code path, not just the one added
--    today.
-- 2. `delete_city()` gives that refusal a useful message. It counts the
--    references first so it can say what is in the way, and it takes `for
--    update` on the city row before counting: an FK insert takes `for key
--    share` on its parent, which conflicts, so a concurrent "vendor covers
--    this city" cannot land between the count and the delete.
--
-- SECURITY INVOKER, so the caller's RLS still decides. `can_manage_taxonomy()`
-- already gates writes on `cities`; this function must not become a way around
-- it.

-- ---------------------------------------------------------------------------
-- 1. Make silent cascades loud
-- ---------------------------------------------------------------------------

alter table public.areas
  drop constraint areas_city_id_fkey,
  add constraint areas_city_id_fkey
    foreign key (city_id) references public.cities (id) on delete restrict;

alter table public.vendor_service_areas
  drop constraint vendor_service_areas_city_id_fkey,
  add constraint vendor_service_areas_city_id_fkey
    foreign key (city_id) references public.cities (id) on delete restrict;

-- A state cascading into its cities would route around every check above, so
-- it is restricted too. States are seeded for the whole country and hidden
-- rather than removed, so nothing legitimate deletes one.
alter table public.cities
  drop constraint cities_state_id_fkey,
  add constraint cities_state_id_fkey
    foreign key (state_id) references public.states (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 2. Delete with a reason
-- ---------------------------------------------------------------------------

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
    raise exception 'That city no longer exists.' using errcode = 'no_data_found';
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
        case when v_vendors > 0 then v_vendors || ' vendor'          || case when v_vendors = 1 then '' else 's' end || ' based there' end,
        case when v_service > 0 then v_service || ' vendor'          || case when v_service = 1 then '' else 's' end || ' covering it' end,
        case when v_areas   > 0 then v_areas   || ' area'            || case when v_areas   = 1 then '' else 's' end end,
        case when v_addr    > 0 then v_addr    || case when v_addr   = 1 then ' address' else ' addresses' end end,
        case when v_enq     > 0 then v_enq     || case when v_enq    = 1 then ' enquiry' else ' enquiries' end end,
        case when v_rfq     > 0 then v_rfq     || ' request'         || case when v_rfq     = 1 then '' else 's' end end,
        case when v_prof    > 0 then v_prof    || ' wedding profile' || case when v_prof    = 1 then '' else 's' end end
      ], null), ', ')
      using errcode = 'foreign_key_violation';
  end if;

  -- Subject to the caller's RLS: `cities: taxonomy write` still has to pass.
  delete from public.cities where id = p_id;
  if not found then
    raise exception 'You do not have permission to delete that city.' using errcode = 'insufficient_privilege';
  end if;

  -- The slug is gone, so a redirect pointing at it would now forward visitors
  -- to a 404 — worse than the 404 they would get directly.
  delete from public.slug_redirects where entity_type = 'city' and entity_id = p_id;
end;
$$;

revoke execute on function public.delete_city(uuid) from public;
grant execute on function public.delete_city(uuid) to authenticated;

comment on function public.delete_city(uuid) is
  'Deletes a city only when nothing references it; otherwise raises naming what is in the way. SECURITY INVOKER — RLS still applies.';
