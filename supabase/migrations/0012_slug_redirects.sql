-- 0012  Automatic slug redirects (PRD 11.2 — "clean 301 redirects for slug changes").
--
-- Renaming a vendor, category, or city changes an indexed URL. A trigger
-- records the old → new mapping so the public route can redirect instead of
-- 404ing, and existing redirects are repointed so a rename never creates a
-- chain (A→B then B→C must leave A→C, not A→B→C).

create or replace function public.record_slug_redirect()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kind text := tg_argv[0];
begin
  if new.slug is not distinct from old.slug then
    return new;
  end if;

  -- Repoint anything that already pointed at the old slug.
  update public.slug_redirects
  set new_slug = new.slug
  where entity_type = kind and new_slug = old.slug;

  insert into public.slug_redirects (entity_type, entity_id, old_slug, new_slug, status_code)
  values (kind, new.id, old.slug, new.slug, 301)
  on conflict (entity_type, old_slug)
  do update set new_slug = excluded.new_slug, entity_id = excluded.entity_id;

  -- A slug that is now in use must not also redirect away from itself.
  delete from public.slug_redirects
  where entity_type = kind and old_slug = new.slug;

  return new;
end;
$$;

create trigger vendors_slug_redirect
  after update of slug on public.vendors
  for each row execute function public.record_slug_redirect('vendor');

create trigger categories_slug_redirect
  after update of slug on public.categories
  for each row execute function public.record_slug_redirect('category');

create trigger cities_slug_redirect
  after update of slug on public.cities
  for each row execute function public.record_slug_redirect('city');

-- Resolve a slug to its current value. Returns null when there is no redirect.
create or replace function public.resolve_slug_redirect(kind text, candidate text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select new_slug from public.slug_redirects
  where entity_type = kind and old_slug = candidate
  limit 1;
$$;

revoke execute on function public.resolve_slug_redirect(text, text) from public;
grant execute on function public.resolve_slug_redirect(text, text) to anon, authenticated;
