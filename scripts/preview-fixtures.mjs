// Isolated UI fixtures: loopback only, synthetic account and no production data.
import { createServer } from "node:http";

const userId = "00000000-0000-4000-8000-000000000001";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "preview@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400 })}.fixture`;
const question = {
  question: "Explain how Newton’s second law applies to a block pulled along a rough surface.",
  options: ["$F=ma$", "$F=mv$", "$F=m/a$", "$F=a/m$"],
  answerIndex: 0,
  explanation: "Resolve all forces and use $F_{net}=ma$.",
};
const tables = {
  user_profiles: [
    {
      id: "profile",
      user_id: userId,
      display_name: "Preview Student",
      exam_id: "jee-main",
      exam_name: "JEE Main",
      target_date: "2028-01-01",
      selected_subjects: ["Physics", "Chemistry", "Mathematics"],
      onboarding_completed: true,
    },
  ],
  user_stats: [
    {
      id: "stats",
      user_id: userId,
      xp: 315,
      level: 3,
      current_streak: 1,
      longest_streak: 1,
      badges: [],
    },
  ],
  subjects: [
    {
      id: "physics",
      user_id: userId,
      name: "Physics",
      color: "#3b82f6",
      topics: [{ id: "motion", name: "Newton’s laws of motion", done: false }],
    },
  ],
  quizzes: [
    {
      id: "quiz",
      user_id: userId,
      topic:
        "A long quiz title about Newton’s laws of motion and resolving forces on an inclined plane",
      createdAt: Date.now(),
      questions: [question],
    },
  ],
  notes: [
    {
      id: "note",
      user_id: userId,
      topic: "Newton’s laws",
      summary: "Use $F=ma$ to calculate acceleration. LongUnbrokenText" + "x".repeat(100),
      flashcards: [{ q: "State Newton’s second law", a: "$F=ma$" }],
      createdAt: Date.now(),
    },
  ],
  review_cards: [
    {
      id: "card",
      user_id: userId,
      question: question.question.repeat(4),
      answer: question.explanation.repeat(12),
      explanation: "Long explanations must stay inside the flashcard.",
      ease_factor: 2.5,
      interval_days: 1,
      repetitions: 0,
      next_review: "2020-01-01",
    },
  ],
  plan_items: [],
  mock_tests: [],
  performance_logs: [],
  chat_sessions: [],
  focus_sessions: [],
  pyq_questions: [],
  forum_posts: [],
  forum_replies: [],
};

createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] ??
      "authorization,apikey,content-type,x-client-info,prefer,range,accept-profile,content-profile,x-retry-count,x-supabase-api-version",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1:54321");
  if (url.pathname === "/fixture-login") {
    res.writeHead(302, {
      Location: `http://127.0.0.1:5173/#access_token=${token}&refresh_token=fixture&expires_in=86400&token_type=bearer`,
    });
    res.end();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/auth/v1/user") {
    res.end(JSON.stringify(user));
    return;
  }
  if (url.pathname === "/auth/v1/token") {
    res.end(
      JSON.stringify({
        access_token: token,
        refresh_token: "fixture",
        expires_in: 86400,
        token_type: "bearer",
        user,
      }),
    );
    return;
  }
  if (url.pathname === "/auth/v1/settings") {
    res.end(JSON.stringify({ external: { google: true } }));
    return;
  }
  const table = url.pathname.split("/").at(-1);
  if (table === "chat_sessions" && req.method === "POST") {
    // Keep synthetic chats in memory so attachment previews can be tested across
    // the same create/refetch lifecycle as the real app, without production data.
    let body = "";
    for await (const chunk of req) body += chunk;
    const session = JSON.parse(body);
    const index = tables.chat_sessions.findIndex((row) => row.id === session.id);
    if (index < 0) tables.chat_sessions.push(session);
    else tables.chat_sessions[index] = session;
    res.end(JSON.stringify(req.headers.accept?.includes("vnd.pgrst.object") ? session : [session]));
    return;
  }
  const rows = tables[table] ?? [];
  res.setHeader("Content-Range", `0-${Math.max(0, rows.length - 1)}/${rows.length}`);
  res.end(
    JSON.stringify(req.headers.accept?.includes("vnd.pgrst.object") ? (rows[0] ?? null) : rows),
  );
}).listen(54321, "127.0.0.1", () =>
  console.log("Fixture login: http://127.0.0.1:54321/fixture-login"),
);
