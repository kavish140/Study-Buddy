// Isolated UI fixtures: loopback only, synthetic account and no production data.
import { createServer } from "node:http";

const userId = "00000000-0000-4000-8000-000000000001";
const neetPreview = process.argv.includes("--neet");
const dailySessionPreview = process.argv.includes("--daily-session");
const coachRequests = [];
const reservedQuestions = new Set();
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
      exam_id: neetPreview ? "neet" : "jee-main",
      exam_name: neetPreview ? "NEET UG" : "JEE Main",
      target_date: "2028-01-01",
      selected_subjects: ["Physics", "Chemistry", neetPreview ? "Biology" : "Mathematics"],
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

if (dailySessionPreview) {
  tables.plan_items.push({
    id: "daily-task",
    user_id: userId,
    date: "2020-01-01",
    task: "Revise Newton’s laws and summarize the key ideas",
    done: false,
  });
  tables.performance_logs.push({
    user_id: userId,
    subject: "Physics",
    topic: "Laws of Motion",
    question_count: 5,
    correct_count: 1,
  });
}

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
  if (dailySessionPreview && url.pathname === "/fixture-coach-requests") {
    res.end(JSON.stringify(coachRequests));
    return;
  }
  if (dailySessionPreview && url.pathname === "/functions/v1/study-ai" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    if (payload.action === "dailySessionCoach") {
      const prompt = JSON.parse(payload.data.messages.at(-1).content);
      coachRequests.push({
        event: prompt.event,
        activity: prompt.activity,
        stage: prompt.session.stage,
        messageCount: payload.data.messages.length,
        hasHiddenKey:
          prompt.session.material &&
          ("answer" in prompt.session.material || "correctAnswer" in prompt.session.material),
      });
      if (coachRequests.length > 40) coachRequests.shift();
      const message =
        prompt.event === "possible_distraction"
          ? "We’ve stayed on this step for a little while. Try one small action: identify the concept you need, then tell me where you’re stuck. A short break is fine too."
          : prompt.studentRequest
            ? "Let’s take one small step. Identify the known quantities before choosing a formula; I’ll keep the answer hidden until you check your attempt."
            : prompt.session.stage === "summary"
              ? "You’ve finished this session. Your saved results show the work you completed; use the recap to choose what to revisit next."
              : "Let’s work through this step together. Try recalling the central idea first, then use the session controls when you’re ready. You can ask me for a hint anytime.";
      res.setHeader("Content-Type", "text/event-stream");
      res.end(
        `data: ${JSON.stringify({ choices: [{ delta: { content: message } }] })}\n\ndata: [DONE]\n\n`,
      );
      return;
    }
  }
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
  // Synthetic history only: exercise bank selection without contacting Supabase.
  if (url.pathname === "/rest/v1/rpc/reserve_question_groups" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { p_groups } = JSON.parse(body);
    const pending = new Set(reservedQuestions);
    const groups = [];
    for (const group of p_groups) {
      const ids = group.ids.filter((id) => !pending.has(id)).slice(0, group.count);
      if (!group.allow_partial && ids.length < group.count) {
        res.writeHead(400);
        res.end(JSON.stringify({ message: "Not enough unseen fixture questions" }));
        return;
      }
      ids.forEach((id) => pending.add(id));
      groups.push(ids);
    }
    pending.forEach((id) => reservedQuestions.add(id));
    res.end(JSON.stringify(groups));
    return;
  }
  if (url.pathname === "/rest/v1/rpc/reset_question_history" && req.method === "POST") {
    reservedQuestions.clear();
    res.end("null");
    return;
  }
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
  if (
    dailySessionPreview &&
    ["quizzes", "performance_logs", "plan_items", "review_cards"].includes(table)
  ) {
    const matches = (row) =>
      [...url.searchParams.entries()]
        .filter(([, value]) => value.startsWith("eq."))
        .every(([key, value]) => String(row[key]) === value.slice(3));
    let result = rows.filter(matches);
    if (req.method === "POST" || req.method === "PATCH") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const incoming = JSON.parse(body);
      if (req.method === "PATCH") result.forEach((row) => Object.assign(row, incoming));
      else {
        const previous = rows.find((row) =>
          incoming.id
            ? row.id === incoming.id
            : row.subject === incoming.subject && row.topic === incoming.topic,
        );
        if (previous) {
          Object.assign(previous, incoming);
          result = [previous];
        } else {
          rows.push(incoming);
          result = [incoming];
        }
      }
    }
    res.end(
      JSON.stringify(
        req.headers.accept?.includes("vnd.pgrst.object") ? (result[0] ?? null) : result,
      ),
    );
    return;
  }
  res.setHeader("Content-Range", `0-${Math.max(0, rows.length - 1)}/${rows.length}`);
  res.end(
    JSON.stringify(req.headers.accept?.includes("vnd.pgrst.object") ? (rows[0] ?? null) : rows),
  );
}).listen(54321, "127.0.0.1", () =>
  console.log("Fixture login: http://127.0.0.1:54321/fixture-login"),
);
