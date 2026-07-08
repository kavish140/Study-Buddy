-- Previous Year Questions bank
CREATE TABLE IF NOT EXISTS pyq_questions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  exam_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'mcq',
  options JSONB DEFAULT '[]',
  answer TEXT NOT NULL DEFAULT '',
  explanation TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pyq_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pyq questions"
  ON pyq_questions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pyq questions"
  ON pyq_questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pyq questions"
  ON pyq_questions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_pyq_questions_user_id ON pyq_questions(user_id);
CREATE INDEX idx_pyq_questions_exam_id ON pyq_questions(exam_id);
CREATE INDEX idx_pyq_questions_year ON pyq_questions(year);
CREATE INDEX idx_pyq_questions_difficulty ON pyq_questions(difficulty);