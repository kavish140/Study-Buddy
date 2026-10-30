-- Every test is rolled back, including resets; no user history is changed.
BEGIN;
SELECT set_config('request.jwt.claim.sub', (SELECT id::text FROM auth.users ORDER BY created_at LIMIT 1), true);
DO $$ BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'An existing test account is required'; END IF;
  IF has_function_privilege('anon', 'public.reserve_question_groups(jsonb,text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous reservation access';
  END IF;
  IF has_table_privilege('authenticated', 'public.question_selection_history', 'INSERT') THEN
    RAISE EXCEPTION 'History writes must use reservations';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE first_ids jsonb; second_ids jsonb; partial_ids jsonb; before_count integer;
BEGIN
  -- This reset is private to the transaction and always rolled back.
  PERFORM public.reset_question_history();
  IF EXISTS (SELECT 1 FROM public.question_selection_history WHERE user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'RLS exposes another account';
  END IF;
  first_ids := public.reserve_question_groups('[{"ids":["test-a","test-b","test-c","test-d"],"count":2}]');
  second_ids := public.reserve_question_groups('[{"ids":["test-a","test-b","test-c","test-d"],"count":2}]');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(first_ids->0) a(id)
             JOIN jsonb_array_elements_text(second_ids->0) b(id) USING (id)) THEN
    RAISE EXCEPTION 'Reservations repeat';
  END IF;
  SELECT count(*) INTO before_count FROM public.question_selection_history;
  BEGIN
    PERFORM public.reserve_question_groups('[{"ids":["test-e"],"count":1},{"ids":["test-a"],"count":1}]');
    RAISE EXCEPTION 'Expected exhaustion';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Only % unseen questions match%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.question_selection_history) <> before_count THEN
    RAISE EXCEPTION 'Failed mock consumed a section';
  END IF;
  partial_ids := public.reserve_question_groups('[{"ids":["test-a","test-e"],"count":10,"allow_partial":true}]');
  IF partial_ids <> '[["test-e"]]'::jsonb THEN RAISE EXCEPTION 'Partial selection failed'; END IF;
  PERFORM public.reset_question_history();
  -- An old browser must not resurrect history after an account-wide reset.
  partial_ids := public.reserve_question_groups('[{"ids":["test-legacy"],"count":1}]', ARRAY['test-legacy']);
  IF partial_ids <> '[["test-legacy"]]'::jsonb THEN RAISE EXCEPTION 'Stale legacy import undoes reset'; END IF;
END $$;
RESET ROLE;
-- Legacy selections are imported before new reservations, when imports are open.
UPDATE public.question_history_state SET accept_legacy = true WHERE user_id = auth.uid();
SET LOCAL ROLE authenticated;
DO $$ DECLARE picked jsonb; BEGIN
  picked := public.reserve_question_groups('[{"ids":["test-import-legacy","test-import-new"],"count":1}]', ARRAY['test-import-legacy']);
  IF picked <> '[["test-import-new"]]'::jsonb THEN RAISE EXCEPTION 'Legacy migration failed'; END IF;
END $$;
RESET ROLE;
-- Simulate another signed-in account: no user_id argument is accepted by RPCs.
SELECT set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.question_selection_history) THEN RAISE EXCEPTION 'Account isolation failed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Question history transaction and access tests passed' AS result;
