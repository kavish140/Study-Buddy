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
  Camera,
  ImageIcon,
  FileText,
  Upload,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { streamChat, solveFromImage } from "@/lib/ai.functions";
import { compressImage, createImagePreview, extractPdfText, getFileType } from "@/lib/image-utils";
import { uid, type ChatSession, type ChatMessage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTutorial } from "@/components/TutorialProvider";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "AI Tutor — AcePrep" },
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatSessions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteChatSession,
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

  // Called from EmptyState — creates session AND sends first message immediately
  const handleSendFromEmpty = (msg: string) => {
    const newSession: ChatSession = {
      id: uid(),
      title: msg.slice(0, 50) + (msg.length > 50 ? "…" : ""),
      exam_id: profile?.exam_id,
      messages: [],
    };
    saveMutation.mutate(newSession);
    setActiveSessionId(newSession.id);
    setPendingFirstMsg(msg);
    setShowSidebar(false);
  };

  const handleDeleteChat = (id: string) => {
    deleteMutation.mutate(id);
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const handleUpdateSession = (session: ChatSession) => {
    saveMutation.mutate(session);
  };

  return (
    <div className="relative h-[calc(100vh-64px)] lg:h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "w-72 border-r border-border flex flex-col bg-sidebar transition-all duration-300 absolute lg:relative z-20 h-full",
          showSidebar
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0 lg:w-0 lg:border-0 lg:overflow-hidden",
        )}
      >
        <div
          className="p-4 border-b border-border flex items-center justify-between"
          data-tour="tour-chat-new"
        >
          <span className="font-semibold font-heading text-sm">Chat History</span>
          <Button variant="ghost" size="sm" onClick={handleNewChat} data-tour="tour-chat-new">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-8 px-4">
              No conversations yet. Start a new chat!
            </div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm",
                activeSessionId === session.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
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
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
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
          className="fixed inset-0 bg-black/40 z-10 lg:hidden"
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

/* ─── Empty State ─── */
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
    { icon: HelpCircle, text: "Explain the concept of electronegativity" },
    { icon: Lightbulb, text: "How do I solve projectile motion problems?" },
    { icon: BookOpen, text: "Summarize the French Revolution" },
    { icon: Sparkles, text: "What are the best strategies for JEE Math?" },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="glass border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-medium text-sm">AcePrep AI Tutor</div>
          <div className="text-xs text-muted-foreground">Ready to help</div>
        </div>
      </header>

      {/* Hero area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="text-center max-w-lg w-full">
          <div className="h-16 w-16 rounded-2xl bg-gradient-primary grid place-items-center mx-auto mb-5 shadow-glow">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold font-heading mb-2">AcePrep AI Tutor</h2>
          <p className="text-muted-foreground mb-8 text-sm">
            Ask anything about your exam topics. Get step-by-step solutions, concept explanations,
            and exam strategies.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-8">
            {suggestedPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt.text)}
                className="glass-subtle p-3 rounded-xl text-left text-xs text-muted-foreground hover:text-foreground hover:border-primary/20 transition-all"
              >
                <prompt.icon className="h-3.5 w-3.5 mb-1.5 text-primary" />
                {prompt.text}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input bar — always visible */}
      <div className="border-t border-border p-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          {/* Camera / upload button */}
          <label
            className="h-11 w-11 shrink-0 rounded-xl glass-subtle grid place-items-center cursor-pointer hover:border-primary/30 transition-colors"
            title="Upload image or take photo"
          >
            <Camera className="h-4 w-4 text-muted-foreground" />
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
          <div className="flex-1 glass-subtle rounded-2xl focus-within:border-primary/30 transition-colors">
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
            className="bg-gradient-primary h-11 w-11 shrink-0 rounded-xl p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Press Enter to send · Shift+Enter for new line · 📷 Upload image
        </p>
      </div>
    </div>
  );
}

/* ─── Chat View ─── */
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

  // ── Drag & Drop handlers ──────────────────────────────────────────
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

  // ── Unified file handler (images + PDFs) ─────────────────────────
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
      // PDF — extract page count immediately for the preview badge
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

    // ── PDF flow ─────────────────────────────────────────────────────
    if (pendingPdf) {
      const pdfFile = pendingPdf.file;
      const userMsg = msg || `Analyze this PDF: ${pdfFile.name}`;

      // Optimistic UI — show user message immediately
      const userMessage: ChatMessage = {
        role: "user",
        content: `📄 **${pdfFile.name}** (${pendingPdf.pageCount ?? "?"} pages)\n\n${userMsg}`,
        timestamp: new Date().toISOString(),
      };
      const updatedMessages = [...session.messages, userMessage];
      const title =
        session.messages.length === 0 ? `📄 ${pdfFile.name.slice(0, 40)}` : session.title;
      const updatedSession: ChatSession = { ...session, messages: updatedMessages, title };
      onUpdate(updatedSession);
      setInput("");
      setPendingPdf(null);
      setIsStreaming(true);
      setStreamingContent("");

      try {
        const { text, pageCount } = await extractPdfText(pdfFile);
        const contextMsg = `The student has uploaded a PDF: "${pdfFile.name}" (${pageCount} pages).\n\nPDF CONTENT:\n${text.slice(0, 12000)}${text.length > 12000 ? "\n\n[...content truncated to first 12,000 characters...]" : ""}\n\nStudent's question: ${userMsg}`;

        // Send as a chat message with the PDF content as context
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
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to read PDF");
        setIsStreaming(false);
        setStreamingContent("");
      }
      return;
    }

    // ── Image flow ───────────────────────────────────────────────────
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
          ? "📷 " + userMsg.slice(0, 45) + (userMsg.length > 45 ? "…" : "")
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
        ? msg.slice(0, 50) + (msg.length > 50 ? "…" : "")
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
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-2xl pointer-events-none">
          <Upload className="h-12 w-12 text-primary mb-3 animate-bounce" />
          <p className="text-lg font-semibold text-primary">Drop your image or PDF</p>
          <p className="text-sm text-muted-foreground">Supports JPG, PNG, WEBP, PDF</p>
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
          className="lg:hidden text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{session.title}</div>
          <div className="text-xs text-muted-foreground">
            {examName ? `${examName} · ` : ""}AcePrep AI
          </div>
        </div>
      </header>

      {/* Messages — also a drop target */}
      <div
        className="flex-1 overflow-y-auto relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {session.messages.length === 0 && !isStreaming && (
            <div className="text-center py-12">
              <Sparkles className="h-10 w-10 text-primary/30 mx-auto mb-3" />
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
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="glass-subtle px-4 py-3 rounded-2xl rounded-tl-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {isAnalyzingImage ? (
                    <span>Analyzing image with AI vision…</span>
                  ) : (
                    <span>Thinking...</span>
                  )}
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
          <div className="px-4 pb-2 flex gap-2 max-w-3xl mx-auto w-full">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleSend(action.prompt)}
                className="text-xs px-3 py-1.5 rounded-full glass-subtle hover:border-primary/20 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
              >
                <action.icon className="h-3 w-3" />
                {action.label}
              </button>
            ))}
          </div>
        )}

      {/* Image preview strip */}
      {pendingImage && (
        <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 glass-subtle p-2 rounded-xl">
            <img
              src={pendingImage.previewUrl}
              alt="Upload preview"
              className="h-16 w-16 object-cover rounded-lg"
            />
            <div className="text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{pendingImage.file.name}</div>
              <div>{(pendingImage.file.size / 1024).toFixed(0)} KB · Image</div>
            </div>
            <button
              onClick={() => setPendingImage(null)}
              className="ml-2 p-1 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* PDF preview strip */}
      {pendingPdf && (
        <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 glass-subtle p-2 rounded-xl border border-primary/20">
            <div className="h-12 w-12 rounded-lg bg-primary/10 grid place-items-center shrink-0">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="text-xs">
              <div className="font-medium text-foreground truncate max-w-[180px]">
                {pendingPdf.file.name}
              </div>
              <div className="text-muted-foreground">
                {pendingPdf.pageCount ? `${pendingPdf.pageCount} pages · ` : ""}
                {(pendingPdf.file.size / 1024).toFixed(0)} KB · PDF
              </div>
            </div>
            <button
              onClick={() => setPendingPdf(null)}
              className="ml-2 p-1 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border p-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          {/* Camera / upload button */}
          <label
            className={cn(
              "h-11 w-11 shrink-0 rounded-xl glass-subtle grid place-items-center cursor-pointer hover:border-primary/30 transition-colors",
              isStreaming && "opacity-50 pointer-events-none",
            )}
            title="Upload image or take photo"
          >
            <Camera className="h-4 w-4 text-muted-foreground" />
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
            className="flex-1 glass-subtle rounded-2xl focus-within:border-primary/30 transition-colors"
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
            className="bg-gradient-primary h-11 w-11 shrink-0 rounded-xl p-0"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

/* ─── Message Bubble ─── */
function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-8 w-8 rounded-lg grid place-items-center shrink-0",
          isUser ? "bg-accent/10" : "bg-gradient-primary",
        )}
      >
        {isUser ? <User className="h-4 w-4 text-accent" /> : <Bot className="h-4 w-4 text-white" />}
      </div>

      <div
        className={cn(
          "max-w-[80%] rounded-2xl text-sm leading-relaxed",
          isUser ? "bg-primary/10 text-foreground rounded-tr-sm" : "glass-subtle rounded-tl-sm",
          isStreaming && "animate-pulse-subtle",
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
            <MarkdownContent content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Simple Markdown Renderer ─── */
function MarkdownContent({ content }: { content: string }) {
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
            <pre
              key={blocks.length}
              className="bg-muted/30 rounded-lg p-3 mb-2 overflow-x-auto text-xs font-mono"
            >
              <code>{currentBlock.join("\n")}</code>
            </pre>,
          );
          currentBlock = [];
          inCodeBlock = false;
        } else {
          flushParagraph();
          inCodeBlock = true;
          codeLang = line.trim().slice(3);
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
          <h4 key={blocks.length} className="font-semibold text-sm mt-3 mb-1">
            {renderInline(line.slice(4))}
          </h4>,
        );
        continue;
      }
      if (line.startsWith("## ")) {
        flushParagraph();
        blocks.push(
          <h3 key={blocks.length} className="font-bold text-sm mt-3 mb-1">
            {renderInline(line.slice(3))}
          </h3>,
        );
        continue;
      }
      if (line.startsWith("# ")) {
        flushParagraph();
        blocks.push(
          <h2 key={blocks.length} className="font-bold mt-3 mb-1">
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
            <span className="text-primary mt-1 shrink-0">•</span>
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
            <span className="text-primary font-medium shrink-0">{numMatch[1]}.</span>
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

    flushParagraph();
    return blocks;
  };

  // Inline markdown: bold, italic, code, links
  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Inline code
      const codeMatch = remaining.match(/`([^`]+)`/);

      let firstMatch: { index: number; length: number; node: React.ReactNode } | null = null;

      if (boldMatch?.index !== undefined) {
        firstMatch = {
          index: boldMatch.index,
          length: boldMatch[0].length,
          node: <strong key={key++}>{boldMatch[1]}</strong>,
        };
      }

      if (codeMatch?.index !== undefined) {
        const candidate = {
          index: codeMatch.index,
          length: codeMatch[0].length,
          node: (
            <code key={key++} className="bg-muted/40 px-1.5 py-0.5 rounded text-xs font-mono">
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

  return <div>{renderMarkdown(content)}</div>;
}
