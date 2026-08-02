-- ---------------------------------------------------------------------------
-- 0020 — Teach the review triggers about the service role
--
-- The integrity triggers in 0018 asked `has_admin_permission('review.moderate')`
-- to decide whether a writer may set moderation state. That predicate resolves
-- through `auth.uid()`, which is null for the service role — so cron handlers,
-- webhooks, and `src/server/jobs` were treated as the review's author and had
-- their approvals rejected.
--
-- Caught by the probe in `scripts/rls-review-probe.mjs`: approving a review as
-- the service role left the rating aggregate at zero, and the cascade then
-- made the vendor-response assertions fail too. One predicate, three red
-- lines.
--
-- The service role is only reachable from server-side code holding the secret
-- key; it already bypasses RLS entirely, so recognising it here grants nothing
-- it did not already have. What it does is stop the triggers from lying about
-- who is asking.
-- ---------------------------------------------------------------------------

create or replace function public.can_moderate_reviews()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_admin_permission('review.moderate')
    -- Signed claim, so it cannot be forged by a browser client.
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

comment on function public.can_moderate_reviews() is
  'True for an admin holding review.moderate, or for the service role.';

grant execute on function public.can_moderate_reviews() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Re-declare both triggers against the new predicate. Bodies are otherwise
-- unchanged from 0018.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_review_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_moderator boolean := public.can_moderate_reviews();
  window_hours integer;
  content_changed boolean;
begin
  if new.enquiry_id  is distinct from old.enquiry_id
     or new.customer_id is distinct from old.customer_id
     or new.vendor_id   is distinct from old.vendor_id then
    raise exception 'Review identity cannot be reassigned' using errcode = '42501';
  end if;

  if is_moderator then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.moderation_reason is distinct from old.moderation_reason
     or new.reviewer_id is distinct from old.reviewer_id then
    raise exception 'Only a moderator may change review moderation state'
      using errcode = '42501';
  end if;

  content_changed :=
    new.overall_rating  is distinct from old.overall_rating
    or new.title        is distinct from old.title
    or new.body         is distinct from old.body
    or new.event_date   is distinct from old.event_date
    or new.subratings_json is distinct from old.subratings_json;

  if not content_changed then
    return new;
  end if;

  select p.edit_window_hours into window_hours from public.review_policy p where p.id;

  if old.created_at < now() - make_interval(hours => coalesce(window_hours, 720)) then
    raise exception 'The edit window for this review has closed' using errcode = '42501';
  end if;

  new.status := 'pending';
  new.edited_at := now();
  return new;
end;
$$;

create or replace function public.enforce_review_response_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  review_vendor uuid;
  review_status public.moderation_status;
  is_moderator boolean := public.can_moderate_reviews();
begin
  select r.vendor_id, r.status into review_vendor, review_status
  from public.reviews r where r.id = new.review_id;

  if not found then
    raise exception 'Review not found' using errcode = '23503';
  end if;

  -- Applies to everyone including moderators: a response must belong to the
  -- vendor under review, or an approved reply would appear on the wrong
  -- business's profile.
  if new.vendor_id is distinct from review_vendor then
    raise exception 'A response must come from the vendor being reviewed'
      using errcode = '42501';
  end if;

  if is_moderator then
    return new;
  end if;

  if review_status <> 'approved' then
    raise exception 'Only an approved review can receive a public response'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
  elsif new.status is distinct from old.status then
    raise exception 'Only a moderator may change response moderation state'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
