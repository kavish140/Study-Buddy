-- Mock tests for timed exam simulations
CREATE TABLE IF NOT EXISTS mock_tests (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  exam_id TEXT NOT NULL,
  exam_name TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]',
  answers JSONB NOT NULL DEFAULT '{}',
  score NUMERIC,
  total_marks NUMERIC,
  time_taken_seconds INTEGER,
  total_time_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mock_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mock tests"
  ON mock_tests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mock tests"
  ON mock_tests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mock tests"
  ON mock_tests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_mock_tests_user_id ON mock_tests(user_id);
CREATE INDEX idx_mock_tests_status ON mock_tests(status);
