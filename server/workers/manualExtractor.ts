/**
 * Background worker for automatic manual processing (RAG pipeline).
 *
 * Rules:
 * - Only auto-process if the user has ≤ 3 unprocessed manuals.
 * - Uses the new ManualProcessor (heading-aware chunking + Voyage embeddings)
 * - Runs periodically and picks up manuals with status 'pending'
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ManualProcessor } from "../lib/manualProcessor";

const AUTO_EXTRACT_THRESHOLD = 3;
const WORKER_INTERVAL_MS = 25_000;

let isRunning = false;

export function startManualExtractionWorker(db: SupabaseClient) {
  console.log("[manual-processor] Background RAG worker started");

  const voyageApiKey = process.env.VOYAGE_API_KEY;
  if (!voyageApiKey) {
    console.warn("[manual-processor] VOYAGE_API_KEY not set — embeddings will be skipped");
  }

  const processor = new ManualProcessor(db, voyageApiKey || "");

  setInterval(async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      await processPendingManuals(db, processor);
    } catch (err) {
      console.error("[manual-processor] Worker error:", err);
    } finally {
      isRunning = false;
    }
  }, WORKER_INTERVAL_MS);
}

async function processPendingManuals(db: SupabaseClient, processor: ManualProcessor) {
  const { data: pendingManuals, error } = await db
    .from("manuals")
    .select("id, user_id, name")
    .eq("extraction_status", "pending")
    .not("file_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(30);

  if (error || !pendingManuals?.length) return;

  const byUser = new Map<string, any[]>();
  for (const m of pendingManuals) {
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
    byUser.get(m.user_id)!.push(m);
  }

  for (const [userId, manuals] of byUser.entries()) {
    const pendingCount = manuals.length;

    if (pendingCount > AUTO_EXTRACT_THRESHOLD) {
      console.log(`[manual-processor] User ${userId} has ${pendingCount} pending manuals — skipping auto-processing (threshold = ${AUTO_EXTRACT_THRESHOLD})`);
      continue;
    }

    for (const manual of manuals) {
      await processOneManual(db, processor, manual);
    }
  }
}

async function processOneManual(db: SupabaseClient, processor: ManualProcessor, manual: any) {
  const { id, user_id, name } = manual;

  console.log(`[manual-processor] Processing manual ${id} (${name})`);

  await db
    .from("manuals")
    .update({ extraction_status: "processing" })
    .eq("id", id);

  try {
    const result = await processor.processManual(id, user_id, {
      useOcr: true,
    });

    const status = result.success ? "completed" : "failed";
    const friendlyError = result.success ? null : friendlyExtractionError(result.error);

    await db
      .from("manuals")
      .update({
        extraction_status: status,
        extraction_method: result.method,
        extracted_at: result.success ? new Date().toISOString() : null,
        extraction_error: friendlyError,
      })
      .eq("id", id);

    console.log(`[manual-processor] Finished manual ${id} — ${result.chunksCreated} chunks created, status: ${status}`);
  } catch (err: any) {
    console.error(`[manual-processor] Failed to process manual ${id}:`, err.message);

    await db
      .from("manuals")
      .update({
        extraction_status: "failed",
        extraction_error: friendlyExtractionError(err.message),
      })
      .eq("id", id);
  }
}

/**
 * Convert technical errors into user-friendly messages for the UI
 */
function friendlyExtractionError(error: string | null | undefined): string {
  if (!error) return "Processing failed for an unknown reason.";

  const lower = error.toLowerCase();

  if (lower.includes("timeout")) {
    return "The file took too long to process. It may be very large or complex.";
  }
  if (lower.includes("fetch_failed") || lower.includes("failed to fetch")) {
    return "Could not download the file from storage. Please try uploading it again.";
  }
  if (lower.includes("no usable text") || lower.includes("no extractable text")) {
    return "We couldn't extract readable text from this file. It may be a scanned PDF or image-only document.";
  }
  if (lower.includes("unsupported")) {
    return "This file type is not supported for automatic processing.";
  }
  if (lower.includes("voyage") || lower.includes("embedding")) {
    return "The file was extracted, but we had trouble generating search embeddings.";
  }
  if (lower.includes("ocr") || lower.includes("tesseract")) {
    return "Text extraction using OCR failed. The document may have poor image quality.";
  }

  // Default fallback
  return "Processing failed. You can try re-extracting the file manually.";
}