/**
 * PDF Text Extraction Engine (Improved)
 *
 * Current focus (per your choice B):
 * - Make text extraction significantly stronger and more reliable than basic pdf-parse.
 * - Use pdfjs-dist for better text layer extraction (often superior to pdf-parse on technical PDFs).
 * - Keep the architecture ready for OCR fallback later.
 *
 * This is used by the background worker and the re-extract endpoint.
 */

import { PDFParse } from "pdf-parse";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Lazy imports for optional OCR dependencies (pdf2pic + tesseract)
// These are only needed for scanned/image-based PDFs and are installed in production via Dockerfile.
// Making them dynamic prevents "npm run dev" from failing when they are not installed locally.
let pdf2picFromBuffer: any;
let createWorker: any;

interface ExtractResult {
  text: string | null;
  method: "text" | "pdfjs" | "hybrid" | "ocr";
  success: boolean;
  error?: string;
  pageCount?: number;
}

/**
 * Main extraction function.
 * Tries pdf-parse first (fast), then falls back to pdfjs-dist text extraction which is often better on complex/technical manuals.
 */
export async function extractPdfTextImproved(
  buffer: Buffer,
  options: { timeoutMs?: number } = {}
): Promise<ExtractResult> {
  const { timeoutMs = 30_000 } = options;

  let pdfParseText: string | null = null;
  let pdfjsText: string | null = null;
  let pageCount = 0;

  // Attempt 1: Fast pdf-parse
  try {
    pdfParseText = await extractWithPdfParse(buffer, Math.min(timeoutMs, 12_000));
  } catch (e: any) {
    console.warn("[pdf-extractor] pdf-parse failed:", e.message);
  }

  // Attempt 2: Stronger text extraction using pdfjs-dist (better for many technical PDFs)
  try {
    const result = await extractWithPdfJs(buffer, timeoutMs);
    pdfjsText = result.text;
    pageCount = result.pageCount;
  } catch (e: any) {
    console.warn("[pdf-extractor] pdfjs text extraction failed:", e.message);
  }

  // Combine results intelligently
  let finalText: string | null = null;
  let method: "text" | "pdfjs" | "hybrid" = "text";

  if (pdfParseText && pdfjsText) {
    if (pdfjsText.length > pdfParseText.length * 1.3) {
      finalText = pdfjsText;
      method = "pdfjs";
    } else {
      finalText = `${pdfParseText}\n\n${pdfjsText}`;
      method = "hybrid";
    }
  } else if (pdfjsText) {
    finalText = pdfjsText;
    method = "pdfjs";
  } else if (pdfParseText) {
    finalText = pdfParseText;
    method = "text";
  }

  const hasDecentText = finalText && finalText.length > 250;

  // OCR fallback for image-based PDFs (we always attempt it for better results on technical manuals)
  if (!hasDecentText) {
    try {
      const ocrText = await extractWithOcr(buffer, timeoutMs);
      if (ocrText && ocrText.length > 100) {
        finalText = finalText
          ? `${finalText}\n\n--- OCR Extracted Content ---\n${ocrText}`
          : ocrText;
        method = finalText.includes("OCR") ? "hybrid" : "ocr";
      }
    } catch (e: any) {
      console.warn("[pdf-extractor] OCR fallback failed:", e.message);
    }
  }

  if (finalText && finalText.length > 60000) {
    finalText = finalText.slice(0, 60000) + "\n[...truncated for length]";
  }

  return {
    text: finalText,
    method,
    success: !!finalText,
    pageCount,
    error: finalText ? undefined : "No extractable text found",
  };
}

/** Fast path - pdf-parse */
async function extractWithPdfParse(buffer: Buffer, timeoutMs: number): Promise<string | null> {
  const parser = new PDFParse({ data: buffer });
  const run = parser.getText().then((r) => r.text?.trim() || null);
  const timeout = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), timeoutMs)
  );

  try {
    return await Promise.race([run, timeout]);
  } finally {
    await parser.destroy().catch(() => {});
  }
}

/** Stronger text extraction using pdfjs-dist (often better on technical/equipment manuals) */
async function extractWithPdfJs(
  buffer: Buffer,
  timeoutMs: number
): Promise<{ text: string; pageCount: number }> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await Promise.race([
    loadingTask.promise,
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error("pdfjs-timeout")), timeoutMs)),
  ]);

  const pageCount = pdf.numPages;
  let fullText = "";

  // Extract text from all pages
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += `\n\n--- Page ${i} ---\n${pageText}`;
  }

  return {
    text: fullText.trim(),
    pageCount,
  };
}

/**
 * Real OCR path using pdf2pic + tesseract.js
 * 
 * This is the production path for image-based/scanned PDFs (very common in equipment & regulatory manuals).
 * 
 * Requirements on Railway:
 * - You will need `poppler-utils` and `tesseract-ocr` installed (usually via a custom Dockerfile or Nixpacks).
 */
async function extractWithOcr(buffer: Buffer, timeoutMs: number): Promise<string> {
  const start = Date.now();

  try {
    // Dynamic import so `npm run dev` doesn't crash if the optional OCR packages are not installed locally
    if (!pdf2picFromBuffer) {
      // @ts-expect-error - optional dep, not installed in all build environments
      const pdf2picMod = await import("pdf2pic");
      pdf2picFromBuffer = pdf2picMod.fromBuffer;
    }
    if (!createWorker) {
      // @ts-expect-error - optional dep, not installed in all build environments
      const tesseractMod = await import("tesseract.js");
      createWorker = tesseractMod.createWorker;
    }

    // Limit to first 10 pages for performance and to avoid very long processing times
    const convert = pdf2picFromBuffer(buffer, {
      density: 150,           // Lower density = faster + smaller images
      format: "png",
      width: 1200,
      preserveAspectRatio: true,
      pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // First 10 pages only
    });

    const results = await convert.bulk(-1, { responseType: "buffer" });
    const pages = Array.isArray(results) ? results : [results];

    const worker = await createWorker("eng", 1, {
      logger: () => {}, // silence tesseract logs
    });

    let fullText = "";
    const maxPages = Math.min(pages.length, 10);

    for (let i = 0; i < maxPages; i++) {
      if (Date.now() - start > timeoutMs) {
        console.warn("[pdf-extractor] OCR timeout reached");
        break;
      }

      const page = pages[i];
      const imageBuffer = (page as any).buffer || page;

      const { data: { text } } = await worker.recognize(imageBuffer as Buffer);
      fullText += `\n\n--- Page ${i + 1} ---\n${text}`;
    }

    await worker.terminate();
    return fullText.trim();
  } catch (err: any) {
    console.error("[pdf-extractor] OCR failed:", err.message);
    throw err;
  }
}