export const MAX_PDF_BYTES = 7.5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateChatAttachment(file: File) {
  const pdf = file.type === "application/pdf";
  if (!pdf && !file.type.startsWith("image/"))
    throw new Error("Only images and PDFs are supported.");
  if (file.size > (pdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES))
    throw new Error(
      `${pdf ? "PDF" : "Image"} too large. Maximum size is ${pdf ? "7.5" : "10"} MB.`,
    );
}

type PasteData = Pick<DataTransfer, "files" | "items">;

// Some browsers expose screenshots in items but leave files empty. Read the
// binary entries synchronously, while the paste event's clipboard is accessible.
export function pastedAttachment(data: PasteData): File | null {
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file)
      return file.type
        ? file
        : new File([file], file.name || "pasted-image.png", { type: item.type });
  }
  const files = Array.from(data.files ?? []);
  return (
    files.find((file) => file.type.startsWith("image/")) ??
    files.find((file) => file.type === "application/pdf") ??
    null
  );
}

// Called only from a user gesture. No clipboard read happens on page load.
export async function readClipboardImage(): Promise<File> {
  if (!navigator.clipboard?.read)
    throw new Error(
      "Clipboard image access is unavailable. Paste into the message box with Ctrl+V (or Cmd+V), or attach the saved image.",
    );
  let items: ClipboardItems;
  try {
    items = await navigator.clipboard.read();
  } catch {
    throw new Error(
      "Clipboard access was blocked. Paste into the message box with Ctrl+V (or Cmd+V), or attach the saved image.",
    );
  }
  for (const item of items) {
    const type = item.types.includes("image/png")
      ? "image/png"
      : item.types.find((value) => value.startsWith("image/"));
    if (!type) continue;
    const blob = await item.getType(type);
    const extensions: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const extension = extensions[type] ?? "img";
    return new File([blob], `pasted-image.${extension}`, { type });
  }
  throw new Error(
    "No image found on the clipboard. Copy the image itself or a screenshot, then paste again.",
  );
}
