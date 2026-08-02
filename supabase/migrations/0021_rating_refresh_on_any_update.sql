-- ---------------------------------------------------------------------------
-- 0021 — Recompute ratings when a BEFORE trigger changes the status
--
-- `reviews_refresh_rating` was declared `after update of status, overall_rating`.
-- That column list matches the columns named in the UPDATE *statement*, not the
-- columns a BEFORE trigger went on to change.
--
-- So when a customer edited an approved review, `enforce_review_integrity`
-- correctly reset the row to `pending` — but the statement had only mentioned
-- `body`, so the rating trigger never fired. The review vanished from the
-- public profile while its stars stayed in the vendor's average: a rating
-- partly composed of text nobody can read.
--
-- Found by `scripts/rls-review-probe.mjs`, which asserts the aggregate falls
-- again after an edit. The assertion existed because the reverse — that
-- approval *raises* the average — is worthless on its own.
--
-- The fix is to fire on every update and decide inside the function, where
-- NEW and OLD reflect what actually happened.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_vendor_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  -- NEW is unassigned on DELETE, so it must not be referenced there.
  if tg_op = 'DELETE' then
    target := old.vendor_id;
  elsif tg_op = 'UPDATE' then
    -- Cheap guard: most updates touch neither the moderation state nor the
    -- score, and recomputing an aggregate for a typo fix is wasted work.
    if new.status = old.status and new.overall_rating = old.overall_rating
       and new.vendor_id = old.vendor_id then
      return null;
    end if;
    target := new.vendor_id;
  else
    target := new.vendor_id;
  end if;

  update public.vendors v
  set rating_average = coalesce(agg.avg_rating, 0),
      rating_count   = coalesce(agg.total, 0)
  from (
    select avg(overall_rating)::numeric(3,2) as avg_rating, count(*) as total
    from public.reviews
    where vendor_id = target and status = 'approved'
  ) agg
  where v.id = target;

  return null;
end;
$$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_vendor_rating();
