# Admin-Controlled User Creation

Move from open signup to an admin-only user creation model matching your flowchart.

## Auth Changes

- **Disable self-registration**: Remove the "Create Account" tab on `/auth`. Login screen shows only Email + Password + Forgot Password.
- **Disable signups in Cloud auth settings** so the public API also rejects sign-ups.
- **Blocked user check on login**: If `profiles.status = 'inactive'`, sign the user out immediately and show "Login blocked — Contact Admin."
- **Force password change on first login**: If `profiles.must_change_password = true`, redirect to `/change-password` after login; block all other routes until it's set.

## Forgot Password Flow (Buyer)

- Buyer taps "Forgot Password?" → enters email/username → a row is inserted into `password_reset_requests` (status `pending`) and admin gets an email + in-app notification.
- No auto-reset email is sent to the buyer. Admin performs the reset from the admin panel; buyer receives the new password via email/SMS from admin.

## Admin Panel: Create & Manage Users

New pages under `/admin/users`:

1. **Create User** (`/admin/users/new`)
   - Fields: Business Name, Contact Person, Email, Phone, Business Type/Category, Notes.
   - System auto-generates: unique username (e.g. `sparkle_jewels01`) + strong random password.
   - Creates the auth user via Admin API (email pre-confirmed), inserts `profiles` row with `status='active'`, `must_change_password=true`.
   - Shows credentials once with Copy Username / Copy Password / Send Credentials (Email) buttons.

2. **Manage Users** (`/admin/users`)
   - Table: Username, Business Name, Email, Status badge (Active/Inactive), Date Created, Actions.
   - Actions per row: **Edit** details, **Deactivate/Reactivate** toggle, **Reset Password** (generates new strong password, shows + copy + email), **Send Credentials** (re-email current username + freshly reset password).

3. **Reset Password Flow (Admin)**
   - Select user → click Reset → system generates new password → displayed with copy → "Send to User" emails it. Sets `must_change_password=true`.

4. **Password Reset Requests inbox** (`/admin/users/requests`)
   - Lists pending buyer forgot-password requests with a one-click "Reset & Send" action.

## Database (migration)

- `profiles`: add `username text unique`, `status text default 'active' check in ('active','inactive')`, `must_change_password bool default false`, `business_name`, `contact_person`, `business_type`.
- `password_reset_requests` table: `id, user_id, email, status ('pending'|'resolved'), created_at, resolved_at, resolved_by`. RLS: user can insert own; admin can select/update all.
- `user_activity_log` table: `id, user_id, action, meta jsonb, created_at`. Logs login, password change, admin resets, status toggles. Admin-read only.
- Add GRANTs + RLS policies per Lovable rules.

## Server Functions (admin-only, `requireSupabaseAuth` + `has_role('admin')` check)

- `adminCreateUser({ businessName, contactPerson, email, phone, businessType })` → returns `{ username, password }`.
- `adminResetPassword({ userId })` → returns `{ password }`, sets `must_change_password=true`.
- `adminSetUserStatus({ userId, status })`.
- `adminSendCredentials({ userId, password })` → emails via Lovable email infra.
- `adminListUsers()`, `adminListResetRequests()`, `adminResolveResetRequest({ requestId })`.
- `submitPasswordResetRequest({ emailOrUsername })` (public) → inserts request + notifies admin.
- `changeOwnPassword({ newPassword })` → updates password, clears `must_change_password`, logs activity.

## Buyer-side New Route

- `/change-password` (authenticated, ungated by must-change flag) — form to set new password, then redirects home.

## Emails

- Auth email infra scaffold (if not already set) for: "Your Sparkling Silver credentials", "Your password has been reset", plus admin notification "New password reset request".

## Removals / Edits

- `src/routes/auth.tsx`: drop Sign Up tab and `SignUpForm`. Add inactive-account handling after successful sign-in.
- `handle_new_user` trigger: keep, but now only fires from admin-created users (still needed to seed `profiles`).

## Out of Scope (ask if needed)

- SMS delivery (needs a provider like Twilio — not built into Lovable).
- Username-based login (Supabase logs in by email; username shown for admin reference, login stays email-based). Say the word if you want true username login and I'll add an email-lookup shim.
