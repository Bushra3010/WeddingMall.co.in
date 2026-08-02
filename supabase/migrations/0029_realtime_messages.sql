-- ---------------------------------------------------------------------------
-- 0029 — Realtime for the message thread (PRD 6.7)
--
-- "Optionally use Supabase Realtime for new-message UI, with polling fallback.
--  Realtime channel access must be private and membership-authorised."
--
-- The second sentence is the whole job. Realtime is a second read path into
-- `messages`, and a second read path is a second chance to leak one: a
-- subscriber who is not a participant must receive nothing, not merely be
-- unable to fetch it afterwards.
--
-- Supabase evaluates the table's RLS policies for the subscribing user before
-- delivering a change, so the existing `messages: participant read` policy is
-- what protects the stream — there is no separate channel ACL to keep in sync,
-- which is the point. The probe in `scripts/rls-realtime-probe.mjs` asserts it
-- in both directions rather than trusting that.
--
-- `replica identity full` is required for that evaluation to have the whole
-- row. With the default identity the change payload carries only the primary
-- key, and a policy that reads `conversation_id` cannot be evaluated at all —
-- so the choice is between full identity and a stream nobody can filter.
-- ---------------------------------------------------------------------------

alter table public.messages replica identity full;

-- Idempotent: re-running must not fail on a table already published.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

-- Deliberately NOT published:
--
--   * `enquiries` — status changes are interesting but the row carries budget
--     and contact-consent fields, and a stream is a poor place to reason about
--     column exposure. The thread is what a person watches.
--   * `notifications` — the badge is fetched on navigation, and a live counter
--     is not worth a second read path over a table keyed to a user.
