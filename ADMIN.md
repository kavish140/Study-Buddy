# Administrator dashboard

Open `/admin` after signing in as `kavishganatra5@gmail.com`. The navigation menu
shows an Admin tile only for that email. The account must have a confirmed email.
Every privileged RPC checks the authenticated user's current record in `auth.users`;
changing browser state, JWT email claims, or user metadata cannot grant access.
No service-role key is used in the frontend. Existing student RLS policies remain intact.

Apply `supabase/migrations/007_admin_dashboard.sql` to the same database used by
the app, after migrations 001–006. Deploy the frontend normally. Without the
migration, the page shows setup instructions and provides no privileged access.
Migration 007 has been applied and recorded on the currently linked Supabase
project. The frontend changes still require the normal application deployment.

The dashboard includes registrations over 30 days, total users, accounts whose
latest sign-in was in the past seven days, onboarding completion, exam selections,
saved topic performance, and per-table inventory. It does not estimate page views,
AI spend, or static imported question-bank totals.

Users can be searched by email or exact UUID, and onboarding can be reset.
Records can be searched across fields, inspected, and exported (25 rows per page).
Content records, including forum posts and replies, can be individually deleted
after confirmation. Profile, stats, and audit records are read-only in this interface.
Foreign-key constraints govern linked-record deletion; a failed delete is reported
without writing a success audit entry. The audit contains actor, action, table,
record ID and time, without copying private content into permanent audit history.

This does not provide account deletion/banning, email delivery, credential changes,
or infrastructure configuration. Those operations remain in the Supabase console.

Run `npm test`, `npx tsc --noEmit`, and `npm run build`. Run
`scripts/admin.integration.sql` in the Supabase SQL editor after the migration to
exercise database authorization and mutation auditing. The integration tests use
a transaction and roll back all fixtures and changes.
