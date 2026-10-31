import { useState } from "react";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { readClipboardImage } from "@/lib/chat-attachments";

export function PasteImageButton({
  onFile,
  disabled = false,
}: {
  onFile: (file: File) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [reading, setReading] = useState(false);
  return (
    <button
      type="button"
      aria-label="Paste image from clipboard"
      title="Paste image from clipboard"
      disabled={disabled || reading}
      className="h-10 w-10 shrink-0 rounded-xl border border-border grid place-items-center hover:border-primary/30 hover:bg-accent transition-all disabled:opacity-40"
      onClick={async () => {
        setReading(true);
        try {
          await onFile(await readClipboardImage());
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to paste image. Try attaching the saved image.",
          );
        } finally {
          setReading(false);
        }
      }}
    >
      {reading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ClipboardPaste className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}
