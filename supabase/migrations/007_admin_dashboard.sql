-- All privileged operations authenticate against auth.users, never editable metadata.
BEGIN;
CREATE OR REPLACE FUNCTION public.is_app_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND lower(email) = 'kavishganatra5@gmail.com'
      AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL
      AND (banned_until IS NULL OR banned_until < now()));
$$;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;

-- A fixed allowlist bounds both SQL identifiers and the administrative surface.
CREATE FUNCTION public.admin_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT ARRAY['user_profiles','subjects','quizzes','mock_tests','notes','plan_items',
 'review_cards','focus_sessions','performance_logs','chat_sessions','user_stats',
 'pyq_questions','forum_posts','forum_replies','admin_audit_log']::text[];
$$;
REVOKE ALL ON FUNCTION public.admin_tables() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.admin_overview() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE counts jsonb := '{}'; t text; n bigint; signups jsonb; exams jsonb; performance jsonb;
BEGIN
 IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
 FOREACH t IN ARRAY public.admin_tables() LOOP
   IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
     EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
     counts := counts || jsonb_build_object(t, n);
   ELSE counts := counts || jsonb_build_object(t, NULL);
   END IF;
 END LOOP;
 SELECT jsonb_agg(x ORDER BY x.day) INTO signups FROM (
   SELECT d::date AS day, count(u.id) AS count
   FROM generate_series(current_date - 29, current_date, interval '1 day') d
   LEFT JOIN auth.users u ON u.created_at >= d AND u.created_at < d + interval '1 day' AND u.deleted_at IS NULL
   GROUP BY d
 ) x;
 SELECT coalesce(jsonb_agg(x), '[]') INTO exams FROM (
   SELECT exam_name AS name, count(*) AS count FROM public.user_profiles GROUP BY exam_name ORDER BY count(*) DESC
 ) x;
 SELECT jsonb_build_object('questions', coalesce(sum(question_count), 0),
   'correct', coalesce(sum(correct_count), 0)) INTO performance FROM public.performance_logs;
 RETURN jsonb_build_object('counts', counts, 'signups', signups, 'exams', exams, 'performance', performance,
   'users', (SELECT count(*) FROM auth.users WHERE deleted_at IS NULL),
   'recent_signins', (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '7 days' AND deleted_at IS NULL),
   'onboarded', (SELECT count(*) FROM public.user_profiles WHERE onboarding_completed),
   'generated_at', now());
END;
$$;

CREATE FUNCTION public.admin_users(p_search text DEFAULT '', p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb; total bigint;
BEGIN
 IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
 IF p_page IS NULL OR p_page < 0 OR length(p_search) > 200 THEN RAISE EXCEPTION 'Invalid filter'; END IF;
 SELECT count(*) INTO total FROM auth.users WHERE deleted_at IS NULL AND (email ILIKE '%' || p_search || '%' OR id::text = p_search);
 SELECT coalesce(jsonb_agg(x), '[]') INTO result FROM (
   SELECT u.id, u.email, u.created_at, u.last_sign_in_at, p.exam_name, p.onboarding_completed
   FROM auth.users u LEFT JOIN public.user_profiles p ON p.user_id = u.id
   WHERE u.deleted_at IS NULL AND (u.email ILIKE '%' || p_search || '%' OR u.id::text = p_search)
   ORDER BY u.created_at DESC, u.id LIMIT 25 OFFSET p_page * 25
 ) x;
 RETURN jsonb_build_object('rows', result, 'total', total);
END;
$$;

CREATE FUNCTION public.admin_records(p_table text, p_search text DEFAULT '', p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb; total bigint;
BEGIN
 IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
 IF p_table IS NULL OR NOT (p_table = ANY(public.admin_tables())) OR p_page IS NULL OR p_page < 0 OR length(p_search) > 200 THEN RAISE EXCEPTION 'Invalid filter'; END IF;
 IF to_regclass(format('public.%I', p_table)) IS NULL THEN RAISE EXCEPTION 'Table is not installed'; END IF;
 EXECUTE format('SELECT count(*) FROM public.%I t WHERE to_jsonb(t)::text ILIKE $1', p_table)
 INTO total USING '%' || p_search || '%';
 EXECUTE format('SELECT coalesce(jsonb_agg(r), ''[]''::jsonb) FROM (SELECT to_jsonb(t) AS r FROM public.%I t WHERE to_jsonb(t)::text ILIKE $1 ORDER BY t.id LIMIT 25 OFFSET $2) s', p_table)
 INTO result USING '%' || p_search || '%', p_page * 25;
 RETURN jsonb_build_object('rows', result, 'total', total);
END;
$$;

CREATE FUNCTION public.admin_delete_record(p_table text, p_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE affected bigint;
BEGIN
 IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
 IF p_table IS NULL OR NOT (p_table = ANY(public.admin_tables())) OR p_table IN ('admin_audit_log', 'user_profiles', 'user_stats') THEN RAISE EXCEPTION 'Deletion not allowed'; END IF;
 EXECUTE format('DELETE FROM public.%I WHERE id::text = $1', p_table) USING p_id;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 1 THEN RAISE EXCEPTION 'Record no longer exists'; END IF;
 INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id) VALUES (auth.uid(), 'delete', p_table, p_id);
END;
$$;

CREATE FUNCTION public.admin_reset_onboarding(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.is_app_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501'; END IF;
 UPDATE public.user_profiles SET onboarding_completed = false WHERE user_id = p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'User has no profile'; END IF;
 INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id) VALUES (auth.uid(), 'reset_onboarding', 'user_profiles', p_user_id::text);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_overview(), public.admin_users(text, integer), public.admin_records(text, text, integer), public.admin_delete_record(text, text), public.admin_reset_onboarding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview(), public.admin_users(text, integer), public.admin_records(text, text, integer), public.admin_delete_record(text, text), public.admin_reset_onboarding(uuid) TO authenticated;
COMMIT;
