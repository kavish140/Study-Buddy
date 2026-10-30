# Study Buddy AI - Supabase Setup & Architecture

This document tracks the current architecture, setup requirements, and recent changes made to the Supabase backend (Edge Functions & Database).

## Local development and recovery checks

Create a gitignored `.env.local` with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (the public anon or publishable key, never a service-role
key). The GitHub Pages build uses the corresponding repository Actions secrets.
Run `npm run dev` for local development, `npx tsc --noEmit` for type checks,
`npm test` for auth, AI transport, output validation, and Edge Function regression tests
(Node 24), and `npm run build` for production.

Auth recovery shows a retry screen after eight seconds while preserving the
stored session for a later successful refresh. Individual auth/database requests
time out after ten seconds; AI function requests allow two minutes. Login renders
without waiting for session recovery in a router loader, and checks Auth service
availability before redirecting to Google. Profile errors do not trigger onboarding.

After resuming Supabase, wait for Auth and PostgREST to report healthy, then reload
and sign in again if the old refresh token is invalid. Confirm the configured Google
provider, Supabase Site URL, and allowed redirect URLs include the production origin
`https://jee.sitenova.dev`. Local OAuth testing also requires an allowed localhost
redirect. Deployment is performed by the existing GitHub Pages workflow on a push to
`main`; local changes alone do not update production.

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

- **Authentication:** Both edge functions strictly require a valid user session. Requests must include the user's JWT in the `Authorization: Bearer <token>` header.
- **CORS:** CORS headers are **inlined** into each function to allow easy deployment via the Supabase Dashboard (avoiding issues with shared module imports).
- **Input Sanitization:** All prompt inputs are strictly sanitized to strip control characters and enforce max-length limits to prevent prompt injection.

### Required Secrets

Ensure the following secrets are added to your Supabase project (Settings → Edge Functions → Secrets):

- `SUPABASE_URL`: Your project URL.
- `SUPABASE_ANON_KEY`: Your project Anon key.
- `GROQ_API_KEY`: Used by `study-ai` for high-speed LLM generation (GPT-OSS 120B by default).
- `GEMINI_API_KEY`: Used by `image-ai` for vision-based generation (Gemini 3.8 Flash by default).
- `GROQ_MODEL`: Optional model override; defaults to `openai/gpt-oss-120b` for both structured tools and streaming chat.
- `GEMINI_MODEL`: Optional vision/PDF model override; defaults to `gemini-3.8-flash`.
- `ALLOWED_ORIGIN`: (Optional) Set to your production domain (e.g., `https://aceprep.app`). Defaults to `*` if unset.

### Deployment Note

Since CORS headers are inlined, you do not need to upload the `_shared/cors.ts` folder if you are copy-pasting code into the Supabase Dashboard UI. Simply copy the contents of `supabase/functions/study-ai/index.ts` and `supabase/functions/image-ai/index.ts` directly.

Deploy both AI functions with `supabase functions deploy study-ai image-ai --project-ref uxjcyqztqkhhiiqkorul --use-api`.
Keep JWT verification enabled. The functions also validate the caller's session.
Groq Llama 3.3 was retired for free/developer accounts on August 16, 2026, and Gemini
2.0 Flash was retired on June 1, 2026; old deployments must be redeployed to pick up
the replacement models. Provider failures now return error status codes; update the
frontend too so it displays their response bodies correctly.

For isolated layout QA, run `node scripts/preview-fixtures.mjs`, then launch Vite with
`VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_ANON_KEY=fixture-publishable-key`
in that process's environment. Open `http://127.0.0.1:54321/fixture-login` to use a
synthetic account with long sample content. Never use these fixture overrides for a
production build.

## Sourced question bank

Question generation has been removed from AI paths. Quizzes, mocks, diagnostics
and note flashcards select existing questions from the shipped bank. See
[QUESTION_BANK.md](QUESTION_BANK.md) for coverage, sources, exclusions, update
instructions and the review of larger datasets. Run `npm run questions:sync` to
rebuild the pinned snapshots. Frontend and Edge Function updates must be deployed
together: older frontend clients still request the now-disabled generation actions.
