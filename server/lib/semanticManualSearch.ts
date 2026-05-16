/**
 * Semantic Manual Search (RAG)
 * 
 * Uses pgvector cosine similarity on the manual_chunks table.
 * This is the proper way Saffi/Hermes should retrieve information from manuals.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { generateVoyageEmbedding } from "./voyageEmbeddings";

export interface SemanticManualMatch {
  manual_id: string;
  manual_name: string;
  content: string;
  page_number?: number;
  section_title?: string;
  similarity: number;
}

export async function searchManualsSemantic(
  db: SupabaseClient,
  userId: string,
  query: string,
  limit = 6
): Promise<{ matches: SemanticManualMatch[]; summary: string }> {
  if (!query?.trim()) {
    return { matches: [], summary: "Please provide a search query." };
  }

  const voyageApiKey = process.env.VOYAGE_API_KEY;
  if (!voyageApiKey) {
    return {
      matches: [],
      summary: "Semantic search is not configured (missing VOYAGE_API_KEY).",
    };
  }

  try {
    // 1. Generate embedding for the query using Voyage-3
    const queryEmbedding = await generateVoyageEmbedding(query, voyageApiKey);

    // 2. Perform vector similarity search (cosine)
    // Note: pgvector cosine similarity returns distance (lower is better), so we use 1 - similarity for ranking.
    const { data, error } = await db.rpc("match_manual_chunks", {
      query_embedding: queryEmbedding,
      match_count: limit,
      filter_user_id: userId,
    });

    if (error) {
      console.error("[semanticManualSearch] RPC error:", error);
      return {
        matches: [],
        summary: "I had trouble searching the manuals semantically.",
      };
    }

    const matches: SemanticManualMatch[] = (data || []).map((row: any) => ({
      manual_id: row.manual_id,
      manual_name: row.manual_name,
      content: row.content,
      page_number: row.page_number,
      section_title: row.section_title,
      similarity: row.similarity,
    }));

    if (matches.length === 0) {
      return {
        matches: [],
        summary: `I couldn't find any relevant information in your manuals for "${query}".`,
      };
    }

    // Build a well-structured summary optimized for Saffi to cite properly
    const summaryLines = matches.map((m, i) => {
      const locationParts = [m.manual_name];
      if (m.section_title) locationParts.push(m.section_title);
      if (m.page_number) locationParts.push(`p.${m.page_number}`);

      const location = locationParts.join(" → ");

      const snippet = m.content.length > 320 
        ? m.content.slice(0, 320) + "..." 
        : m.content;

      return `${i + 1}. Source: ${location}\n"${snippet}"`;
    });

    const summary = `Here are the most relevant excerpts from your manuals regarding "${query}":\n\n${summaryLines.join("\n\n")}\n\nWhen answering, quote the most useful parts and clearly cite the source (manual name + section/page).`;

    return { matches, summary };
  } catch (err: any) {
    console.error("[semanticManualSearch] Error:", err);
    return {
      matches: [],
      summary: "I encountered an error while performing semantic search on your manuals.",
    };
  }
}