-- RPC function for semantic search over manual_chunks using cosine similarity
-- This is the core of the RAG retrieval for Saffi/Hermes.

CREATE OR REPLACE FUNCTION match_manual_chunks(
  query_embedding vector(1024),
  match_count int DEFAULT 6,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  manual_id uuid,
  manual_name text,
  content text,
  page_number integer,
  section_title text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.manual_id,
    m.name AS manual_name,
    mc.content,
    mc.page_number,
    mc.section_title,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM manual_chunks mc
  JOIN manuals m ON m.id = mc.manual_id
  WHERE 
    (filter_user_id IS NULL OR mc.user_id = filter_user_id)
    AND mc.embedding IS NOT NULL
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;