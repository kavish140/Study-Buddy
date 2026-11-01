import { createFileRoute, useSearch, useNavigate, Link } from "@tanstack/react-router";
import { formatTimeIST } from "@/lib/date-utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Send,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  MessageSquare,
  ChevronLeft,
  Lightbulb,
  HelpCircle,
  BookOpen,
  User,
  Bot,
  FileText,
  Upload,
  X,
  Paperclip,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { streamChat, solveFromImage, solveFromPdf } from "@/lib/ai.functions";
import { compressImage, createImagePreview, extractPdfText, getFileType } from "@/lib/image-utils";
import { uid, type ChatSession, type ChatMessage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTutorial } from "@/components/TutorialProvider";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useAppContext } from "@/hooks/use-app-context";
import { pastedAttachment, validateChatAttachment } from "@/lib/chat-attachments";
import { PasteImageButton } from "@/components/PasteImageButton";
import { parseTutorTools, tutorToolTarget, TUTOR_TOOLS } from "@/lib/tutor-tools";
import { parseTutorResponse, formatTutorText } from "@/lib/tutor-interaction";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "AI Tutor \u2014 Study Buddy" },
      {
        name: "description",
        content:
          "Learn with your AI tutor through guided steps, hints, and interactive checkpoints.",
      },
    ],
  }),
  // Accept a 'q' search param so Community can deep-link with a pre-loaded question
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: ChatPage,
});

function ChatPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/chat" });
  const { q: deepLinkQ } = useSearch({ from: "/chat" });
  const { data: sessions = [] } = useQuery({
    queryKey: ["chatSessions"],
    queryFn: api.getChatSessions,
  });
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });
  const { contextSummary } = useAppContext();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  // Tracks a pending first message when creating a new session from empty state
  const [pendingFirstMsg, setPendingFirstMsg] = useState<string | null>(null);
  // Tracks a pending file (image/PDF) selected before a session exists
  const [pendingInitialFile, setPendingInitialFile] = useState<File | null>(null);
  const [pendingInitialDraft, setPendingInitialDraft] = useState("");
  const { triggerPageTour } = useTutorial();
  const deepLinkConsumedRef = useRef(false);
  // Local cache of image data-URLs keyed by "sessionId:messageIndex" so they
  // survive query cache invalidation (imageUrl is stripped before DB save).
  const imageUrlCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    triggerPageTour("chat");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Consume the deep-link ?q= param from Community once sessions have loaded
  useEffect(() => {
    if (!deepLinkQ || deepLinkConsumedRef.current || sessions === undefined) return;
    const decodedQ = decodeURIComponent(deepLinkQ);
    if (!decodedQ.trim()) return;
    deepLinkConsumedRef.current = true;
    // Clear the param from the URL so refreshing doesn't re-send
    navigate({ search: { q: undefined }, replace: true });
    // Reuse the existing flow that creates a session + sends first message
    handleSendFromEmpty(decodedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkQ, sessions]);

  const saveMutation = useMutation({
    mutationFn: api.saveChatSession,
    onError: (error) => toast.error(error.message || "Operation failed"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatSessions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteChatSession,
    onError: (error) => toast.error(error.message || "Operation failed"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatSessions"] }),
  });

  const rawActiveSession = sessions.find((s) => s.id === activeSessionId) || null;
  // Merge cached imageUrls back into the session so image previews survive DB re-fetches
  const activeSession = rawActiveSession
    ? {
        ...rawActiveSession,
        messages: rawActiveSession.messages.map((msg, i) => {
          if (msg.imageUrl) return msg; // already has it (in-memory update)
          const cached = imageUrlCacheRef.current.get(`${rawActiveSession.id}:${i}`);
          return cached ? { ...msg, imageUrl: cached } : msg;
        }),
      }
    : null;

  const handleNewChat = async () => {
    const newSession: ChatSession = {
      id: uid(),
      title: "New chat",
      exam_id: profile?.exam_id,
      messages: [],
    };
    await saveMutation.mutateAsync(newSession);
    setActiveSessionId(newSession.id);
    setShowSidebar(false);
  };

  // Called from EmptyState \u2014 creates session AND sends first message immediately
  const handleSendFromEmpty = (msg: string) => {
    const newSession: ChatSession = {
      id: uid(),
      title: Array.from(msg).slice(0, 50).join("") + (Array.from(msg).length > 50 ? "\u2026" : ""),
      exam_id: profile?.exam_id,
      messages: [],
    };
    // Set activeSessionId AND pendingFirstMsg only AFTER the session is persisted,
    // so ChatView never mounts before the session exists in the query cache.
    saveMutation.mutate(newSession, {
      onSuccess: () => {
        setActiveSessionId(newSession.id);
        setShowSidebar(false);
        setPendingFirstMsg(msg);
      },
    });
  };

  // Called from EmptyState when a file is selected — auto-creates a session then queues the file
  const handleFileFromEmpty = (file: File, draft = "") => {
    if (saveMutation.isPending) return;
    try {
      validateChatAttachment(file);
    } catch (error) {
      toast.error((error as Error).message);
      return;
    }
    const newSession: ChatSession = {
      id: uid(),
      title: "New chat",
      exam_id: profile?.exam_id,
      messages: [],
    };
    saveMutation.mutate(newSession, {
      onSuccess: () => {
        setActiveSessionId(newSession.id);
        setShowSidebar(false);
        setPendingInitialFile(file);
        setPendingInitialDraft(draft);
      },
    });
  };

  const handleDeleteChat = (id: string) => {
    deleteMutation.mutate(id);
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const handleUpdateSession = (session: ChatSession) => {
    queryClient.setQueryData<ChatSession[]>(["chatSessions"], (current = []) =>
      current.map((item) => (item.id === session.id ? session : item)),
    );
    // Cache imageUrls locally before stripping — the query invalidation on save
    // would otherwise wipe them since they aren't persisted to the DB.
    session.messages.forEach((msg, i) => {
      if (msg.imageUrl) {
        imageUrlCacheRef.current.set(`${session.id}:${i}`, msg.imageUrl);
      }
    });
    // Strip imageUrl from messages before persisting — data-URLs can be hundreds of KB
    // and bloat the Supabase row. The in-memory state retains the URL for display.
    const sanitized: ChatSession = {
      ...session,
      messages: session.messages.map(({ imageUrl: _stripped, ...rest }) => rest),
    };
    saveMutation.mutate(sanitized);
  };

  return (
    <div
      className="relative h-full min-h-0 min-w-0 flex flex-1 overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* \u2500\u2500 Sidebar */}
      <aside
        className={cn(
          "w-72 border-r border-border flex flex-col transition-all duration-300 absolute lg:relative z-20 h-full",
          showSidebar
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0 lg:w-0 lg:border-0 lg:overflow-hidden",
        )}
        style={{ background: "var(--sidebar)" }}
      >
        {/* Subtle top gradient shimmer */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-primary/8 to-transparent pointer-events-none" />

        <div className="p-3 border-b border-border shrink-0 relative" data-tour="tour-chat-new">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="font-semibold font-heading text-sm">Chat History</span>
          </div>
          {/* Full-width New Chat gradient button */}
          <button
            onClick={handleNewChat}
            data-tour="tour-chat-new"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-medium shadow-glow-sm hover:opacity-90 hover:shadow-glow active:scale-95 transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 gap-3 text-center">
              <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                <MessageSquare className="h-5 w-5 text-primary/40" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No conversations yet.
                <br />
                Start a new chat above!
              </p>
            </div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm border-l-2",
                activeSessionId === session.id
                  ? "pl-[10px]"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border-transparent",
              )}
              style={
                activeSessionId === session.id
                  ? {
                      background: "var(--feat-chat-bg)",
                      color: "var(--feat-chat)",
                      borderColor: "var(--feat-chat)",
                    }
                  : undefined
              }
              onClick={() => {
                setActiveSessionId(session.id);
                setShowSidebar(false);
              }}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">{session.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteChat(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {showSidebar && (
        <div
          className="fixed inset-0 backdrop-blur-sm z-10 lg:hidden"
          style={{ background: "rgba(0,0,0,0.25)" }}
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        {activeSession ? (
          <ChatView
            key={activeSession.id}
            session={activeSession}
            examName={profile?.exam_name}
            appContext={contextSummary}
            onUpdate={handleUpdateSession}
            onToggleSidebar={() => setShowSidebar(!showSidebar)}
            initialMessage={pendingFirstMsg ?? undefined}
            onInitialMessageConsumed={() => setPendingFirstMsg(null)}
            initialFile={pendingInitialFile ?? undefined}
            initialDraft={pendingInitialDraft}
            onInitialFileConsumed={() => {
              setPendingInitialFile(null);
              setPendingInitialDraft("");
            }}
          />
        ) : (
          <EmptyState
            onSend={handleSendFromEmpty}
            onToggleSidebar={() => setShowSidebar(!showSidebar)}
            onFileSelected={handleFileFromEmpty}
            creating={saveMutation.isPending}
          />
        )}
      </main>
    </div>
  );
}

/* \u2500\u2500\u2500 Empty State \u2500\u2500\u2500 */
function EmptyState({
  onSend,
  onToggleSidebar,
  onFileSelected,
  creating,
}: {
  onSend: (msg: string) => void;
  onToggleSidebar: () => void;
  onFileSelected: (file: File, draft?: string) => void;
  creating: boolean;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    onSend(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = [
    {
      icon: HelpCircle,
      text: "Help me understand electronegativity",
      sub: "Learn with checkpoints",
    },
    { icon: Lightbulb, text: "Guide me through projectile motion", sub: "One step at a time" },
    {
      icon: BookOpen,
      text: "Review the French Revolution with me",
      sub: "Explain it in your own words",
    },
    {
      icon: Sparkles,
      text: "Help me work through a JEE Math problem",
      sub: "Bring a question to solve together",
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Header */}
      <header
        className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0"
        style={{ background: "var(--background)", backdropFilter: "blur(20px)" }}
      >
        <button
          onClick={onToggleSidebar}
          className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center shadow-glow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-medium text-sm">Study Buddy AI Tutor</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
            Ready to help
          </div>
        </div>
      </header>

      {/* Hero area */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8 overflow-y-auto relative">
        {/* Background radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 65% 55% at 50% 40%, var(--feat-chat-bg), transparent 70%)",
          }}
        />

        <div className="text-center max-w-lg w-full relative">
          {/* Animated orb */}
          <div className="relative mx-auto mb-7 w-fit">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-primary opacity-[0.12] blur-2xl animate-pulse" />
            <div className="h-20 w-20 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow animate-orb-pulse relative">
              <Sparkles className="h-9 w-9 text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-bold font-heading mb-3 text-gradient">
            Study Buddy AI Tutor
          </h2>
          <p className="text-muted-foreground mb-10 text-sm leading-relaxed max-w-sm mx-auto">
            Learn by doing: work through one idea at a time, try each checkpoint, and get feedback
            on your reasoning. I can use your saved study progress and open practice, notes,
            planning, and review tools.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-10">
            {suggestedPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt.text)}
                className="card-light group p-4 rounded-2xl text-left hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div
                  className="h-7 w-7 rounded-lg grid place-items-center mb-2.5 transition-colors"
                  style={{ background: "var(--feat-chat-bg)" }}
                >
                  <prompt.icon className="h-3.5 w-3.5" style={{ color: "var(--feat-chat)" }} />
                </div>
                <div className="text-xs font-medium text-foreground leading-snug mb-0.5">
                  {prompt.text}
                </div>
                <div className="text-[11px] text-muted-foreground">{prompt.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div
        className="border-t border-border p-4 shrink-0"
        style={{ background: "var(--background)", backdropFilter: "blur(20px)" }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <label
              className="h-10 w-10 shrink-0 rounded-xl border border-border grid place-items-center cursor-pointer hover:border-primary/30 hover:bg-accent transition-all"
              style={{ background: "var(--muted)" }}
              title="Attach image or PDF — a new chat will be created automatically"
            >
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Auto-create a new session and queue the file for attachment
                    onFileSelected(file, input);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <div
              className="flex-1 min-w-0 rounded-2xl border border-border focus-within:border-primary/40 focus-within:shadow-glow-sm transition-all duration-200"
              style={{ background: "var(--muted)" }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={(e) => {
                  const file = pastedAttachment(e.clipboardData);
                  if (file) {
                    e.preventDefault();
                    onFileSelected(file, input);
                  }
                }}
                placeholder="Ask a question, or paste an image…"
                rows={1}
                autoFocus
                className="block w-full bg-transparent px-3 py-3 text-base sm:text-sm outline-none resize-none placeholder:text-muted-foreground"
              />
            </div>
            <PasteImageButton onFile={(file) => onFileSelected(file, input)} disabled={creating} />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="bg-gradient-primary h-10 w-10 shrink-0 rounded-xl p-0 shadow-glow-sm hover:shadow-glow transition-shadow disabled:opacity-40 disabled:shadow-none"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground/50 mt-2.5 flex items-center justify-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted/30 border border-border text-[10px] font-mono">
                Enter
              </kbd>{" "}
              send
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted/30 border border-border text-[10px] font-mono">
                Shift+Enter
              </kbd>{" "}
              new line
            </span>
            <span>Paste images · PDF max 7.5 MB</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* \u2500\u2500\u2500 Chat View \u2500\u2500\u2500 */
function ChatView({
  session,
  examName,
  appContext,
  onUpdate,
  onToggleSidebar,
  initialMessage,
  onInitialMessageConsumed,
  initialFile,
  initialDraft,
  onInitialFileConsumed,
}: {
  session: ChatSession;
  examName?: string;
  appContext?: string;
  onUpdate: (session: ChatSession) => void;
  onToggleSidebar: () => void;
  initialMessage?: string;
  onInitialMessageConsumed?: () => void;
  initialFile?: File;
  initialDraft?: string;
  onInitialFileConsumed?: () => void;
}) {
  const [input, setInput] = useState(initialDraft ?? "");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [pendingPdf, setPendingPdf] = useState<{ file: File; pageCount?: number } | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentInitialRef = useRef(false);
  const initialFileHandledRef = useRef(false);
  // AbortController for cancelling ongoing AI requests when session changes or component unmounts
  const abortRef = useRef<AbortController | null>(null);
  const requestInFlightRef = useRef(false);

  // Abort any in-flight AI request when the component unmounts or the session changes
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [session.id]);

  const scrollToBottom = useCallback((instant = false) => {
    // Use instant scroll during streaming to avoid jumpy smooth-scroll re-triggers
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom(isStreaming);
  }, [session.messages, streamingContent, isStreaming, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // Auto-send the first message if it came from the empty state
  useEffect(() => {
    if (initialMessage && !sentInitialRef.current) {
      sentInitialRef.current = true;
      onInitialMessageConsumed?.();
      handleSend(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  // Auto-attach a file queued from the empty state (image or PDF)
  useEffect(() => {
    if (initialFile && !initialFileHandledRef.current) {
      initialFileHandledRef.current = true;
      onInitialFileConsumed?.();
      handleFileSelect(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  // \u2500\u2500 Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFileSelect(file);
  };

  // \u2500\u2500 Unified file handler (images + PDFs)
  const handleFileSelect = async (file: File) => {
    const type = getFileType(file);
    if (type === "unsupported") {
      toast.error("Only images (JPG, PNG, WEBP) and PDFs are supported.");
      return;
    }
    try {
      validateChatAttachment(file);
    } catch (error) {
      toast.error((error as Error).message);
      return;
    }
    // Clear the other pending type
    setPendingPdf(null);
    setPendingImage(null);

    if (type === "image") {
      try {
        const previewUrl = await createImagePreview(file);
        setPendingImage({ file, previewUrl });
      } catch {
        toast.error("Unable to read this image. Try copying it again or attaching the saved file.");
      }
    } else {
      // PDF \u2014 extract page count immediately for the preview badge
      setPendingPdf({ file });
      try {
        const { pageCount } = await extractPdfText(file);
        setPendingPdf({ file, pageCount });
      } catch {
        // page count is optional, don't block
      }
    }
  };

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();

    // Prevent concurrent AI requests
    if (isStreaming || requestInFlightRef.current || (!msg && !pendingImage && !pendingPdf)) return;
    requestInFlightRef.current = true;

    try {
      // Abort any previous in-flight request before starting a new one
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // ── PDF flow
      if (pendingPdf) {
        const pdfFile = pendingPdf.file;
        const userMsg = msg || "Analyze this PDF: " + pdfFile.name;

        // Optimistic UI — show user message immediately
        const userMessage: ChatMessage = {
          role: "user",
          content:
            "**" + pdfFile.name + "** (" + (pendingPdf.pageCount ?? "?") + " pages)\n\n" + userMsg,
          timestamp: new Date().toISOString(),
        };
        const updatedMessages = [...session.messages, userMessage];
        const title =
          session.messages.length === 0
            ? "\ud83d\udcc4 " + pdfFile.name.slice(0, 40)
            : session.title;
        const updatedSession: ChatSession = { ...session, messages: updatedMessages, title };
        onUpdate(updatedSession);
        setInput("");
        setPendingPdf(null);
        setIsStreaming(true);
        setStreamingContent("");

        try {
          const { text, pageCount } = await extractPdfText(pdfFile);
          const isScanned = text.trim().length === 0;

          if (isScanned) {
            // Scanned / image-based PDF — send raw file to Gemini's native PDF reader
            toast.info(`📷 Scanned PDF detected — Gemini is reading all ${pageCount} pages…`);

            const result = await solveFromPdf({
              file: pdfFile,
              prompt: userMsg,
              examName,
              source: "chat",
              signal: controller.signal,
              appContext,
            });

            onUpdate({
              ...updatedSession,
              messages: [
                ...updatedMessages,
                {
                  role: "assistant",
                  content: result.response,
                  timestamp: new Date().toISOString(),
                },
              ],
            });
            setIsStreaming(false);
            setStreamingContent("");
          } else {
            // Digital PDF with a text layer — use existing streaming text flow
            const contextMsg = `The student has uploaded a PDF: "${pdfFile.name}" (${pageCount} pages).\n\nPDF CONTENT:\n${text.slice(0, 12000)}${text.length > 12000 ? "\n\n[...content truncated to first 12,000 characters...]" : ""}\n\nStudent's question: ${userMsg}\n\nBegin by restating the selected problem and its givens so we can refer to it in later turns, then guide one step at a time. If no problem is selected, ask which part to work on.`;

            const messagesWithPdf = [
              ...updatedMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
              { role: "user" as const, content: contextMsg },
            ];

            let fullResponse = "";
            await streamChat({
              messages: messagesWithPdf,
              examName,
              signal: controller.signal,
              source: "chat",
              appContext,
              onChunk: (chunk) => {
                fullResponse += chunk;
                setStreamingContent(fullResponse);
              },
              onDone: () => {
                onUpdate({
                  ...updatedSession,
                  messages: [
                    ...updatedMessages,
                    {
                      role: "assistant",
                      content: fullResponse,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                });
                setStreamingContent("");
                setIsStreaming(false);
              },
            });
          }
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // silently ignore aborted requests
          toast.error(e instanceof Error ? e.message : "Failed to read PDF");
          setIsStreaming(false);
          setStreamingContent("");
        }
        return;
      }

      // \u2500\u2500 Image flow
      if (pendingImage) {
        const imageFile = pendingImage;
        const userMsg = msg || "Guide me through this question from the image, one step at a time.";

        const userMessage: ChatMessage = {
          role: "user",
          content: userMsg,
          timestamp: new Date().toISOString(),
          imageUrl: imageFile.previewUrl,
        };

        const updatedMessages = [...session.messages, userMessage];
        const title =
          session.messages.length === 0
            ? "\ud83d\udcf7 " +
              Array.from(userMsg).slice(0, 45).join("") +
              (Array.from(userMsg).length > 45 ? "\u2026" : "")
            : session.title;

        const updatedSession: ChatSession = {
          ...session,
          messages: updatedMessages,
          title,
        };
        onUpdate(updatedSession);
        setInput("");
        setPendingImage(null);
        setIsAnalyzingImage(true);
        setIsStreaming(true);

        try {
          const { base64, mimeType } = await compressImage(imageFile.file);
          const result = await solveFromImage({
            imageBase64: base64,
            mimeType,
            prompt: userMsg,
            examName,
            source: "chat",
            signal: controller.signal,
            appContext,
          });

          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: result.response,
            timestamp: new Date().toISOString(),
          };

          onUpdate({
            ...updatedSession,
            messages: [...updatedMessages, assistantMessage],
          });
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // silently ignore aborted requests
          toast.error(e instanceof Error ? e.message : "Failed to analyze image");
        } finally {
          setIsStreaming(false);
          setIsAnalyzingImage(false);
        }
        return;
      }

      // Regular text-only flow
      if (!msg || isStreaming) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: msg,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...session.messages, userMessage];

      // Update title on first message
      const title =
        session.messages.length === 0
          ? Array.from(msg).slice(0, 50).join("") + (Array.from(msg).length > 50 ? "\u2026" : "")
          : session.title;

      const updatedSession: ChatSession = {
        ...session,
        messages: updatedMessages,
        title,
      };
      onUpdate(updatedSession);
      setInput("");
      setIsStreaming(true);
      setStreamingContent("");

      try {
        let fullResponse = "";

        await streamChat({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          examName,
          source: "chat",
          signal: controller.signal,
          appContext,
          onChunk: (chunk) => {
            fullResponse += chunk;
            setStreamingContent(fullResponse);
          },
          onDone: () => {
            const assistantMessage: ChatMessage = {
              role: "assistant",
              content: fullResponse,
              timestamp: new Date().toISOString(),
            };

            const finalSession: ChatSession = {
              ...updatedSession,
              messages: [...updatedMessages, assistantMessage],
            };
            onUpdate(finalSession);
            setStreamingContent("");
            setIsStreaming(false);
          },
        });
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // silently ignore aborted requests
        toast.error(e instanceof Error ? e.message : "Failed to get response");
        setIsStreaming(false);
        setStreamingContent("");
      }
    } finally {
      requestInFlightRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    {
      label: "Give me a hint",
      prompt:
        "I'm stuck on the current checkpoint. Give me one small hint and let me try again without revealing the answer.",
      icon: HelpCircle,
    },
    {
      label: "Explain simpler",
      prompt:
        "Re-explain the current step using a simpler approach or analogy, then let me try it.",
      icon: Lightbulb,
    },
    {
      label: "Show full solution",
      prompt:
        "Please show the full explanation or worked solution for the current material, including the reasoning for each step.",
      icon: BookOpen,
    },
    {
      label: "Recap what I learned",
      prompt:
        "Briefly recap the key ideas we covered, what my attempts showed, and what I should review next.",
      icon: HelpCircle,
    },
  ];

  return (
    <>
      {/* Drag & Drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md pointer-events-none">
          <div className="chat-dnd-border flex flex-col items-center justify-center gap-4 p-14 rounded-3xl">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 grid place-items-center">
              <Upload className="h-8 w-8 text-primary animate-bounce" />
            </div>
            <p className="text-lg font-semibold text-primary">Drop your file here</p>
            <p className="text-sm text-muted-foreground">Supports JPG, PNG, WEBP, PDF</p>
          </div>
        </div>
      )}

      {/* Chat header */}
      <header
        className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0"
        style={{ background: "var(--background)", backdropFilter: "blur(20px)" }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <button
          onClick={onToggleSidebar}
          className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center shadow-glow-sm shrink-0">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{session.title}</div>
          <div className="text-xs flex items-center gap-1.5">
            {isStreaming ? (
              <span className="flex items-center gap-1 text-primary">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" style={{ animationDelay: "0.15s" }} />
                <span className="chat-typing-dot" style={{ animationDelay: "0.30s" }} />
                <span className="ml-1 text-primary/80">
                  {isAnalyzingImage ? "Analyzing image..." : "Thinking..."}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                {examName ? examName + " \u00b7 " : ""}Study Buddy AI
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Messages \u2014 also a drop target */}
      <div
        className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {session.messages.length === 0 && !isStreaming && (
            <div className="text-center py-16">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-3">
                <Sparkles className="h-6 w-6 text-primary/40" />
              </div>
              <p className="text-sm text-muted-foreground">
                Pick a topic or share a problem. We'll work through it together.
              </p>
            </div>
          )}

          {session.messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              active={i === session.messages.length - 1 && !isStreaming}
              onAnswer={(answer) => handleSend(answer)}
              onTry={() => inputRef.current?.focus()}
            />
          ))}

          {isStreaming && streamingContent && (
            <MessageBubble
              message={{ role: "assistant", content: streamingContent, timestamp: "" }}
              isStreaming
            />
          )}

          {isStreaming && !streamingContent && (
            <div className="flex items-start gap-3 chat-message-enter">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center shrink-0 shadow-glow-sm">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="card-light px-4 py-3 rounded-2xl rounded-tl-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>
                    {isAnalyzingImage ? "Analyzing image with AI vision..." : "Thinking..."}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick actions (show after assistant response) */}
      {session.messages.length > 0 &&
        session.messages[session.messages.length - 1]?.role === "assistant" &&
        !isStreaming && (
          <div className="px-3 sm:px-4 pb-2 max-w-3xl mx-auto w-full shrink-0">
            <div className="flex flex-wrap gap-2 pb-1">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.prompt)}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 whitespace-nowrap hover:border-primary/30"
                  style={{ background: "var(--muted)" }}
                >
                  <action.icon className="h-3 w-3" style={{ color: "var(--feat-chat)" }} />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

      {/* Image preview strip */}
      {pendingImage && (
        <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
          <div
            className="inline-flex items-center gap-3 p-2.5 rounded-2xl border border-border"
            style={{ background: "var(--muted)" }}
          >
            <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0">
              <img
                src={pendingImage.previewUrl}
                alt="Upload preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
            <div className="text-xs min-w-0">
              <div className="font-medium text-foreground truncate max-w-[160px]">
                {pendingImage.file.name}
              </div>
              <div className="text-muted-foreground mt-0.5">
                {(pendingImage.file.size / 1024).toFixed(0)} KB \u00b7 Image
              </div>
              <div className="text-primary/70 text-[11px] mt-0.5">Ready to send</div>
            </div>
            <button
              onClick={() => setPendingImage(null)}
              className="ml-auto p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* PDF preview strip */}
      {pendingPdf && (
        <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
          <div
            className="inline-flex items-center gap-3 p-2.5 rounded-2xl border border-border"
            style={{ background: "var(--muted)" }}
          >
            <div className="h-12 w-12 rounded-xl bg-primary/15 grid place-items-center shrink-0">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="text-xs min-w-0">
              <div className="font-medium text-foreground truncate max-w-[180px]">
                {pendingPdf.file.name}
              </div>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5">
                {pendingPdf.pageCount && (
                  <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                    {pendingPdf.pageCount}p
                  </span>
                )}
                {(pendingPdf.file.size / 1024).toFixed(0)} KB \u00b7 PDF
              </div>
            </div>
            <button
              onClick={() => setPendingPdf(null)}
              className="ml-auto p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div
        className="border-t border-border p-2 sm:p-4 shrink-0"
        style={{ background: "var(--background)", backdropFilter: "blur(20px)" }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            {/* Attach button */}
            <label
              className={cn(
                "h-10 w-10 shrink-0 rounded-xl border border-border grid place-items-center cursor-pointer hover:border-primary/30 hover:bg-accent transition-all",
                isStreaming && "opacity-40 pointer-events-none",
              )}
              style={{ background: "var(--muted)" }}
              title="Attach image or PDF"
            >
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={isStreaming}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.target.value = "";
                }}
              />
            </label>

            <div
              className="flex-1 min-w-0 rounded-2xl border border-border focus-within:border-primary/40 focus-within:shadow-glow-sm transition-all duration-200"
              style={{ background: "var(--muted)" }}
              data-tour="tour-chat-input"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={(e) => {
                  const file = pastedAttachment(e.clipboardData);
                  if (file) {
                    e.preventDefault();
                    handleFileSelect(file);
                  }
                }}
                placeholder={
                  pendingImage
                    ? "Add a message about this image... (optional)"
                    : pendingPdf
                      ? "Ask something about this PDF..."
                      : "Try the next step, share your reasoning, or ask a question…"
                }
                rows={1}
                className="block w-full bg-transparent px-3 py-2.5 text-base sm:text-sm outline-none resize-none placeholder:text-muted-foreground"
                disabled={isStreaming}
              />
            </div>

            <PasteImageButton onFile={handleFileSelect} disabled={isStreaming} />
            <Button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !pendingImage && !pendingPdf) || isStreaming}
              className="bg-gradient-primary h-10 w-10 shrink-0 rounded-xl p-0 shadow-glow-sm hover:shadow-glow transition-shadow disabled:opacity-40 disabled:shadow-none"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Paste or attach images · PDFs up to 7.5 MB
          </p>
        </div>
      </div>
    </>
  );
}

/* \u2500\u2500\u2500 Message Bubble \u2500\u2500\u2500 */
function MessageBubble({
  message,
  isStreaming = false,
  active = false,
  onAnswer,
  onTry,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
  active?: boolean;
  onAnswer?: (answer: string) => void;
  onTry?: () => void;
}) {
  const isUser = message.role === "user";
  const [showTime, setShowTime] = useState(false);
  const toolResult = isUser
    ? { content: message.content, actions: [] }
    : parseTutorTools(message.content);
  const parsed = isUser
    ? { content: message.content, checkpoint: null }
    : parseTutorResponse(toolResult.content);

  const timeStr = message.timestamp ? formatTimeIST(message.timestamp) : null;

  return (
    <div
      className={cn("flex items-start gap-3 chat-message-enter", isUser && "flex-row-reverse")}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-lg grid place-items-center shrink-0",
          isUser ? "" : "bg-gradient-primary shadow-glow-sm",
        )}
        style={isUser ? { background: "var(--feat-chat-bg)" } : undefined}
      >
        {isUser ? (
          <User className="h-4 w-4" style={{ color: "var(--feat-chat)" }} />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-col gap-1 max-w-[calc(100%-44px)] sm:max-w-[80%]",
          isUser && "items-end",
        )}
      >
        <div
          className={cn(
            "min-w-0 max-w-full rounded-2xl text-sm leading-relaxed",
            isUser ? "rounded-tr-sm" : "card-light rounded-tl-sm",
          )}
          style={
            isUser
              ? {
                  background: "var(--feat-chat-bg)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                }
              : undefined
          }
        >
          {/* Render image if present */}
          {message.imageUrl && (
            <div className="p-2 pb-0">
              <img
                src={message.imageUrl}
                alt="Uploaded image"
                className="max-w-full max-h-64 rounded-xl object-contain"
              />
            </div>
          )}
          <div className="px-4 py-3">
            {isUser ? (
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {message.content}
              </p>
            ) : (
              <MarkdownContent
                content={formatTutorText(parsed.content)}
                isStreaming={isStreaming}
              />
            )}
          </div>
        </div>

        {!isUser && !isStreaming && toolResult.actions.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Tutor study tools">
            {toolResult.actions.map((action) => (
              <Link
                key={action.tool}
                {...tutorToolTarget(action)}
                className="max-w-full break-words [overflow-wrap:anywhere] rounded-xl border border-primary/25 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {TUTOR_TOOLS[action.tool].label}
                {action.topic ? ` · ${action.topic}` : ""}
              </Link>
            ))}
          </div>
        )}
        {!isUser && parsed.checkpoint && !isStreaming && (
          <div className="min-w-0 max-w-full rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-primary">Your turn</p>
            <MarkdownContent content={parsed.checkpoint.question} />
            <div className="flex flex-wrap gap-2">
              {parsed.checkpoint.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={!active}
                  onClick={() =>
                    onAnswer?.(
                      `For your checkpoint: ${parsed.checkpoint!.question}\n\nMy response: ${option}`,
                    )
                  }
                  className="max-w-full break-words [overflow-wrap:anywhere] text-left text-sm rounded-xl border border-primary/25 px-3 py-2 hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-default"
                >
                  {option}
                </button>
              ))}
              {active && (
                <button
                  type="button"
                  onClick={onTry}
                  className="text-sm text-primary underline underline-offset-4"
                >
                  {parsed.checkpoint.options.length
                    ? "Write my own answer"
                    : "Try it in my own words"}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {active
                ? "Share your reasoning below. You can ask for a hint anytime."
                : "Previous checkpoint"}
            </p>
          </div>
        )}

        {/* Timestamp on hover */}
        {timeStr && (
          <span
            className={cn(
              "text-[10px] text-muted-foreground/50 transition-opacity duration-150 px-1",
              showTime ? "opacity-100" : "opacity-0",
            )}
          >
            {timeStr}
          </span>
        )}
      </div>
    </div>
  );
}

/* MarkdownContent and CodeBlock are imported from @/components/MarkdownContent */
