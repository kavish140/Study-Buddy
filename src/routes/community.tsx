import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { streamChat } from "@/lib/ai.functions";
import { type ForumPost, type ForumReply } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Users,
  Plus,
  MessageSquare,
  ThumbsUp,
  CheckCircle2,
  Sparkles,
  ChevronLeft,
  Send,
  Loader2,
  Clock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTutorial } from "@/components/TutorialProvider";
import { MarkdownContent } from "@/components/MarkdownContent";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community · AcePrep" },
      {
        name: "description",
        content: "Ask questions, share solutions, and discuss exam topics with other students",
      },
    ],
  }),
  component: CommunityPage,
});

const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "General"];
const EXAMS = [
  { id: "jee-main", label: "JEE Main" },
  { id: "jee-advanced", label: "JEE Advanced" },
  { id: "neet", label: "NEET" },
  { id: "upsc", label: "UPSC" },
  { id: "cat", label: "CAT" },
];

/** Bug fix #3: Resolve a raw exam slug to its human-readable display label. */
function examLabel(examId?: string): string {
  if (!examId) return "";
  return EXAMS.find((e) => e.id === examId)?.label ?? examId.toUpperCase();
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CommunityPage() {
  const qc = useQueryClient();
  const [activePost, setActivePost] = useState<string | null>(null);
  const [examFilter, setExamFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { triggerPageTour } = useTutorial();

  useEffect(() => {
    triggerPageTour("community");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["forumPosts", examFilter, subjectFilter],
    queryFn: () =>
      api.getForumPosts({
        exam_id: examFilter || undefined,
        subject: subjectFilter || undefined,
      }),
  });

  if (activePost) {
    return <PostDetail postId={activePost} onBack={() => setActivePost(null)} />;
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow-sm">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Community</h1>
            <p className="text-sm text-muted-foreground">Ask doubts · share solutions · discuss</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-gradient-primary gap-2"
          data-tour="tour-community-post"
        >
          <Plus className="h-4 w-4" /> New Post
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setExamFilter("")}
          className={cn(
            "px-3 py-1 rounded-full text-xs border transition-all",
            !examFilter ? "border-primary/30" : "border-border text-muted-foreground",
          )}
          style={
            !examFilter
              ? { background: "var(--accent)", color: "var(--primary)" }
              : { background: "var(--muted)" }
          }
        >
          All exams
        </button>
        {EXAMS.map((e) => (
          <button
            key={e.id}
            onClick={() => setExamFilter(e.id === examFilter ? "" : e.id)}
            className={cn(
              "px-3 py-1 rounded-full text-xs border transition-all",
              examFilter === e.id
                ? "border-primary/30"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
            style={
              examFilter === e.id
                ? { background: "var(--accent)", color: "var(--primary)" }
                : { background: "var(--muted)" }
            }
          >
            {e.label}
          </button>
        ))}
        <div className="w-px bg-border" />
        {SUBJECTS.map((s) => (
          <button
            key={s}
            onClick={() => setSubjectFilter(s === subjectFilter ? "" : s)}
            className={cn(
              "px-3 py-1 rounded-full text-xs border transition-all",
              subjectFilter === s
                ? "border-primary/30"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
            style={
              subjectFilter === s
                ? { background: "var(--accent)", color: "var(--primary)" }
                : { background: "var(--muted)" }
            }
          >
            {s}
          </button>
        ))}
      </div>

      {/* Posts list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 card-light rounded-xl animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="card-light rounded-2xl p-12 text-center">
          <MessageSquare className="h-12 w-12 text-primary/20 mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">No discussions yet</p>
          <p className="text-sm text-muted-foreground mb-6">Be the first to start a discussion!</p>
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-primary gap-2">
            <Plus className="h-4 w-4" /> Ask a question
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => setActivePost(post.id)}
              className="w-full card-light rounded-xl p-4 text-left hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {post.exam_id && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full border"
                        style={{
                          background: "var(--feat-community-bg)",
                          color: "var(--feat-community)",
                          borderColor: "var(--feat-community-bg)",
                        }}
                      >
                        {examLabel(post.exam_id)}
                      </span>
                    )}
                    {post.subject && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full border"
                        style={{
                          background: "var(--feat-community-bg)",
                          color: "var(--feat-community)",
                          borderColor: "var(--feat-community-bg)",
                        }}
                      >
                        {post.subject}
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.content}</p>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ThumbsUp className="h-3 w-3" /> {post.upvotes}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" /> {post.reply_count}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                    {timeAgo(post.created_at)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create post modal */}
      {showCreate && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            qc.invalidateQueries({ queryKey: ["forumPosts"] });
            setActivePost(id);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function PostDetail({ postId, onBack }: { postId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  // Bug fix #1: track upvote state to show interactive feedback
  const [upvoted, setUpvoted] = useState(false);
  const [upvoting, setUpvoting] = useState(false);

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ["forumPost", postId],
    queryFn: () => api.getForumPost(postId),
  });
  const { data: replies = [] } = useQuery({
    queryKey: ["forumReplies", postId],
    queryFn: () => api.getForumReplies(postId),
  });

  const handleReply = useCallback(async () => {
    if (!reply.trim()) return;
    setSubmitting(true);
    try {
      await api.createForumReply(postId, reply.trim());
      setReply("");
      qc.invalidateQueries({ queryKey: ["forumReplies", postId] });
      qc.invalidateQueries({ queryKey: ["forumPosts"] });
      qc.invalidateQueries({ queryKey: ["forumPost", postId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  }, [reply, postId, qc]);

  // Bug fix #4: Ctrl+Enter / Cmd+Enter submits the reply
  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleReply();
    }
  };

  // Upvote the post using optimistic cache update
  const handleUpvote = async () => {
    if (upvoted || upvoting || !post) return;
    setUpvoting(true);
    // Optimistically update the cache so the count reflects immediately
    qc.setQueryData(["forumPost", postId], (old: ForumPost | null | undefined) =>
      old ? { ...old, upvotes: (old.upvotes ?? 0) + 1 } : old,
    );
    setUpvoted(true);
    try {
      await api.upvotePost(post.id);
      // Refetch to sync with server (the optimistic +1 should match)
      qc.invalidateQueries({ queryKey: ["forumPost", postId] });
      qc.invalidateQueries({ queryKey: ["forumPosts"] });
    } catch (e) {
      // Rollback optimistic update
      qc.setQueryData(["forumPost", postId], (old: ForumPost | null | undefined) =>
        old ? { ...old, upvotes: (old.upvotes ?? 0) - 1 } : old,
      );
      setUpvoted(false);
      toast.error("Failed to upvote");
    } finally {
      setUpvoting(false);
    }
  };

  // Bug fix #2: accept a reply as the correct answer
  const handleAcceptReply = async (replyId: string) => {
    try {
      await api.acceptReply(replyId);
      qc.invalidateQueries({ queryKey: ["forumReplies", postId] });
      toast.success("Reply marked as accepted!");
    } catch (e) {
      toast.error("Failed to accept reply");
    }
  };

  const handleAskAI = async () => {
    if (!post) return;
    setAiLoading(true);
    setAiAnswer("");
    try {
      const prompt = `A student asked: "${post.title}"\n\n${post.content}\n\nProvide a thorough, step-by-step explanation at JEE/competitive exam level. Use markdown formatting.`;
      await streamChat({
        messages: [{ role: "user", content: prompt }],
        examName: post.exam_id || "JEE Main",
        source: "community",
        onChunk: (chunk) => setAiAnswer((a) => a + chunk),
        onDone: () => setAiLoading(false),
      });
    } catch (e) {
      toast.error("AI failed to respond");
      setAiLoading(false);
    }
  };

  // Bug fix #6: separate loading spinner from "post not found" state
  if (postLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Post not found or has been deleted.</p>
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to community
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back to community
      </button>

      {/* Post */}
      <div className="card-light rounded-2xl p-6 mb-6">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.exam_id && (
            <span
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{
                background: "var(--feat-community-bg)",
                color: "var(--feat-community)",
                borderColor: "var(--feat-community-bg)",
              }}
            >
              {/* Bug fix #3: use examLabel() instead of raw .toUpperCase() on the slug */}
              {examLabel(post.exam_id)}
            </span>
          )}
          {post.subject && (
            <span
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{
                background: "var(--feat-community-bg)",
                color: "var(--feat-community)",
                borderColor: "var(--feat-community-bg)",
              }}
            >
              {post.subject}
            </span>
          )}
          {post.topic && <span className="text-xs text-muted-foreground">{post.topic}</span>}
        </div>
        <h1 className="text-xl font-bold font-heading mb-3">{post.title}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
          {/* Bug fix #1: upvote button is now interactive */}
          <button
            onClick={handleUpvote}
            disabled={upvoted || upvoting}
            title={upvoted ? "Already upvoted" : "Upvote this post"}
            className={cn(
              "flex items-center gap-1.5 text-sm transition-colors",
              upvoted ? "cursor-default" : "text-muted-foreground cursor-pointer",
            )}
            style={upvoted ? { color: "var(--feat-community)" } : undefined}
            onMouseEnter={(e) => {
              if (!upvoted)
                (e.currentTarget as HTMLButtonElement).style.color = "var(--feat-community)";
            }}
            onMouseLeave={(e) => {
              if (!upvoted) (e.currentTarget as HTMLButtonElement).style.color = "";
            }}
          >
            {upvoting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ThumbsUp className={cn("h-3.5 w-3.5", upvoted && "fill-primary")} />
            )}
            {post.upvotes ?? 0} upvotes
          </button>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" /> {replies.length} replies
          </div>
          <div className="ml-auto">
            <Button
              onClick={handleAskAI}
              disabled={aiLoading}
              variant="outline"
              className="gap-2 text-sm border-primary/30 text-primary hover:bg-primary/10"
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Ask AI
            </Button>
          </div>
        </div>
      </div>

      {/* AI Answer */}
      {(aiAnswer || aiLoading) && (
        <div className="card-light rounded-2xl p-5 mb-6 border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI Answer</span>
            {aiLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
            )}
          </div>
          <div className="text-sm leading-relaxed">
            {aiAnswer ? (
              <MarkdownContent content={aiAnswer} />
            ) : (
              <span className="animate-pulse text-muted-foreground">Thinking…</span>
            )}
          </div>
        </div>
      )}

      {/* Replies */}
      <div className="space-y-3 mb-6">
        <h2 className="text-sm font-medium text-muted-foreground">{replies.length} Replies</h2>
        {replies.map((r) => (
          <div
            key={r.id}
            className={cn(
              "card-light rounded-xl p-4",
              r.is_accepted && "border border-emerald-500/30 bg-emerald-500/5",
            )}
          >
            {r.is_accepted && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 mb-2">
                <CheckCircle2 className="h-3.5 w-3.5" /> Accepted answer
              </div>
            )}
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.content}</p>
            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
              <span>
                <ThumbsUp className="inline h-3 w-3 mr-1" />
                {r.upvotes}
              </span>
              <span>{timeAgo(r.created_at)}</span>
              {/* Bug fix #2: Accept reply button */}
              {!r.is_accepted && (
                <button
                  onClick={() => handleAcceptReply(r.id)}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-600 transition-colors"
                  title="Mark as accepted answer"
                >
                  <CheckCircle2 className="h-3 w-3" /> Accept
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reply input */}
      <div className="card-light rounded-2xl p-4">
        <p className="text-sm font-medium mb-3">Add your reply</p>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={handleReplyKeyDown}
          placeholder="Share your solution or thoughts… (Ctrl+Enter to submit)"
          rows={4}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none placeholder:text-muted-foreground mb-3 border border-border"
          style={{ background: "var(--muted)" }}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleReply}
            disabled={submitting || !reply.trim()}
            className="bg-gradient-primary gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? "Posting…" : "Post Reply"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreatePostModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [examId, setExamId] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) return toast.error("Title and content are required");
    setSaving(true);
    try {
      const post = await api.createForumPost({
        title: title.trim(),
        content: content.trim(),
        exam_id: examId,
        subject,
        topic,
      });
      toast.success("Post created!");
      onCreated(post.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create post");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4">
      <div className="card-light rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Ask a Question</h2>
          <button onClick={onClose}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Question title *"
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none border border-border"
            style={{ background: "var(--muted)" }}
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your doubt in detail… *"
            rows={5}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none border border-border"
            style={{ background: "var(--muted)" }}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm outline-none border border-border text-foreground appearance-none cursor-pointer"
              style={{ background: "var(--muted)" }}
            >
              <option value="" className="bg-background text-foreground">
                Select exam
              </option>
              {EXAMS.map((e) => (
                <option key={e.id} value={e.id} className="bg-background text-foreground">
                  {e.label}
                </option>
              ))}
            </select>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm outline-none border border-border text-foreground appearance-none cursor-pointer"
              style={{ background: "var(--muted)" }}
            >
              <option value="" className="bg-background text-foreground">
                Select subject
              </option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s} className="bg-background text-foreground">
                  {s}
                </option>
              ))}
            </select>
          </div>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic (e.g. Rotational Motion)"
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none border border-border"
            style={{ background: "var(--muted)" }}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="flex-1 bg-gradient-primary">
            {saving ? "Posting…" : "Post Question"}
          </Button>
        </div>
      </div>
    </div>
  );
}
