-- 0001  Extensions, shared enums, and authorisation helper functions.
-- PRD 9 (general rules), 10 (security).

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;
create extension if not exists "citext" with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared enums
-- ---------------------------------------------------------------------------

create type public.profile_status as enum ('active', 'suspended', 'deactivated', 'deleted');

create type public.vendor_status as enum (
  'draft', 'pending_review', 'active', 'suspended', 'rejected', 'archived'
);

create type public.verification_status as enum (
  'unverified', 'pending', 'verified', 'rejected', 'expired'
);

create type public.moderation_status as enum (
  'draft', 'pending', 'approved', 'rejected', 'flagged', 'archived'
);

create type public.vendor_role as enum (
  'vendor_owner', 'vendor_manager', 'vendor_sales', 'vendor_editor', 'vendor_viewer'
);

create type public.membership_status as enum ('invited', 'active', 'revoked');

create type public.enquiry_status as enum (
  'draft', 'submitted', 'delivered', 'viewed', 'contacted',
  'qualified', 'quote_sent', 'negotiating', 'booked',
  'not_booked', 'closed', 'spam'
);

create type public.price_type as enum ('starting_at', 'fixed', 'range', 'custom');

create type public.availability_status as enum ('available', 'busy', 'unavailable', 'unknown');

create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired'
);

create type public.content_status as enum ('draft', 'scheduled', 'published', 'archived');

create type public.notification_channel as enum ('in_app', 'email', 'sms', 'whatsapp');

create type public.actor_type as enum ('customer', 'vendor', 'admin', 'system');

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Slug helper
-- ---------------------------------------------------------------------------

-- `unaccent` is not enabled by default on every Supabase project, so fold the
-- handful of characters we actually expect rather than adding the extension.
create or replace function public.unaccent_fallback(value text)
returns text
language sql
immutable
strict
as $$
  select translate(
    value,
    'àáâãäåèéêëìíîïòóôõöùúûüñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC'
  );
$$;

create or replace function public.slugify(value text)
returns text
language sql
immutable
strict
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(public.unaccent_fallback(value)), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;
