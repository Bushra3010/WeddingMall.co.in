-- ---------------------------------------------------------------------------
-- 0023 — Give the subscription upsert a usable conflict target
--
-- `subscriptions_provider_sub_idx` was a PARTIAL unique index:
--
--   unique (provider, provider_subscription_id) where provider_subscription_id is not null
--
-- Postgres will not infer a partial index for `ON CONFLICT` unless the
-- statement repeats the index predicate, and PostgREST does not emit one. So
-- the very first `subscription.created` webhook failed with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" — found by driving the real endpoint, not by reading it.
--
-- A plain unique index does the same job here. Postgres treats NULLs as
-- distinct by default, so manual subscriptions (which have no provider id)
-- still do not collide with one another.
-- ---------------------------------------------------------------------------

drop index if exists public.subscriptions_provider_sub_idx;

create unique index if not exists subscriptions_provider_sub_idx
  on public.subscriptions (provider, provider_subscription_id);
