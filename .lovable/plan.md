# User Management — Close-Out Follow-ups

Three small fixes to close the remaining gaps from the audit.

## 1. Seed system roles (migration)

New migration `seed_system_roles.sql`:
- Upsert into `public.roles` (tenant = default `00000000-0000-0000-0000-000000000001`) the 4 system rows with `is_system = true`:
  - `owner` — Owner
  - `admin` — Administrator
  - `member` — Member
  - `viewer` — Viewer
- Use `ON CONFLICT (tenant_id, slug) DO UPDATE SET is_system = true, name = EXCLUDED.name` so existing rows are normalized without losing FK references.
- No GRANT/RLS changes (table already exists).

Guarantees the last-owner guard and UAT prerequisite always have the 4 canonical rows.

## 2. `send-user-invite` — proper resend revocation

Edit `supabase/functions/send-user-invite/index.ts`:
- When `resend === true` (or when an existing `pending` row is found for the email):
  1. Update the prior row(s) for that email: `status = 'revoked'`, `cancelled_at = now()`.
  2. Insert a fresh `user_invites` row with new `token` and new `expires_at` (existing behaviour).
  3. Emit `activity_logs` entry `invitation.revoked` for the old row in addition to `invite.resent`.
- Return `{ expires_at, invite_id }` in the response so the UI can show the new expiry inline.
- No schema changes.

Closes UAT F29 ("old link must become invalid").

## 3. `AcceptInvite` — distinct revoked state + audit emissions

Edit `src/pages/AcceptInvite.tsx`:
- Branch error rendering on the error code/string returned by `accept-user-invite`:
  - `expired` → existing expired card
  - `cancelled` → existing cancelled card
  - `revoked` → new card: "This invitation was replaced by a newer one. Please use the latest email." with a "Contact your admin" CTA.
  - `already_accepted` → existing card
  - fallback → generic invalid

Audit-log emission sweep (no UI):
- Verify these mutations write to `activity_logs` via `logCrud` / direct insert. Add the missing ones:
  - `manage-user-status` edge fn → `user.suspended` / `user.reactivated`
  - `rbac-manage` → `user.role_changed`, `user.removed`
  - `DepartmentDialog` / `DepartmentsTable` mutations → `department.created` / `department.updated` / `department.deleted`
  - `useCancelUserInvite` → `invitation.revoked`
- Only add the emission where it's missing; keep action names consistent with the Activity Logs filter list.

## Out of scope

- New tables, RLS rewrites.
- MFA, sessions, multi-tenant `org_members`.
- Visual redesign of any page.

## Sequence

1 (migration) → 2 (edge fn) → 3 (UI + audit emissions). Phases 2 and 3 can run in parallel after the migration lands.

## Acceptance

- UAT prerequisite: 4 system roles present with `is_system=true`.
- UAT F29: resending an invite invalidates the prior token immediately (verified by attempting old link → "revoked" card).
- Activity Logs CSV includes `user.suspended`, `user.reactivated`, `department.*`, `invitation.revoked`, `user.role_changed`, `user.removed` after exercising each action.
