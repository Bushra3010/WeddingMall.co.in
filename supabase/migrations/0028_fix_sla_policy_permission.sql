-- ---------------------------------------------------------------------------
-- 0028 — `sla_policy` was writable by nobody
--
-- Migration `0019` guarded the SLA settings with
-- `has_admin_permission('settings.manage')`. That permission does not exist —
-- not in `admin_permissions`, and not in `lib/permissions/catalogue.ts`. The
-- function returns false for a code it has never heard of, so the policy was
-- deny-all and the response-time threshold could not be changed by anyone,
-- including a super-admin.
--
-- It fails closed, so it was never a security hole. It was a feature that
-- silently did not work: PRD 6.6 requires the SLA interval to be configurable,
-- and a `super_admin` PATCH returned 204 with zero rows matched — the shape of
-- success. Found while building `/admin/settings`, when TypeScript refused the
-- same non-existent permission name and prompted a check of the SQL side.
--
-- This is exactly the drift CLAUDE.md invariant 3 warns about: "the permission
-- catalogue is mirrored in SQL — change one, change the other." The mirror was
-- checked in one direction only.
--
-- `admin.manage` is the right existing permission: it already gates
-- administrator management, and platform-wide policy belongs with it rather
-- than with any single domain's permission.
-- ---------------------------------------------------------------------------

drop policy if exists "sla_policy: admin write" on public.sla_policy;

create policy "sla_policy: admin write"
  on public.sla_policy for all to authenticated
  using (public.has_admin_permission('admin.manage'))
  with check (public.has_admin_permission('admin.manage'));

-- `review_policy` and `review_eligible_statuses` were written in 0018 against
-- `review.moderate`, which does exist. Left alone deliberately — the point of
-- this migration is the one that was broken, not a sweep that touches working
-- policies at the same time.
