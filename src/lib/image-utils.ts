// PDF.js is loaded lazily to avoid bundle size hit
interface PdfJs {
  version: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (args: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
}

interface PdfPage {
  getTextContent: () => Promise<{ items: { str?: string }[] }>;
}

let pdfJsLib: PdfJs | null = null;

async function getPdfJs() {
  if (!pdfJsLib) {
    pdfJsLib = (await import("pdfjs-dist")) as unknown as PdfJs;
    // Use the locally bundled worker to avoid CDN version-mismatch errors.
    // Vite will resolve this to the correct asset URL at build time.
    pdfJsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfJsLib;
}

/**
 * Extracts all text content from a PDF file.
 * Returns the text and page count.
 */
export async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  const texts: string[] = [];

  // Extract text from every page (cap at 20 pages to avoid token overflow)
  const maxPages = Math.min(pageCount, 20);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str || "").join(" ");
    texts.push(`--- Page ${i} ---\n${pageText}`);
  }

  return { text: texts.join("\n\n"), pageCount };
}

/** Returns 'image', 'pdf', or 'unsupported' */
export function getFileType(file: File): "image" | "pdf" | "unsupported" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  return "unsupported";
}

/**
 * Compresses an image file to a target size using canvas.
 * Returns base64-encoded string (without the data:... prefix) and the mime type.
 */
export async function compressImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; maxSizeBytes?: number } = {},
): Promise<{ base64: string; mimeType: string }> {
  const { maxWidth = 1280, maxHeight = 1280, quality = 0.8, maxSizeBytes = 900_000 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Calculate scaled dimensions
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to create canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Determine output type
        const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

        // Try compressing with decreasing quality if needed
        let currentQuality = quality;
        let dataUrl = canvas.toDataURL(outputType, currentQuality);

        // Iteratively reduce quality if the image is too large
        while (dataUrl.length * 0.75 > maxSizeBytes && currentQuality > 0.1) {
          currentQuality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", currentQuality);
        }

        // Extract base64 data (remove the data:image/...;base64, prefix)
        const base64 = dataUrl.split(",")[1];
        const mimeType = dataUrl.split(";")[0].split(":")[1];

        resolve({ base64, mimeType });
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Creates a small preview URL from a File for display purposes.
 */
export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to create preview"));
    reader.readAsDataURL(file);
  });
}
