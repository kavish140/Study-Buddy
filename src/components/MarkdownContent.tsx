import { useState } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import katex from "katex";

/* ─── KaTeX rendering helpers ─── */

function renderKatex(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode: display,
      throwOnError: false,
      errorColor: "#ef4444",
      strict: "ignore",
      trust: false,
    });
  } catch {
    return latex;
  }
}

/** Renders inline math: $...$ */
function InlineMath({ latex }: { latex: string }) {
  return (
    <span
      className="inline-math"
      dangerouslySetInnerHTML={{ __html: renderKatex(latex, false) }}
    />
  );
}

/** Renders display (block) math: $$...$$ */
function DisplayMath({ latex }: { latex: string }) {
  return (
    <div
      className="display-math my-4 overflow-x-auto text-center"
      dangerouslySetInnerHTML={{ __html: renderKatex(latex, true) }}
    />
  );
}

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

/* ─── Inline renderer: handles math, bold, italic, inline-code ─── */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  type MatchCandidate = { index: number; length: number; node: React.ReactNode };

  while (remaining.length > 0) {
    let firstMatch: MatchCandidate | null = null;

    const updateFirst = (m: MatchCandidate | null) => {
      if (m !== null && (firstMatch === null || m.index < firstMatch.index)) {
        firstMatch = m;
      }
    };

    // ── Display math inline: $$...$$ (single line) ──────────────────
    const dispMathMatch = remaining.match(/\$\$([^$]+?)\$\$/);
    if (dispMathMatch?.index !== undefined) {
      updateFirst({
        index: dispMathMatch.index,
        length: dispMathMatch[0].length,
        node: <DisplayMath key={key++} latex={dispMathMatch[1]} />,
      });
    }

    // ── Inline math: $...$ (not $$) ──────────────────────────────────
    // Uses negative lookahead/lookbehind to avoid matching $$
    const inlineMathMatch = remaining.match(/(?<!\$)\$(?!\$)([^$\n]+?)(?<!\s)\$(?!\$)/);
    if (inlineMathMatch?.index !== undefined) {
      // Extra guard: ensure we didn't accidentally match a $$ sequence
      const before = remaining[inlineMathMatch.index - 1];
      const after = remaining[inlineMathMatch.index + inlineMathMatch[0].length];
      if (before !== "$" && after !== "$") {
        updateFirst({
          index: inlineMathMatch.index,
          length: inlineMathMatch[0].length,
          node: <InlineMath key={key++} latex={inlineMathMatch[1]} />,
        });
      }
    }

    // ── Bold: **...** ─────────────────────────────────────────────────
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch?.index !== undefined) {
      updateFirst({
        index: boldMatch.index,
        length: boldMatch[0].length,
        node: (
          <strong key={key++} className="font-semibold text-foreground">
            {boldMatch[1]}
          </strong>
        ),
      });
    }

    // ── Italic: *...* (not **) ────────────────────────────────────────
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    if (italicMatch?.index !== undefined) {
      updateFirst({
        index: italicMatch.index,
        length: italicMatch[0].length,
        node: (
          <em key={key++} className="italic">
            {italicMatch[1]}
          </em>
        ),
      });
    }

    // ── Inline code: `...` ────────────────────────────────────────────
    const codeMatch = remaining.match(/\x60([^\x60]+)\x60/);
    if (codeMatch?.index !== undefined) {
      updateFirst({
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
      });
    }

    if (firstMatch) {
      if ((firstMatch as MatchCandidate).index > 0) {
        parts.push(remaining.slice(0, (firstMatch as MatchCandidate).index));
      }
      parts.push((firstMatch as MatchCandidate).node);
      remaining = remaining.slice(
        (firstMatch as MatchCandidate).index + (firstMatch as MatchCandidate).length,
      );
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
  let inDisplayMath = false;
  let mathBuffer: string[] = [];

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
    const trimmed = line.trim();

    // ── Multi-line display math: $$ delimiter on its own line ──────────
    if (trimmed === "$$") {
      if (inDisplayMath) {
        // Close the display math block
        blocks.push(
          <DisplayMath key={`dm-${blocks.length}`} latex={mathBuffer.join("\n")} />,
        );
        mathBuffer = [];
        inDisplayMath = false;
      } else {
        flushParagraph();
        inDisplayMath = true;
      }
      continue;
    }

    if (inDisplayMath) {
      mathBuffer.push(line);
      continue;
    }

    // ── Single-line display math: $$...$$ on one line ─────────────────
    const singleDisplayMath = trimmed.match(/^\$\$(.+?)\$\$$/);
    if (singleDisplayMath) {
      flushParagraph();
      blocks.push(
        <DisplayMath key={`dm-${blocks.length}`} latex={singleDisplayMath[1]} />,
      );
      continue;
    }

    // ── Code blocks ───────────────────────────────────────────────────
    if (trimmed.startsWith("```")) {
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
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      currentBlock.push(line);
      continue;
    }

    // ── Headers ───────────────────────────────────────────────────────
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

    // ── Horizontal rule ───────────────────────────────────────────────
    if (trimmed.match(/^---+$/) || trimmed.match(/^\*\*\*+$/)) {
      flushParagraph();
      blocks.push(<hr key={blocks.length} className="my-3 border-border" />);
      continue;
    }

    // ── Bullet lists ──────────────────────────────────────────────────
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

    // ── Numbered lists ────────────────────────────────────────────────
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

    // ── Blockquote ────────────────────────────────────────────────────
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

    // ── Empty lines ───────────────────────────────────────────────────
    if (trimmed === "") {
      flushParagraph();
      continue;
    }

    currentBlock.push(line);
  }

  // ── Flush any unclosed blocks ─────────────────────────────────────
  if (inCodeBlock && currentBlock.length > 0) {
    blocks.push(
      <CodeBlock key={"cb-" + blocks.length} lang={codeLang} content={currentBlock.join("\n")} />,
    );
  } else if (inDisplayMath && mathBuffer.length > 0) {
    // Unclosed $$ block (can happen during streaming)
    blocks.push(
      <DisplayMath key={`dm-${blocks.length}`} latex={mathBuffer.join("\n")} />,
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
