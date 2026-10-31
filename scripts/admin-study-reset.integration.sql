-- Owner-run integration test. Every fixture and mutation is rolled back.
BEGIN;
SELECT set_config('test.study_user', gen_random_uuid()::text, true);
INSERT INTO auth.users(id, email, email_confirmed_at, created_at, updated_at)
VALUES(current_setting('test.study_user')::uuid, 'study-reset-' || txid_current() || '@example.invalid', now(), now(), now());
INSERT INTO public.pyq_questions(id, user_id, exam_id, year, subject, question)
VALUES('reset-test-original-' || txid_current(), current_setting('test.study_user')::uuid, 'test', 2026, 'Test', 'Original study question');
INSERT INTO public.question_selection_history(user_id, question_id)
VALUES(current_setting('test.study_user')::uuid, 'reset-test-old-history');
INSERT INTO public.user_profiles(user_id, exam_id, exam_name, onboarding_completed)
VALUES(current_setting('test.study_user')::uuid, 'test', 'Test exam', true)
ON CONFLICT(user_id) DO UPDATE SET onboarding_completed = true;
INSERT INTO public.forum_posts(id, user_id, title, content)
VALUES('reset-test-community-' || txid_current(), current_setting('test.study_user')::uuid, 'Keep this post', 'Community is preserved');

DO $$ BEGIN
 IF has_function_privilege('anon', 'public.admin_prepare_study_reset(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'Anonymous reset access'; END IF;
 IF has_table_privilege('authenticated', 'public.admin_study_backups', 'SELECT') OR has_table_privilege('authenticated', 'public.admin_study_backups', 'UPDATE') THEN RAISE EXCEPTION 'Backup table exposed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', current_setting('test.study_user'), true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.admin_prepare_study_reset(auth.uid()); RAISE EXCEPTION 'Non-admin prepare access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_study_backup_status(auth.uid()); RAISE EXCEPTION 'Non-admin backup access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_erase_study_data(gen_random_uuid(), 'x', true); RAISE EXCEPTION 'Non-admin erase access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_restore_study_data(gen_random_uuid(), 'x'); RAISE EXCEPTION 'Non-admin restore access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', (SELECT id::text FROM auth.users WHERE lower(email) = 'kavishganatra5@gmail.com'), true);
SET LOCAL ROLE authenticated;
SELECT set_config('test.backup_id', (public.admin_prepare_study_reset(current_setting('test.study_user')::uuid)->>'id'), true);
DO $$ DECLARE email text; BEGIN
 -- The test uses the preview's email without querying auth.users as the caller.
 SELECT public.admin_prepare_study_reset(current_setting('test.study_user')::uuid)->>'email' INTO email;
 BEGIN PERFORM public.admin_erase_study_data(current_setting('test.backup_id')::uuid, 'ERASE ' || email, true); RAISE EXCEPTION 'Delay not enforced';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Wait ten seconds before confirming' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE public.admin_study_backups SET created_at = clock_timestamp() - interval '16 minutes' WHERE id = current_setting('test.backup_id')::uuid;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.admin_erase_study_data(current_setting('test.backup_id')::uuid, 'x', true); RAISE EXCEPTION 'Expired reset accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Reset request expired. Review again' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE public.admin_study_backups SET created_at = clock_timestamp() - interval '11 seconds' WHERE id = current_setting('test.backup_id')::uuid;
INSERT INTO public.pyq_questions(id, user_id, exam_id, year, subject, question)
VALUES('reset-test-changed-' || txid_current(), current_setting('test.study_user')::uuid, 'test', 2026, 'Test', 'Changed after preview');
SET LOCAL ROLE authenticated;
DO $$ DECLARE email text; BEGIN
 SELECT public.admin_prepare_study_reset(current_setting('test.study_user')::uuid)->>'email' INTO email;
 BEGIN PERFORM public.admin_erase_study_data(current_setting('test.backup_id')::uuid, 'ERASE ' || email, true); RAISE EXCEPTION 'Changed preview accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Study data changed since the preview. Close and review again' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DELETE FROM public.pyq_questions WHERE id = 'reset-test-changed-' || txid_current();
SET LOCAL ROLE authenticated;
DO $$ DECLARE email text; BEGIN
 SELECT public.admin_prepare_study_reset(current_setting('test.study_user')::uuid)->>'email' INTO email;
 BEGIN PERFORM public.admin_erase_study_data(current_setting('test.backup_id')::uuid, 'WRONG', true); RAISE EXCEPTION 'Confirmation not enforced';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Type the exact confirmation and acknowledge the reset' THEN RAISE; END IF; END;
 BEGIN PERFORM public.admin_erase_study_data(current_setting('test.backup_id')::uuid, 'ERASE ' || email, false); RAISE EXCEPTION 'Acknowledgment not enforced';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Type the exact confirmation and acknowledge the reset' THEN RAISE; END IF; END;
 PERFORM public.admin_erase_study_data(current_setting('test.backup_id')::uuid, 'ERASE ' || email, true);
 IF public.admin_study_backup_status(current_setting('test.study_user')::uuid) IS NULL THEN RAISE EXCEPTION 'Backup not discoverable'; END IF;
 BEGIN PERFORM public.admin_prepare_study_reset(current_setting('test.study_user')::uuid); RAISE EXCEPTION 'Overlapping reset allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Restore the existing backup before another study reset' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ DECLARE t text; n bigint; BEGIN
 FOREACH t IN ARRAY public.admin_study_tables() LOOP
  IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
   EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', t) INTO n USING current_setting('test.study_user')::uuid;
   IF n <> 0 THEN RAISE EXCEPTION 'Reset left study records in %', t; END IF;
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id = current_setting('test.study_user')::uuid AND onboarding_completed) THEN RAISE EXCEPTION 'Profile changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.forum_posts WHERE id = 'reset-test-community-' || txid_current()) THEN RAISE EXCEPTION 'Community changed'; END IF;
 IF (SELECT accept_legacy FROM public.question_history_state WHERE user_id = current_setting('test.study_user')::uuid) THEN RAISE EXCEPTION 'Legacy history can resurrect'; END IF;
END $$;
-- Simulate new work that conflicts with a saved record; restore must be atomic.
INSERT INTO public.pyq_questions(id, user_id, exam_id, year, subject, question)
VALUES('reset-test-original-' || txid_current(), current_setting('test.study_user')::uuid, 'test', 2026, 'Test', 'New conflicting work');
SET LOCAL ROLE authenticated;
DO $$ DECLARE backup jsonb; BEGIN
 backup := public.admin_study_backup_status(current_setting('test.study_user')::uuid);
 BEGIN PERFORM public.admin_restore_study_data((backup->>'id')::uuid, 'RESTORE ' || (backup->>'email')); RAISE EXCEPTION 'Restore overwrote new work';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Restore conflicts with newer study records.%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_study_backups WHERE id = current_setting('test.backup_id')::uuid AND snapshot IS NOT NULL AND restored_at IS NULL) THEN RAISE EXCEPTION 'Failed restore lost backup'; END IF;
 IF EXISTS(SELECT 1 FROM public.question_selection_history WHERE user_id = current_setting('test.study_user')::uuid) THEN RAISE EXCEPTION 'Failed restore partially committed'; END IF;
END $$;
DELETE FROM public.pyq_questions WHERE id = 'reset-test-original-' || txid_current();
INSERT INTO public.pyq_questions(id, user_id, exam_id, year, subject, question)
VALUES('reset-test-new-' || txid_current(), current_setting('test.study_user')::uuid, 'test', 2026, 'Test', 'New work to retain');
INSERT INTO public.question_selection_history(user_id, question_id)
VALUES(current_setting('test.study_user')::uuid, 'reset-test-old-history'), (current_setting('test.study_user')::uuid, 'reset-test-new-history');
SET LOCAL ROLE authenticated;
DO $$ DECLARE backup jsonb; BEGIN
 backup := public.admin_study_backup_status(current_setting('test.study_user')::uuid);
 BEGIN PERFORM public.admin_restore_study_data((backup->>'id')::uuid, 'WRONG'); RAISE EXCEPTION 'Restore confirmation not enforced';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Type the exact restore confirmation' THEN RAISE; END IF; END;
 PERFORM public.admin_restore_study_data((backup->>'id')::uuid, 'RESTORE ' || (backup->>'email'));
 IF public.admin_study_backup_status(current_setting('test.study_user')::uuid) IS NOT NULL THEN RAISE EXCEPTION 'Consumed backup still active'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.pyq_questions WHERE user_id = current_setting('test.study_user')::uuid) <> 2 THEN RAISE EXCEPTION 'Restore lost original or new work'; END IF;
 IF (SELECT count(*) FROM public.question_selection_history WHERE user_id = current_setting('test.study_user')::uuid) <> 2 THEN RAISE EXCEPTION 'History merge failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin_study_backups WHERE id = current_setting('test.backup_id')::uuid AND snapshot IS NULL AND restored_at IS NOT NULL) THEN RAISE EXCEPTION 'Restored snapshot retained'; END IF;
 IF (SELECT count(*) FROM public.admin_audit_log WHERE target_id = current_setting('test.backup_id') AND action IN ('erase_study_data','restore_study_data')) <> 2 THEN RAISE EXCEPTION 'Missing audit events'; END IF;
END $$;
ROLLBACK;
SELECT 'Reversible study reset, friction, authorization, conflict safety and audit tests passed' AS result;
