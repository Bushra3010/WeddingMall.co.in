-- ---------------------------------------------------------------------------
-- 0018 — Review integrity (PRD 6.8, Milestone 5)
--
-- The Milestone 1 policies let a customer insert a review and then update it,
-- which RLS alone cannot narrow to *which columns* they may update. Probed
-- against the live database, a freshly signed-up account could:
--
--   1. review a vendor off a `draft` enquiry it had just created — no contact,
--      no conversation, no relationship (`reviews: customer create` only
--      checked that the enquiry linked the same customer and vendor);
--   2. PATCH its own review to `status = 'approved'`, skipping moderation
--      entirely and moving the vendor's public rating;
--   3. by the same route, edit an already-approved review's body and leave it
--      approved — get something innocuous published, then rewrite it.
--
-- This is the same shape as ADR-019: RLS is row-level, so a policy that grants
-- UPDATE on a row grants it on every column of that row. Column rules belong
-- in triggers.
--
-- Eligibility is table-driven, mirroring `enquiry_transitions`, so "which
-- lifecycle states earn a review" is configuration rather than a literal
-- buried in a function body (PRD 6.8 asks for it to be configurable).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Configuration
-- ---------------------------------------------------------------------------

create table if not exists public.review_eligible_statuses (
  status public.enquiry_status primary key
);

comment on table public.review_eligible_statuses is
  'Enquiry lifecycle states that entitle a customer to review (PRD 6.8).';

-- Seeded conservatively: the vendor must actually have engaged. `delivered`
-- and `viewed` mean only that the enquiry arrived, and `draft`/`spam` mean
-- nothing happened at all. Admins can widen this without a deploy.
insert into public.review_eligible_statuses (status)
values ('contacted'), ('qualified'), ('quote_sent'), ('negotiating'),
       ('booked'), ('not_booked'), ('closed')
on conflict do nothing;

create table if not exists public.review_policy (
  id                boolean primary key default true check (id),
  edit_window_hours integer not null default 720 check (edit_window_hours >= 0)
);

comment on table public.review_policy is
  'Singleton. `id` is constrained to true so only one row can ever exist.';

insert into public.review_policy (id) values (true) on conflict do nothing;

alter table public.review_eligible_statuses enable row level security;
alter table public.review_policy            enable row level security;

drop policy if exists "review_eligible_statuses: public read" on public.review_eligible_statuses;
create policy "review_eligible_statuses: public read"
  on public.review_eligible_statuses for select to anon, authenticated using (true);

drop policy if exists "review_eligible_statuses: admin write" on public.review_eligible_statuses;
create policy "review_eligible_statuses: admin write"
  on public.review_eligible_statuses for all to authenticated
  using (public.has_admin_permission('review.moderate'))
  with check (public.has_admin_permission('review.moderate'));

drop policy if exists "review_policy: public read" on public.review_policy;
create policy "review_policy: public read"
  on public.review_policy for select to anon, authenticated using (true);

drop policy if exists "review_policy: admin write" on public.review_policy;
create policy "review_policy: admin write"
  on public.review_policy for all to authenticated
  using (public.has_admin_permission('review.moderate'))
  with check (public.has_admin_permission('review.moderate'));

-- ---------------------------------------------------------------------------
-- 2. Eligibility on insert
-- ---------------------------------------------------------------------------

create or replace function public.enforce_review_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  enq record;
begin
  select e.customer_id, e.vendor_id, e.status
    into enq
  from public.enquiries e
  where e.id = new.enquiry_id;

  if not found then
    raise exception 'Enquiry not found' using errcode = '23503';
  end if;

  -- Restated here rather than trusted from RLS: this trigger is the one place
  -- that sees the enquiry and the review together, and it must hold even if a
  -- future policy is loosened.
  if enq.customer_id is distinct from new.customer_id
     or enq.vendor_id is distinct from new.vendor_id then
    raise exception 'Review must reference the customer''s own enquiry with this vendor'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.review_eligible_statuses s where s.status = enq.status
  ) then
    raise exception
      'Enquiry status % does not entitle a review yet', enq.status
      using errcode = '42501';
  end if;

  -- Moderation is never the author's to set.
  new.status := 'pending';
  new.moderation_reason := null;
  new.reviewer_id := null;
  return new;
end;
$$;

drop trigger if exists reviews_enforce_eligibility on public.reviews;
create trigger reviews_enforce_eligibility
  before insert on public.reviews
  for each row execute function public.enforce_review_eligibility();

-- ---------------------------------------------------------------------------
-- 3. Column rules on update
-- ---------------------------------------------------------------------------

create or replace function public.enforce_review_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_moderator boolean := public.has_admin_permission('review.moderate');
  window_hours integer;
  content_changed boolean;
begin
  -- Identity is immutable for everyone: re-pointing a review at another vendor
  -- would move an approved rating onto a business that never earned it.
  if new.enquiry_id  is distinct from old.enquiry_id
     or new.customer_id is distinct from old.customer_id
     or new.vendor_id   is distinct from old.vendor_id then
    raise exception 'Review identity cannot be reassigned' using errcode = '42501';
  end if;

  if is_moderator then
    return new;
  end if;

  -- Everything below applies to the author.
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

  -- An edited review returns to the queue. Without this, an author could get
  -- something innocuous approved and then rewrite it in place.
  new.status := 'pending';
  new.edited_at := now();
  return new;
end;
$$;

drop trigger if exists reviews_enforce_integrity on public.reviews;
create trigger reviews_enforce_integrity
  before update on public.reviews
  for each row execute function public.enforce_review_integrity();

-- ---------------------------------------------------------------------------
-- 4. Revision history, written by the database
-- ---------------------------------------------------------------------------

create or replace function public.write_review_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Stores the values as they were BEFORE this edit, so the row set reads as
  -- the review's history rather than a duplicate of its current state.
  if new.overall_rating is distinct from old.overall_rating
     or new.title is distinct from old.title
     or new.body is distinct from old.body then
    insert into public.review_revisions (review_id, body, title, rating)
    values (old.id, old.body, old.title, old.overall_rating);
  end if;
  return null;
end;
$$;

drop trigger if exists reviews_write_revision on public.reviews;
create trigger reviews_write_revision
  after update on public.reviews
  for each row execute function public.write_review_revision();

-- ---------------------------------------------------------------------------
-- 5. Vendor responses
--
-- Two holes in the Milestone 1 policy: nothing tied the response's `vendor_id`
-- to the review's, so a vendor could answer a competitor's review; and `for
-- all` let the vendor set `status`, self-approving their own public reply.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_review_response_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  review_vendor uuid;
  review_status public.moderation_status;
  is_moderator boolean := public.has_admin_permission('review.moderate');
begin
  select r.vendor_id, r.status into review_vendor, review_status
  from public.reviews r where r.id = new.review_id;

  if not found then
    raise exception 'Review not found' using errcode = '23503';
  end if;

  if new.vendor_id is distinct from review_vendor then
    raise exception 'A response must come from the vendor being reviewed'
      using errcode = '42501';
  end if;

  if is_moderator then
    return new;
  end if;

  -- Responding to a review the public cannot see would publish the vendor's
  -- half of an exchange whose other half is still in moderation.
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

drop trigger if exists review_responses_enforce_integrity on public.review_responses;
create trigger review_responses_enforce_integrity
  before insert or update on public.review_responses
  for each row execute function public.enforce_review_response_integrity();

-- ---------------------------------------------------------------------------
-- 6. Reads the author and the vendor legitimately need
-- ---------------------------------------------------------------------------

drop policy if exists "review_revisions: own read" on public.review_revisions;
create policy "review_revisions: own read"
  on public.review_revisions for select to authenticated
  using (exists (
    select 1 from public.reviews r
    where r.id = review_id
      and (r.customer_id = (select auth.uid())
           or public.is_vendor_member(r.vendor_id)
           or public.has_admin_permission('review.moderate'))
  ));
