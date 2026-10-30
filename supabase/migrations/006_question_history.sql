-- Account-wide reservations. Only authenticated RPCs may mutate history.
CREATE TABLE IF NOT EXISTS public.question_history_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  accept_legacy boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.question_selection_history (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id text NOT NULL CHECK (length(question_id) BETWEEN 1 AND 200),
  selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);
ALTER TABLE public.question_history_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_selection_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_history_state FROM anon, authenticated;
REVOKE ALL ON public.question_selection_history FROM anon, authenticated;
GRANT SELECT ON public.question_selection_history TO authenticated;
CREATE POLICY "Read own question selections" ON public.question_selection_history
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.reserve_question_groups(
  p_groups jsonb, p_legacy_ids text[] DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  account_id uuid := auth.uid();
  group_item jsonb;
  requested integer;
  allow_partial boolean;
  picked text[];
  available integer;
  response jsonb := '[]'::jsonb;
BEGIN
  IF account_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_groups) IS DISTINCT FROM 'array' OR jsonb_array_length(p_groups) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Invalid question groups';
  END IF;
  IF cardinality(p_legacy_ids) > 20000 THEN RAISE EXCEPTION 'Invalid legacy history'; END IF;
  -- Same account, across devices/tabs: selection, import and reset use one lock.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(account_id::text, 731));
  INSERT INTO public.question_history_state(user_id) VALUES (account_id) ON CONFLICT DO NOTHING;
  IF (SELECT accept_legacy FROM public.question_history_state WHERE user_id = account_id) THEN
    INSERT INTO public.question_selection_history(user_id, question_id)
      SELECT account_id, id FROM unnest(p_legacy_ids) AS legacy(id)
      WHERE length(id) BETWEEN 1 AND 200 ON CONFLICT DO NOTHING;
  END IF;
  FOR group_item IN SELECT value FROM jsonb_array_elements(p_groups) LOOP
    requested := (group_item->>'count')::integer;
    allow_partial := COALESCE((group_item->>'allow_partial')::boolean, false);
    IF requested IS NULL OR requested NOT BETWEEN 1 AND 100
       OR jsonb_typeof(group_item->'ids') IS DISTINCT FROM 'array'
       OR jsonb_array_length(group_item->'ids') > 20000 THEN
      RAISE EXCEPTION 'Invalid question group';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(group_item->'ids') AS item(value)
               WHERE jsonb_typeof(value) <> 'string' OR length(value #>> '{}') NOT BETWEEN 1 AND 200) THEN
      RAISE EXCEPTION 'Invalid question ID';
    END IF;
    SELECT COALESCE(array_agg(id), '{}'::text[]) INTO picked FROM (
      SELECT DISTINCT candidate.id FROM jsonb_array_elements_text(group_item->'ids') AS candidate(id)
      WHERE NOT EXISTS (SELECT 1 FROM public.question_selection_history AS history
                        WHERE history.user_id = account_id AND history.question_id = candidate.id)
    ) AS unseen;
    available := cardinality(picked);
    IF available < requested AND NOT allow_partial THEN
      RAISE EXCEPTION 'Only % unseen questions match; % requested. Choose fewer questions or broaden filters. To intentionally reuse questions, reset history in Question Bank.', available, requested;
    END IF;
    SELECT COALESCE(array_agg(id), '{}'::text[]) INTO picked FROM (
      SELECT id FROM unnest(picked) AS candidates(id) ORDER BY random() LIMIT requested
    ) AS shuffled;
    INSERT INTO public.question_selection_history(user_id, question_id)
      SELECT account_id, id FROM unnest(picked) AS selected(id);
    response := response || jsonb_build_array(to_jsonb(picked));
  END LOOP;
  RETURN response;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_question_history() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE account_id uuid := auth.uid();
BEGIN
  IF account_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(account_id::text, 731));
  INSERT INTO public.question_history_state(user_id, accept_legacy) VALUES (account_id, false)
    ON CONFLICT (user_id) DO UPDATE SET accept_legacy = false;
  DELETE FROM public.question_selection_history WHERE user_id = account_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_question_groups(jsonb, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_question_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_question_groups(jsonb, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_question_history() TO authenticated;
NOTIFY pgrst, 'reload schema';
