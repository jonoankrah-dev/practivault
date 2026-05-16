/**
 * Voyage AI Embeddings Helper
 * 
 * Uses Voyage AI voyage-3 model (1024 dimensions)
 * 
 * Docs: https://docs.voyageai.com/docs/embeddings
 */

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

interface VoyageEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

export async function generateVoyageEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  if (!apiKey) {
    throw new Error("Voyage AI API key is missing");
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model: "voyage-3",
      input_type: "document", // or "query" when doing retrieval
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voyage AI error: ${response.status} - ${errorText}`);
  }

  const json: VoyageEmbeddingResponse = await response.json();

  if (!json.data || json.data.length === 0) {
    throw new Error("No embedding returned from Voyage AI");
  }

  return json.data[0].embedding;
}

/**
 * Batch version - more efficient for many chunks
 */
export async function generateVoyageEmbeddings(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  if (!apiKey) throw new Error("Voyage AI API key is missing");
  if (texts.length === 0) return [];

  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: "voyage-3",
      input_type: "document",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voyage AI batch error: ${response.status} - ${errorText}`);
  }

  const json: VoyageEmbeddingResponse = await response.json();
  return json.data.map((d) => d.embedding);
}