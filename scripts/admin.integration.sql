-- Execute as database owner. All changes are rolled back, including fixtures.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'kavishganatra5@gmail.com') THEN
   RAISE EXCEPTION 'Sign in with the administrator account before running this test';
 END IF;
 IF has_function_privilege('anon', 'public.admin_overview()', 'EXECUTE') THEN RAISE EXCEPTION 'Anonymous admin RPC access'; END IF;
 IF has_function_privilege('authenticated', 'public.admin_tables()', 'EXECUTE') THEN RAISE EXCEPTION 'Allowlist helper exposed'; END IF;
 IF has_table_privilege('authenticated', 'public.admin_audit_log', 'INSERT') OR has_table_privilege('authenticated', 'public.admin_audit_log', 'SELECT') THEN RAISE EXCEPTION 'Direct audit access'; END IF;
END $$;

-- A forged email claim with a different identity must not authorize any RPC.
SELECT set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', auth.uid(), 'email', 'kavishganatra5@gmail.com', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.is_app_admin() THEN RAISE EXCEPTION 'Forged email granted access'; END IF;
 BEGIN PERFORM public.admin_overview(); RAISE EXCEPTION 'Unauthorized overview'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_users(); RAISE EXCEPTION 'Unauthorized users'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_records('notes'); RAISE EXCEPTION 'Unauthorized records'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_delete_record('notes', 'missing'); RAISE EXCEPTION 'Unauthorized deletion'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_reset_onboarding(auth.uid()); RAISE EXCEPTION 'Unauthorized reset'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', (SELECT id::text FROM auth.users WHERE lower(email) = 'kavishganatra5@gmail.com'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', auth.uid(), 'role', 'authenticated')::text, true);
-- Verify the database's confirmation status is enforced, even with a valid identity.
UPDATE auth.users SET email_confirmed_at = NULL WHERE id = auth.uid();
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF public.is_app_admin() THEN RAISE EXCEPTION 'Unconfirmed administrator granted access'; END IF; END $$;
RESET ROLE;
UPDATE auth.users SET email_confirmed_at = now(), banned_until = NULL WHERE id = auth.uid();
UPDATE auth.users SET banned_until = now() + interval '1 day' WHERE id = auth.uid();
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF public.is_app_admin() THEN RAISE EXCEPTION 'Banned administrator granted access'; END IF; END $$;
RESET ROLE;
UPDATE auth.users SET banned_until = NULL WHERE id = auth.uid();

-- Create a disposable row for mutation and audit tests, inside this transaction.
INSERT INTO public.pyq_questions(id, user_id, exam_id, year, subject, question)
VALUES ('admin-integration-' || txid_current()::text, auth.uid(), 'test', 2026, 'Test', 'Transaction fixture');
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb; t text;
BEGIN
 IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Confirmed administrator denied'; END IF;
 result := public.admin_overview();
 IF jsonb_array_length(result->'signups') <> 30 THEN RAISE EXCEPTION 'Signup series invalid'; END IF;
 PERFORM public.admin_users('kavishganatra5@gmail.com', 0);
 IF EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid()) THEN
   PERFORM public.admin_reset_onboarding(auth.uid());
   IF (SELECT onboarding_completed FROM public.user_profiles WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'Onboarding reset failed'; END IF;
 END IF;
 FOREACH t IN ARRAY ARRAY['user_profiles','subjects','quizzes','mock_tests','notes','plan_items','review_cards','focus_sessions','performance_logs','chat_sessions','user_stats','pyq_questions','forum_posts','forum_replies','admin_audit_log'] LOOP
   IF (result->'counts'->t) <> 'null'::jsonb THEN PERFORM public.admin_records(t); END IF;
 END LOOP;
 BEGIN PERFORM public.admin_records('auth.users'); RAISE EXCEPTION 'Expected invalid table'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Invalid filter' THEN RAISE; END IF; END;
 BEGIN PERFORM public.admin_records('notes', '', -1); RAISE EXCEPTION 'Expected invalid page'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Invalid filter' THEN RAISE; END IF; END;
 BEGIN PERFORM public.admin_delete_record('admin_audit_log', 'x'); RAISE EXCEPTION 'Audit deletion accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Deletion not allowed' THEN RAISE; END IF; END;
 PERFORM public.admin_delete_record('pyq_questions', 'admin-integration-' || txid_current()::text);
 result := public.admin_records('admin_audit_log', 'admin-integration-' || txid_current()::text);
 IF (result->>'total')::integer <> 1 OR result->'rows'->0->>'action' <> 'delete' THEN RAISE EXCEPTION 'Missing mutation audit'; END IF;
 BEGIN PERFORM public.admin_delete_record('pyq_questions', 'admin-integration-' || txid_current()::text); RAISE EXCEPTION 'Missing record deletion accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Record no longer exists' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Admin authorization, analytics, table access, deletion and audit tests passed' AS result;
