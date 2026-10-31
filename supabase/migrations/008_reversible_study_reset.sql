BEGIN;
CREATE TABLE public.admin_study_backups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL,
 email text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 erased_at timestamptz,
 restored_at timestamptz,
 row_counts jsonb NOT NULL,
 snapshot jsonb
);
CREATE UNIQUE INDEX admin_study_backups_one_active ON public.admin_study_backups(user_id)
 WHERE erased_at IS NOT NULL AND restored_at IS NULL;
ALTER TABLE public.admin_study_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_study_backups FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.admin_study_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT ARRAY['subjects','quizzes','mock_tests','notes','plan_items','review_cards',
 'focus_sessions','performance_logs','chat_sessions','user_stats','pyq_questions',
 'question_selection_history']::text[];
$$;
REVOKE ALL ON FUNCTION public.admin_study_tables() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.admin_study_backup_status(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
 RETURN (SELECT to_jsonb(b) - 'snapshot' FROM public.admin_study_backups b
   WHERE user_id = p_user_id AND erased_at IS NOT NULL AND restored_at IS NULL LIMIT 1);
END;
$$;

CREATE FUNCTION public.admin_prepare_study_reset(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_email text; counts jsonb := '{}'; t text; n bigint; ticket public.admin_study_backups;
BEGIN
 IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 731));
 SELECT email INTO target_email FROM auth.users WHERE id = p_user_id AND deleted_at IS NULL;
 IF target_email IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
 IF EXISTS (SELECT 1 FROM public.admin_study_backups WHERE user_id = p_user_id AND erased_at IS NOT NULL AND restored_at IS NULL) THEN
   RAISE EXCEPTION 'Restore the existing backup before another study reset';
 END IF;
 FOREACH t IN ARRAY public.admin_study_tables() LOOP
   IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
     EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', t) INTO n USING p_user_id;
     counts := counts || jsonb_build_object(t, n);
   END IF;
 END LOOP;
 INSERT INTO public.admin_study_backups(user_id, actor_id, email, row_counts)
 VALUES(p_user_id, auth.uid(), target_email, counts) RETURNING * INTO ticket;
 RETURN (to_jsonb(ticket) - 'snapshot') || jsonb_build_object('wait_seconds', 10);
END;
$$;

CREATE FUNCTION public.admin_erase_study_data(p_backup_id uuid, p_confirmation text, p_acknowledged boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ticket public.admin_study_backups; t text; rows jsonb; saved jsonb := '{}'; counts jsonb := '{}';
BEGIN
 IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
 SELECT * INTO ticket FROM public.admin_study_backups WHERE id = p_backup_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reset request not found'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(ticket.user_id::text, 731));
 SELECT * INTO ticket FROM public.admin_study_backups WHERE id = p_backup_id FOR UPDATE;
 IF ticket.actor_id <> auth.uid() OR ticket.erased_at IS NOT NULL THEN RAISE EXCEPTION 'Reset request already used or unavailable'; END IF;
 IF clock_timestamp() < ticket.created_at + interval '10 seconds' THEN RAISE EXCEPTION 'Wait ten seconds before confirming'; END IF;
 IF clock_timestamp() > ticket.created_at + interval '15 minutes' THEN RAISE EXCEPTION 'Reset request expired. Review again'; END IF;
 IF p_confirmation IS DISTINCT FROM 'ERASE ' || ticket.email OR p_acknowledged IS DISTINCT FROM true THEN RAISE EXCEPTION 'Type the exact confirmation and acknowledge the reset'; END IF;
 IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ticket.user_id AND email = ticket.email AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Account changed. Review again'; END IF;
 IF EXISTS (SELECT 1 FROM public.admin_study_backups WHERE user_id = ticket.user_id AND erased_at IS NOT NULL AND restored_at IS NULL) THEN RAISE EXCEPTION 'An unrestored backup already exists'; END IF;
 -- Short table locks give the backup and delete one consistent boundary, including
 -- concurrent client writes. Account-wide question reservations use the same lock.
 FOREACH t IN ARRAY public.admin_study_tables() LOOP
   IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
     EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', t);
   END IF;
 END LOOP;
 FOREACH t IN ARRAY public.admin_study_tables() LOOP
   IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
     EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) FROM public.%I r WHERE user_id = $1', t) INTO rows USING ticket.user_id;
     saved := saved || jsonb_build_object(t, rows);
     counts := counts || jsonb_build_object(t, jsonb_array_length(rows));
   END IF;
 END LOOP;
 IF counts IS DISTINCT FROM ticket.row_counts THEN RAISE EXCEPTION 'Study data changed since the preview. Close and review again'; END IF;
 -- Save every table before deleting any row, so cascades cannot escape the backup.
 UPDATE public.admin_study_backups SET snapshot = saved, erased_at = clock_timestamp() WHERE id = ticket.id;
 FOREACH t IN ARRAY public.admin_study_tables() LOOP
   IF saved ? t THEN EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', t) USING ticket.user_id; END IF;
 END LOOP;
 INSERT INTO public.question_history_state(user_id, accept_legacy) VALUES(ticket.user_id, false)
 ON CONFLICT(user_id) DO UPDATE SET accept_legacy = false;
 INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id)
 VALUES(auth.uid(), 'erase_study_data', 'admin_study_backups', ticket.id::text);
END;
$$;

CREATE FUNCTION public.admin_restore_study_data(p_backup_id uuid, p_confirmation text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ticket public.admin_study_backups; t text;
BEGIN
 IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
 SELECT * INTO ticket FROM public.admin_study_backups WHERE id = p_backup_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Backup not found'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(ticket.user_id::text, 731));
 SELECT * INTO ticket FROM public.admin_study_backups WHERE id = p_backup_id FOR UPDATE;
 IF ticket.erased_at IS NULL OR ticket.restored_at IS NOT NULL OR ticket.snapshot IS NULL THEN RAISE EXCEPTION 'Backup is not available for restore'; END IF;
 IF p_confirmation IS DISTINCT FROM 'RESTORE ' || ticket.email THEN RAISE EXCEPTION 'Type the exact restore confirmation'; END IF;
 FOREACH t IN ARRAY public.admin_study_tables() LOOP
   IF ticket.snapshot ? t THEN
     EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', t);
   END IF;
 END LOOP;
 FOREACH t IN ARRAY public.admin_study_tables() LOOP
   IF ticket.snapshot ? t THEN
     IF t = 'question_selection_history' THEN
       EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT DO NOTHING', t, t) USING ticket.snapshot->t;
     ELSE
       EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1)', t, t) USING ticket.snapshot->t;
     END IF;
   END IF;
 END LOOP;
 UPDATE public.admin_study_backups SET restored_at = clock_timestamp(), snapshot = NULL WHERE id = ticket.id;
 INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id)
 VALUES(auth.uid(), 'restore_study_data', 'admin_study_backups', ticket.id::text);
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'Restore conflicts with newer study records. Nothing was changed; the backup is retained. Resolve the conflicting records before retrying';
END;
$$;
REVOKE ALL ON FUNCTION public.admin_study_backup_status(uuid), public.admin_prepare_study_reset(uuid), public.admin_erase_study_data(uuid,text,boolean), public.admin_restore_study_data(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_study_backup_status(uuid), public.admin_prepare_study_reset(uuid), public.admin_erase_study_data(uuid,text,boolean), public.admin_restore_study_data(uuid,text) TO authenticated;
COMMIT;
