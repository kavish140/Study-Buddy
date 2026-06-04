-- Performance logs for analytics
CREATE TABLE IF NOT EXISTS performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  question_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_attempted TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, subject, topic)
);

ALTER TABLE performance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own logs"
  ON performance_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
  ON performance_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs"
  ON performance_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_performance_logs_user_id ON performance_logs(user_id);
