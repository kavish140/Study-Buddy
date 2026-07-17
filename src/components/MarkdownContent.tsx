import { useState } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

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

/* ─── Inline markdown: bold, italic, inline-code ─── */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
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
}

/* ─── Block markdown renderer ─── */
function renderMarkdown(text: string): React.ReactNode[] {
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

    // Horizontal rule
    if (line.trim().match(/^---+$/) || line.trim().match(/^\*\*\*+$/)) {
      flushParagraph();
      blocks.push(<hr key={blocks.length} className="my-3 border-border" />);
      continue;
    }

    // Bullet lists
    if (line.match(/^[-*] /)) {
      flushParagraph();
      blocks.push(
        <div key={blocks.length} className="flex items-start gap-2 mb-1">
          <span className="text-primary mt-0.5 shrink-0 text-xs">•</span>
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

    // Blockquote
    if (line.startsWith("> ")) {
      flushParagraph();
      blocks.push(
        <blockquote
          key={blocks.length}
          className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic"
        >
          {renderInline(line.slice(2))}
        </blockquote>,
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
}

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
      {renderMarkdown(content)}
    </div>
  );
}
