import { createFileRoute } from "@tanstack/react-router";
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
  Copy,
  Check,
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

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "AI Tutor \u2014 AcePrep" },
      {
        name: "description",
        content:
          "Ask your AI tutor any question. Get step-by-step explanations and exam-relevant insights.",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const queryClient = useQueryClient();
  const { data: sessions = [] } = useQuery({
    queryKey: ["chatSessions"],
    queryFn: api.getChatSessions,
  });
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  // Tracks a pending first message when creating a new session from empty state
  const [pendingFirstMsg, setPendingFirstMsg] = useState<string | null>(null);
  const { triggerPageTour } = useTutorial();

  useEffect(() => {
    triggerPageTour("chat");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: uid(),
      title: "New chat",
      exam_id: profile?.exam_id,
      messages: [],
    };
    saveMutation.mutate(newSession);
    setActiveSessionId(newSession.id);
    setShowSidebar(false);
  };

  // Called from EmptyState \u2014 creates session AND sends first message immediately
  const handleSendFromEmpty = (msg: string) => {
    const newSession: ChatSession = {
      id: uid(),
      title: msg.slice(0, 50) + (msg.length > 50 ? "\u2026" : ""),
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

  const handleDeleteChat = (id: string) => {
    deleteMutation.mutate(id);
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const handleUpdateSession = (session: ChatSession) => {
    // Strip imageUrl from messages before persisting \u2014 data-URLs can be hundreds of KB
    // and bloat the Supabase row. The in-memory state retains the URL for display.
    const sanitized: ChatSession = {
      ...session,
      messages: session.messages.map(({ imageUrl: _stripped, ...rest }) => rest),
    };
    saveMutation.mutate(sanitized);
  };

  return (
    <div className="relative h-[calc(100vh-64px)] lg:h-screen flex overflow-hidden">
      {/* \u2500\u2500 Sidebar */}
      <aside
        className={cn(
          "w-72 border-r border-border flex flex-col bg-sidebar transition-all duration-300 absolute lg:relative z-20 h-full",
          showSidebar
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0 lg:w-0 lg:border-0 lg:overflow-hidden",
        )}
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
                  ? "bg-primary/10 text-primary border-primary pl-[10px]"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border-transparent",
              )}
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-10 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeSession ? (
          <ChatView
            session={activeSession}
            examName={profile?.exam_name}
            onUpdate={handleUpdateSession}
            onToggleSidebar={() => setShowSidebar(!showSidebar)}
            initialMessage={pendingFirstMsg ?? undefined}
            onInitialMessageConsumed={() => setPendingFirstMsg(null)}
          />
        ) : (
          <EmptyState
            onSend={handleSendFromEmpty}
            onToggleSidebar={() => setShowSidebar(!showSidebar)}
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
}: {
  onSend: (msg: string) => void;
  onToggleSidebar: () => void;
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
    { icon: HelpCircle, text: "Explain electronegativity", sub: "Chemistry concept" },
    { icon: Lightbulb, text: "Solve projectile motion", sub: "Physics problem" },
    { icon: BookOpen, text: "Summarize French Revolution", sub: "History topic" },
    { icon: Sparkles, text: "Best strategies for JEE Math", sub: "Exam tips" },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="glass border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
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
          <div className="font-medium text-sm">AcePrep AI Tutor</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
            Ready to help
          </div>
        </div>
      </header>

      {/* Hero area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto relative">
        {/* Background radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 65% 55% at 50% 40%, rgba(59,130,246,0.09), transparent 70%)",
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

          <h2 className="text-3xl font-bold font-heading mb-3 text-gradient">AcePrep AI Tutor</h2>
          <p className="text-muted-foreground mb-10 text-sm leading-relaxed max-w-sm mx-auto">
            Ask anything about your exam topics. Get step-by-step solutions, concept explanations,
            and exam strategies.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-10">
            {suggestedPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt.text)}
                className="group glass-subtle p-4 rounded-2xl text-left hover:border-primary/30 hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-glow-sm transition-all duration-200"
              >
                <div className="h-7 w-7 rounded-lg bg-primary/10 grid place-items-center mb-2.5 group-hover:bg-primary/20 transition-colors">
                  <prompt.icon className="h-3.5 w-3.5 text-primary" />
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
      <div className="border-t border-border p-4 shrink-0 glass">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <label
              className="h-10 w-10 shrink-0 rounded-xl glass-subtle grid place-items-center cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all"
              title="Upload image or take photo"
            >
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // For empty state, delegate to ChatView after creation
                    toast.info("Start a new chat to upload images");
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <div className="flex-1 glass-subtle rounded-2xl focus-within:border-primary/40 focus-within:shadow-glow-sm transition-all duration-200">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question... (Enter to send)"
                rows={1}
                autoFocus
                className="w-full bg-transparent px-4 py-3 text-sm outline-none resize-none placeholder:text-muted-foreground"
              />
            </div>
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
            <span>\ud83d\udcce attach file</span>
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
  onUpdate,
  onToggleSidebar,
  initialMessage,
  onInitialMessageConsumed,
}: {
  session: ChatSession;
  examName?: string;
  onUpdate: (session: ChatSession) => void;
  onToggleSidebar: () => void;
  initialMessage?: string;
  onInitialMessageConsumed?: () => void;
}) {
  const [input, setInput] = useState("");
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [session.messages, streamingContent, scrollToBottom]);

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
    // Clear the other pending type
    setPendingPdf(null);
    setPendingImage(null);

    if (type === "image") {
      const previewUrl = await createImagePreview(file);
      setPendingImage({ file, previewUrl });
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
    if (isStreaming) return;

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
        session.messages.length === 0 ? "\ud83d\udcc4 " + pdfFile.name.slice(0, 40) : session.title;
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
          });

          onUpdate({
            ...updatedSession,
            messages: [
              ...updatedMessages,
              { role: "assistant", content: result.response, timestamp: new Date().toISOString() },
            ],
          });
          setIsStreaming(false);
          setStreamingContent("");
        } else {
          // Digital PDF with a text layer — use existing streaming text flow
          const contextMsg = `The student has uploaded a PDF: "${pdfFile.name}" (${pageCount} pages).\n\nPDF CONTENT:\n${text.slice(0, 12000)}${text.length > 12000 ? "\n\n[...content truncated to first 12,000 characters...]" : ""}\n\nStudent's question: ${userMsg}`;

          const messagesWithPdf = [
            ...updatedMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
            { role: "user" as const, content: contextMsg },
          ];

          let fullResponse = "";
          await streamChat({
            messages: messagesWithPdf,
            examName,
            onChunk: (chunk) => {
              fullResponse += chunk;
              setStreamingContent(fullResponse);
            },
            onDone: () => {
              onUpdate({
                ...updatedSession,
                messages: [
                  ...updatedMessages,
                  { role: "assistant", content: fullResponse, timestamp: new Date().toISOString() },
                ],
              });
              setStreamingContent("");
              setIsStreaming(false);
            },
          });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to read PDF");
        setIsStreaming(false);
        setStreamingContent("");
      }
      return;
    }

    // \u2500\u2500 Image flow
    if (pendingImage) {
      const imageFile = pendingImage;
      const userMsg = msg || "Solve this question from the image";

      const userMessage: ChatMessage = {
        role: "user",
        content: userMsg,
        timestamp: new Date().toISOString(),
        imageUrl: imageFile.previewUrl,
      };

      const updatedMessages = [...session.messages, userMessage];
      const title =
        session.messages.length === 0
          ? "\ud83d\udcf7 " + userMsg.slice(0, 45) + (userMsg.length > 45 ? "\u2026" : "")
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
        ? msg.slice(0, 50) + (msg.length > 50 ? "\u2026" : "")
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
      toast.error(e instanceof Error ? e.message : "Failed to get response");
      setIsStreaming(false);
      setStreamingContent("");
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
      label: "Explain simpler",
      prompt:
        "Re-explain that concept using a different approach or analogy. Keep it at JEE level.",
      icon: Lightbulb,
    },
    {
      label: "Give an example",
      prompt:
        "Give me a fully solved JEE exam-style numerical problem on this topic. Show every step.",
      icon: BookOpen,
    },
    {
      label: "Quiz me on this",
      prompt:
        "Generate 1 JEE Advanced level MCQ on exactly the topic we just discussed. Give 4 numerical options. Then reveal the answer and full solution after I respond.",
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
        className="glass border-b border-border px-4 py-3 flex items-center gap-3 shrink-0"
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
                {examName ? examName + " \u00b7 " : ""}AcePrep AI
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Messages \u2014 also a drop target */}
      <div
        className="flex-1 overflow-y-auto relative"
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
              <p className="text-sm text-muted-foreground">Ask me anything about your studies!</p>
            </div>
          )}

          {session.messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
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
              <div className="glass-subtle px-4 py-3 rounded-2xl rounded-tl-sm">
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
          <div className="px-4 pb-2 max-w-3xl mx-auto w-full overflow-x-auto">
            <div className="flex gap-2 pb-1">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.prompt)}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-full glass-subtle hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 whitespace-nowrap"
                >
                  <action.icon className="h-3 w-3 text-primary" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

      {/* Image preview strip */}
      {pendingImage && (
        <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
          <div className="inline-flex items-center gap-3 glass-subtle p-2.5 rounded-2xl border border-primary/20">
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
          <div className="inline-flex items-center gap-3 glass-subtle p-2.5 rounded-2xl border border-primary/20">
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
      <div className="border-t border-border p-4 shrink-0 glass">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            {/* Attach button */}
            <label
              className={cn(
                "h-10 w-10 shrink-0 rounded-xl glass-subtle grid place-items-center cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all",
                isStreaming && "opacity-40 pointer-events-none",
              )}
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
              className="flex-1 glass-subtle rounded-2xl focus-within:border-primary/40 focus-within:shadow-glow-sm transition-all duration-200"
              data-tour="tour-chat-input"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  pendingImage
                    ? "Add a message about this image... (optional)"
                    : pendingPdf
                      ? "Ask something about this PDF..."
                      : "Ask a question, or drop an image / PDF here..."
                }
                rows={1}
                className="w-full bg-transparent px-4 py-3 text-sm outline-none resize-none placeholder:text-muted-foreground"
                disabled={isStreaming}
              />
            </div>

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
        </div>
      </div>
    </>
  );
}

/* \u2500\u2500\u2500 Message Bubble \u2500\u2500\u2500 */
function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";
  const [showTime, setShowTime] = useState(false);

  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className={cn("flex items-start gap-3 chat-message-enter", isUser && "flex-row-reverse")}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-lg grid place-items-center shrink-0",
          isUser ? "bg-accent/10" : "bg-gradient-primary shadow-glow-sm",
        )}
      >
        {isUser ? <User className="h-4 w-4 text-accent" /> : <Bot className="h-4 w-4 text-white" />}
      </div>

      <div className={cn("flex flex-col gap-1 max-w-[80%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-primary/12 text-foreground rounded-tr-sm border border-primary/15"
              : "glass-subtle rounded-tl-sm",
          )}
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
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MarkdownContent content={message.content} isStreaming={isStreaming} />
            )}
          </div>
        </div>

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

/* \u2500\u2500\u2500 Code Block with Copy button \u2500\u2500\u2500 */
function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-primary/10">
      <div className="flex items-center justify-between px-4 py-2 bg-primary/8 border-b border-primary/10">
        <span className="text-[11px] font-mono text-primary/70 font-medium">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded-md hover:bg-primary/10"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="bg-muted/20 p-4 overflow-x-auto text-xs font-mono leading-relaxed text-foreground/90">
        <code>{content}</code>
      </pre>
    </div>
  );
}

/* \u2500\u2500\u2500 Simple Markdown Renderer \u2500\u2500\u2500 */
function MarkdownContent({
  content,
  isStreaming = false,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  // Simple markdown parsing for common patterns
  const renderMarkdown = (text: string) => {
    const blocks: React.ReactNode[] = [];
    const lines = text.split("\n");
    let currentBlock: string[] = [];
    let inCodeBlock = false;
    let codeLang = "";

    const flushParagraph = () => {
      if (currentBlock.length > 0) {
        const joined = currentBlock.join("\n");
        if (joined.trim()) {
          blocks.push(
            <p key={blocks.length} className="mb-2 last:mb-0">
              {renderInline(joined)}
            </p>,
          );
        }
        currentBlock = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          blocks.push(
            <CodeBlock
              key={"cb-" + blocks.length}
              lang={codeLang}
              content={currentBlock.join("\n")}
            />,
          );
          currentBlock = [];
          inCodeBlock = false;
          codeLang = "";
        } else {
          flushParagraph();
          inCodeBlock = true;
          codeLang = line.trim().slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        currentBlock.push(line);
        continue;
      }

      // Headers
      if (line.startsWith("### ")) {
        flushParagraph();
        blocks.push(
          <h4 key={blocks.length} className="font-semibold text-sm mt-4 mb-1.5 text-foreground">
            {renderInline(line.slice(4))}
          </h4>,
        );
        continue;
      }
      if (line.startsWith("## ")) {
        flushParagraph();
        blocks.push(
          <h3 key={blocks.length} className="font-bold text-base mt-4 mb-1.5 text-foreground">
            {renderInline(line.slice(3))}
          </h3>,
        );
        continue;
      }
      if (line.startsWith("# ")) {
        flushParagraph();
        blocks.push(
          <h2 key={blocks.length} className="font-bold text-lg mt-4 mb-2 text-foreground">
            {renderInline(line.slice(2))}
          </h2>,
        );
        continue;
      }

      // Bullet lists
      if (line.match(/^[-*] /)) {
        flushParagraph();
        blocks.push(
          <div key={blocks.length} className="flex items-start gap-2 mb-1">
            <span className="text-primary mt-0.5 shrink-0 text-xs">\u2022</span>
            <span>{renderInline(line.slice(2))}</span>
          </div>,
        );
        continue;
      }

      // Numbered lists
      const numMatch = line.match(/^(\d+)\.\s/);
      if (numMatch) {
        flushParagraph();
        blocks.push(
          <div key={blocks.length} className="flex items-start gap-2 mb-1">
            <span className="text-primary font-semibold shrink-0 text-xs min-w-[1.25rem]">
              {numMatch[1]}.
            </span>
            <span>{renderInline(line.slice(numMatch[0].length))}</span>
          </div>,
        );
        continue;
      }

      // Empty lines
      if (line.trim() === "") {
        flushParagraph();
        continue;
      }

      currentBlock.push(line);
    }

    // Flush any unclosed code block (can happen mid-stream)
    if (inCodeBlock && currentBlock.length > 0) {
      blocks.push(
        <CodeBlock key={"cb-" + blocks.length} lang={codeLang} content={currentBlock.join("\n")} />,
      );
    } else {
      flushParagraph();
    }
    return blocks;
  };

  // Inline markdown: bold, italic, code
  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Bold (must be checked before italic so ** takes priority over *)
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Italic — single asterisk not preceded/followed by another asterisk
      const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
      // Inline code
      const codeMatch = remaining.match(/\x60([^\x60]+)\x60/);

      let firstMatch: { index: number; length: number; node: React.ReactNode } | null = null;

      if (boldMatch?.index !== undefined) {
        firstMatch = {
          index: boldMatch.index,
          length: boldMatch[0].length,
          node: (
            <strong key={key++} className="font-semibold text-foreground">
              {boldMatch[1]}
            </strong>
          ),
        };
      }

      if (italicMatch?.index !== undefined) {
        const candidate = {
          index: italicMatch.index,
          length: italicMatch[0].length,
          node: (
            <em key={key++} className="italic">
              {italicMatch[1]}
            </em>
          ),
        };
        if (firstMatch === null || candidate.index < firstMatch.index) firstMatch = candidate;
      }

      if (codeMatch?.index !== undefined) {
        const candidate = {
          index: codeMatch.index,
          length: codeMatch[0].length,
          node: (
            <code
              key={key++}
              className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono border border-primary/20"
            >
              {codeMatch[1]}
            </code>
          ),
        };
        if (firstMatch === null || candidate.index < firstMatch.index) firstMatch = candidate;
      }

      if (firstMatch) {
        if (firstMatch.index > 0) {
          parts.push(remaining.slice(0, firstMatch.index));
        }
        parts.push(firstMatch.node);
        remaining = remaining.slice(firstMatch.index + firstMatch.length);
      } else {
        parts.push(remaining);
        break;
      }
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  return <div className={cn(isStreaming && "streaming-cursor")}>{renderMarkdown(content)}</div>;
}
