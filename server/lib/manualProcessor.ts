/**
 * Manual Processor - Core RAG Processing Engine
 *
 * This is the central engine that will:
 * 1. Extract text from a manual (with OCR fallback later)
 * 2. Perform heading-aware chunking
 * 3. Generate embeddings using Voyage AI voyage-3
 * 4. Store chunks + embeddings into the manual_chunks table
 *
 * Designed to run in the background worker.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// =====================================================
// TYPES
// =====================================================

export interface ManualChunk {
  content: string;
  pageNumber?: number;
  sectionTitle?: string;
  chunkIndex: number;
  metadata?: Record<string, any>;
}

export interface ProcessManualOptions {
  maxTokensPerChunk?: number;      // Target chunk size (default ~900 for voyage-3)
  overlapTokens?: number;          // Overlap between chunks
  useOcr?: boolean;                // Whether to force OCR (we'll wire this later)
}

export interface ProcessManualResult {
  success: boolean;
  chunksCreated: number;
  method: string;
  error?: string;
}

// =====================================================
// MAIN PROCESSOR
// =====================================================

export class ManualProcessor {
  private db: SupabaseClient;
  private voyageApiKey: string;

  constructor(db: SupabaseClient, voyageApiKey: string) {
    this.db = db;
    this.voyageApiKey = voyageApiKey;
  }

  /**
   * Main entry point: Process a manual end-to-end
   */
  async processManual(
    manualId: string,
    userId: string,
    options: ProcessManualOptions = {}
  ): Promise<ProcessManualResult> {
    const opts: Required<ProcessManualOptions> = {
      maxTokensPerChunk: options.maxTokensPerChunk ?? 900,
      overlapTokens: options.overlapTokens ?? 150,
      useOcr: options.useOcr ?? true,
    };

    try {
      // 1. Get manual details + file
      const manual = await this.getManual(manualId, userId);
      if (!manual?.file_url) {
        return { success: false, chunksCreated: 0, method: "none", error: "Manual not found or missing file" };
      }

      // 2. Extract text (we'll improve this with OCR in the next phase)
      const extracted = await this.extractText(manual.file_url, manual.file_name, opts.useOcr);

      if (!extracted.text || extracted.text.length < 50) {
        return { success: false, chunksCreated: 0, method: extracted.method, error: "No usable text extracted" };
      }

      // 3. Heading-aware chunking
      const chunks = this.chunkWithHeadings(extracted.text, opts);

      if (chunks.length === 0) {
        return { success: false, chunksCreated: 0, method: "chunking", error: "Chunking produced no output" };
      }

      // 4. Generate Voyage-3 embeddings
      const chunksWithEmbeddings = await this.generateEmbeddings(chunks);

      // 5. Store chunks + embeddings
      await this.storeChunks(manualId, userId, chunksWithEmbeddings);

      return {
        success: true,
        chunksCreated: chunks.length,
        method: extracted.method,
      };
    } catch (error: any) {
      console.error("[ManualProcessor] Error processing manual:", error);
      return {
        success: false,
        chunksCreated: 0,
        method: "error",
        error: error.message,
      };
    }
  }

  // =====================================================
  // STEP 1: Get Manual
  // =====================================================
  private async getManual(manualId: string, userId: string) {
    const { data, error } = await this.db
      .from("manuals")
      .select("id, name, file_url, file_name, extraction_status")
      .eq("id", manualId)
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return data;
  }

  // =====================================================
  // STEP 2: Text Extraction (Placeholder for now)
  // =====================================================
  private async extractText(fileUrl: string, fileName: string, useOcr: boolean) {
    // TODO: Replace this with proper extraction + OCR
    // For now, we fetch the file and do basic extraction.
    // This will be replaced with the improved pdfExtractor + OCR in the next phase.

    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const lowerName = fileName.toLowerCase();

    let text = "";
    let method = "unknown";

    if (lowerName.endsWith(".pdf")) {
      // Temporary: use the improved text extractor we just built
      const { extractPdfTextImproved } = await import("./pdfExtractor");
      const result = await extractPdfTextImproved(buffer);
      text = result.text || "";
      method = result.method;
    } else if (lowerName.endsWith(".docx")) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || "";
      method = "docx";
    } else if (lowerName.endsWith(".txt")) {
      text = buffer.toString("utf-8");
      method = "txt";
    }

    return { text, method };
  }

  // =====================================================
  // STEP 3: Heading-Aware Chunking (Starting here)
  // =====================================================
  private chunkWithHeadings(text: string, opts: Required<ProcessManualOptions>): ManualChunk[] {
    const chunks: ManualChunk[] = [];

    // Split by common heading patterns
    // This is a practical heuristic for technical manuals
    const lines = text.split("\n");
    const sections: { title: string; content: string[] }[] = [];

    let currentTitle = "Introduction";
    let currentContent: string[] = [];

    const headingRegex = /^(?:\d+\.?\d*\s+|[A-Z][A-Z\s]{3,}|Chapter|Section|Appendix|Introduction|Conclusion|Overview|Procedure|Safety|Specification|Maintenance)/i;

    for (const line of lines) {
      const trimmed = line.trim();

      if (headingRegex.test(trimmed) && trimmed.length < 120) {
        // New heading found
        if (currentContent.length > 0) {
          sections.push({ title: currentTitle, content: currentContent });
        }
        currentTitle = trimmed;
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Push last section
    if (currentContent.length > 0) {
      sections.push({ title: currentTitle, content: currentContent });
    }

    // Now chunk within each section
    let chunkIndex = 0;

    for (const section of sections) {
      const sectionText = section.content.join("\n").trim();
      if (!sectionText) continue;

      const sectionChunks = this.splitIntoChunks(sectionText, opts.maxTokensPerChunk, opts.overlapTokens);

      for (const chunkText of sectionChunks) {
        chunks.push({
          content: chunkText,
          sectionTitle: section.title,
          chunkIndex: chunkIndex++,
        });
      }
    }

    return chunks;
  }

  /**
   * Split text into chunks with overlap (simple token approximation)
   */
  private splitIntoChunks(text: string, maxTokens: number, overlap: number): string[] {
    const chunks: string[] = [];
    const words = text.split(/\s+/);
    const approxTokens = (str: string) => Math.ceil(str.length / 4); // rough token estimate

    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const word of words) {
      const wordLength = approxTokens(word);

      if (currentLength + wordLength > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));

        // Overlap
        const overlapWords = currentChunk.slice(-Math.floor(overlap / 4));
        currentChunk = [...overlapWords, word];
        currentLength = approxTokens(currentChunk.join(" "));
      } else {
        currentChunk.push(word);
        currentLength += wordLength;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "));
    }

    return chunks;
  }

  // =====================================================
  // STEP 4: Embedding Generation using Voyage-3
  // =====================================================
  private async generateEmbeddings(chunks: ManualChunk[]): Promise<ManualChunk[]> {
    if (!this.voyageApiKey) {
      console.warn("[ManualProcessor] No Voyage AI key provided - skipping embeddings");
      return chunks;
    }

    const { generateVoyageEmbeddings } = await import("./voyageEmbeddings");

    try {
      const texts = chunks.map((c) => c.content);
      const embeddings = await generateVoyageEmbeddings(texts, this.voyageApiKey);

      return chunks.map((chunk, index) => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          embedding_model: "voyage-3",
        },
        // We'll store the actual vector separately when inserting
        embedding: embeddings[index],
      }));
    } catch (error: any) {
      console.error("[ManualProcessor] Voyage embedding failed:", error.message);
      // Return chunks without embeddings rather than failing the whole job
      return chunks;
    }
  }

  // =====================================================
  // STEP 5: Store Chunks + Embeddings
  // =====================================================
  private async storeChunks(manualId: string, userId: string, chunks: ManualChunk[]) {
    const rows = chunks.map((chunk, index) => ({
      manual_id: manualId,
      user_id: userId,
      content: chunk.content,
      page_number: chunk.pageNumber,
      section_title: chunk.sectionTitle,
      chunk_index: chunk.chunkIndex ?? index,
      metadata: chunk.metadata || {},
      embedding: (chunk as any).embedding || null,
    }));

    // Delete old chunks first (for re-processing)
    await this.db.from("manual_chunks").delete().eq("manual_id", manualId);

    const { error } = await this.db.from("manual_chunks").insert(rows);
    if (error) throw error;
  }
}