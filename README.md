# Study Buddy AI - Supabase Setup & Architecture

This document tracks the current architecture, setup requirements, and recent changes made to the Supabase backend (Edge Functions & Database).

## 1. Database (SQL) Changes

Recent security and integrity updates introduced new tables and RPC functions. If you are setting up a fresh environment, ensure the following SQL is executed in the Supabase SQL Editor:

### Duplicate Upvote Protection
To prevent users from upvoting the same forum post multiple times, a tracking table and a secure RPC function are used.

```sql
-- Table to track who upvoted which post to prevent duplicates
CREATE TABLE IF NOT EXISTS post_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS on the new table
ALTER TABLE post_upvotes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view upvotes
CREATE POLICY "Anyone can view upvotes" ON post_upvotes
  FOR SELECT USING (true);

-- Allow authenticated users to insert their own upvotes
CREATE POLICY "Users can insert their own upvotes" ON post_upvotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RPC function to safely increment upvote counts
CREATE OR REPLACE FUNCTION increment_post_upvotes(post_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE forum_posts
  SET upvotes = upvotes + 1
  WHERE id = post_id;
END;
$$;
```

---

## 2. Edge Functions

The project relies on two main Supabase Edge Functions: `study-ai` and `image-ai`.

### Security Architecture
*   **Authentication:** Both edge functions strictly require a valid user session. Requests must include the user's JWT in the `Authorization: Bearer <token>` header.
*   **CORS:** CORS headers are **inlined** into each function to allow easy deployment via the Supabase Dashboard (avoiding issues with shared module imports).
*   **Input Sanitization:** All prompt inputs are strictly sanitized to strip control characters and enforce max-length limits to prevent prompt injection.

### Required Secrets
Ensure the following secrets are added to your Supabase project (Settings → Edge Functions → Secrets):

*   `SUPABASE_URL`: Your project URL.
*   `SUPABASE_ANON_KEY`: Your project Anon key.
*   `GROQ_API_KEY`: Used by `study-ai` for high-speed LLM generation (Llama 3).
*   `GEMINI_API_KEY`: Used by `image-ai` for vision-based generation (Gemini 2.0 Flash).
*   `ALLOWED_ORIGIN`: (Optional) Set to your production domain (e.g., `https://aceprep.app`). Defaults to `*` if unset.

### Deployment Note
Since CORS headers are inlined, you do not need to upload the `_shared/cors.ts` folder if you are copy-pasting code into the Supabase Dashboard UI. Simply copy the contents of `supabase/functions/study-ai/index.ts` and `supabase/functions/image-ai/index.ts` directly.
