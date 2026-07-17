import { useState } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";

/* ─── Code Block with Copy button ─── */
function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Failed to copy to clipboard"));
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
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500">Copied!</span>
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

/* ─── Custom component overrides for react-markdown ─── */
const components: Components = {
  // Headings
  h1: ({ children }) => (
    <h2 className="font-bold text-lg mt-4 mb-2 text-foreground">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="font-bold text-base mt-4 mb-1.5 text-foreground">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="font-semibold text-sm mt-4 mb-1.5 text-foreground">{children}</h4>
  ),
  // Paragraph
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  // Strong / Em
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  // Horizontal rule
  hr: () => <hr className="my-3 border-border" />,
  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  // Lists
  ul: ({ children }) => <ul className="space-y-1 my-1.5 pl-1">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1 my-1.5 pl-1 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => (
    <div className="flex items-start gap-2 mb-1">
      <span className="text-primary mt-0.5 shrink-0 text-xs">•</span>
      <span className="flex-1">{children}</span>
    </div>
  ),
  // Inline code
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      const lang = (className ?? "").replace("language-", "");
      return <CodeBlock lang={lang} content={String(children).replace(/\n$/, "")} />;
    }
    return (
      <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono border border-primary/20">
        {children}
      </code>
    );
  },
  // Block pre — handled by code above
  pre: ({ children }) => <>{children}</>,
};

/* ─── Public MarkdownContent component ─── */
export function MarkdownContent({
  content,
  isStreaming = false,
  className,
}: {
  content: string;
  isStreaming?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(isStreaming && "streaming-cursor", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
