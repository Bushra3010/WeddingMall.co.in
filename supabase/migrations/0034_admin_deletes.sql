-- 0034  Deleting the rest of the admin catalogue (PRD 6.11, 9.5).
--
-- Same shape as `delete_city()` in 0032/0033, for the same reason: every one of
-- these tables has children, and Postgres's default answer to "delete a parent"
-- is to take them with it. A delete button wired straight to `DELETE FROM` is
-- how an admin removes a category and silently loses every vendor's answers to
-- its attributes.
--
-- Each function: locks the row (`for update` conflicts with the `for key share`
-- an FK insert takes, so nothing can slip a reference in behind the count),
-- counts what points at it, and either raises PT409 naming the blockers or
-- deletes. PT4xx codes are PostgREST's "respond with this status" convention
-- and are codes Postgres itself never raises, so the caller can tell our
-- messages from the database's own — see 0033 for why that distinction matters.
--
-- All SECURITY INVOKER: RLS still decides who may delete. These functions add a
-- reason, never a privilege.

-- ---------------------------------------------------------------------------
-- 1. System pages
-- ---------------------------------------------------------------------------
-- Five public routes render a `pages` row by slug: /privacy, /terms, /about,
-- /contact, /help. Deleting one leaves a route with nothing behind it, so the
-- rows are marked rather than the slugs being hardcoded in a function — the
-- admin screen can then show why the delete button is missing instead of
-- offering it and failing.

alter table public.pages
  add column if not exists is_system boolean not null default false;

update public.pages
  set is_system = true
  where slug in ('privacy', 'terms', 'about', 'contact', 'help');

comment on column public.pages.is_system is
  'Backs a fixed public route (see src/app/(public)/<slug>/page.tsx). Cannot be deleted.';

-- ---------------------------------------------------------------------------
-- 2. Categories
-- ---------------------------------------------------------------------------
-- `category_attributes` and `wedding_required_categories` cascade, and the
-- first of those cascades onward into `vendor_attribute_values` — so one delete
-- could remove every vendor's answers for the category. Refused instead.

create or replace function public.delete_category(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name     text;
  v_children integer;
  v_vendors  integer;
  v_attrs    integer;
  v_required integer;
  v_packages integer;
  v_enq      integer;
  v_rfq      integer;
begin
  select name into v_name from public.categories where id = p_id for update;
  if v_name is null then
    raise exception 'That category no longer exists.' using errcode = 'PT404';
  end if;

  select count(*) into v_children from public.categories                 where parent_id = p_id;
  select count(*) into v_vendors  from public.vendor_categories          where category_id = p_id;
  select count(*) into v_attrs    from public.category_attributes        where category_id = p_id;
  select count(*) into v_required from public.wedding_required_categories where category_id = p_id;
  select count(*) into v_packages from public.vendor_packages            where category_id = p_id;
  select count(*) into v_enq      from public.enquiries                  where category_id = p_id;
  select count(*) into v_rfq      from public.rfq_requests               where category_id = p_id;

  if v_children + v_vendors + v_attrs + v_required + v_packages + v_enq + v_rfq > 0 then
    raise exception '% is still in use (%). Hide it instead — that removes it from search and the homepage without breaking anything.',
      v_name,
      array_to_string(array_remove(array[
        case when v_children > 0 then v_children || ' sub-categor' || case when v_children = 1 then 'y' else 'ies' end end,
        case when v_vendors  > 0 then v_vendors  || ' vendor'      || case when v_vendors  = 1 then '' else 's' end end,
        case when v_attrs    > 0 then v_attrs    || ' attribute'   || case when v_attrs    = 1 then '' else 's' end end,
        case when v_required > 0 then v_required || ' wedding checklist entr' || case when v_required = 1 then 'y' else 'ies' end end,
        case when v_packages > 0 then v_packages || ' package'     || case when v_packages = 1 then '' else 's' end end,
        case when v_enq      > 0 then v_enq      || case when v_enq = 1 then ' enquiry' else ' enquiries' end end,
        case when v_rfq      > 0 then v_rfq      || ' request'     || case when v_rfq      = 1 then '' else 's' end end
      ], null), ', ')
      using errcode = 'PT409';
  end if;

  delete from public.categories where id = p_id;
  if not found then
    raise exception 'You do not have permission to delete that category.' using errcode = 'PT403';
  end if;

  delete from public.slug_redirects where entity_type = 'category' and entity_id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Category attributes
-- ---------------------------------------------------------------------------
-- This one deletes rather than refuses, and returns the number of vendor
-- answers it removed. A question that no longer exists cannot have meaningful
-- answers, and there is no way to hide an attribute — refusing would make any
-- attribute a vendor has ever filled in permanently undeletable. The admin
-- screen shows the count before asking, so this is consent, not a surprise.

create or replace function public.delete_attribute(p_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_label   text;
  v_answers integer;
begin
  select label into v_label from public.category_attributes where id = p_id for update;
  if v_label is null then
    raise exception 'That attribute no longer exists.' using errcode = 'PT404';
  end if;

  select count(*) into v_answers
    from public.vendor_attribute_values where category_attribute_id = p_id;

  delete from public.category_attributes where id = p_id;
  if not found then
    raise exception 'You do not have permission to delete that attribute.' using errcode = 'PT403';
  end if;

  return v_answers;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Content pages and blog posts
-- ---------------------------------------------------------------------------
-- Nothing has a foreign key to either, so the only thing worth protecting is
-- the five routes that render a page by slug.

create or replace function public.delete_page(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_title  text;
  v_system boolean;
begin
  select title, is_system into v_title, v_system
    from public.pages where id = p_id for update;
  if v_title is null then
    raise exception 'That page no longer exists.' using errcode = 'PT404';
  end if;

  if v_system then
    raise exception '% backs a page on the public site, so it cannot be deleted. Unpublish it instead.', v_title
      using errcode = 'PT409';
  end if;

  delete from public.pages where id = p_id;
  if not found then
    raise exception 'You do not have permission to delete that page.' using errcode = 'PT403';
  end if;
end;
$$;

create or replace function public.delete_post(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_title text;
begin
  select title into v_title from public.posts where id = p_id for update;
  if v_title is null then
    raise exception 'That post no longer exists.' using errcode = 'PT404';
  end if;

  delete from public.posts where id = p_id;
  if not found then
    raise exception 'You do not have permission to delete that post.' using errcode = 'PT403';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Plans
-- ---------------------------------------------------------------------------
-- `subscriptions.plan_id` is already RESTRICT, but `vendors.plan_id` is SET
-- NULL — so deleting a plan would quietly strip the plan from vendors carrying
-- it. Both are refused, including cancelled subscriptions: a deleted plan would
-- leave past billing rows pointing at nothing.

create or replace function public.delete_plan(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name    text;
  v_subs    integer;
  v_vendors integer;
begin
  select name into v_name from public.plans where id = p_id for update;
  if v_name is null then
    raise exception 'That plan no longer exists.' using errcode = 'PT404';
  end if;

  select count(*) into v_subs    from public.subscriptions where plan_id = p_id;
  select count(*) into v_vendors from public.vendors       where plan_id = p_id;

  if v_subs + v_vendors > 0 then
    raise exception '% is still in use (%). Deactivate it instead — that hides it from checkout and leaves existing billing intact.',
      v_name,
      array_to_string(array_remove(array[
        case when v_subs    > 0 then v_subs    || ' subscription' || case when v_subs    = 1 then '' else 's' end end,
        case when v_vendors > 0 then v_vendors || ' vendor'       || case when v_vendors = 1 then '' else 's' end end
      ], null), ', ')
      using errcode = 'PT409';
  end if;

  delete from public.plans where id = p_id;
  if not found then
    raise exception 'You do not have permission to delete that plan.' using errcode = 'PT403';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.delete_category(uuid)  from public;
revoke execute on function public.delete_attribute(uuid) from public;
revoke execute on function public.delete_page(uuid)      from public;
revoke execute on function public.delete_post(uuid)      from public;
revoke execute on function public.delete_plan(uuid)      from public;

grant execute on function public.delete_category(uuid)  to authenticated;
grant execute on function public.delete_attribute(uuid) to authenticated;
grant execute on function public.delete_page(uuid)      to authenticated;
grant execute on function public.delete_post(uuid)      to authenticated;
grant execute on function public.delete_plan(uuid)      to authenticated;
