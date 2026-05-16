-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- MANUAL CHUNKS TABLE (for RAG / Semantic Search)
-- =====================================================
CREATE TABLE public.manual_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id uuid NOT NULL REFERENCES public.manuals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The actual text content of this chunk
  content text NOT NULL,

  -- Vector embedding (Voyage AI voyage-3 = 1024 dimensions)
  embedding vector(1024),

  -- Useful metadata for retrieval and display
  page_number integer,
  section_title text,                    -- Heading/section name (helpful for heading-aware chunking)
  chunk_index integer NOT NULL,          -- Order within the manual

  -- Flexible metadata (e.g. heading level, chunk_type, etc.)
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_manual_chunks_manual_id ON public.manual_chunks (manual_id);
CREATE INDEX idx_manual_chunks_user_id ON public.manual_chunks (user_id);

-- Vector similarity search index (HNSW is generally best for cosine similarity)
CREATE INDEX idx_manual_chunks_embedding 
ON public.manual_chunks USING hnsw (embedding vector_cosine_ops);

-- Composite index for common query patterns
CREATE INDEX idx_manual_chunks_user_manual 
ON public.manual_chunks (user_id, manual_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE public.manual_chunks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own manual chunks
CREATE POLICY "Users can view their own manual chunks"
ON public.manual_chunks
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert chunks for their own manuals
CREATE POLICY "Users can insert chunks for their manuals"
ON public.manual_chunks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own chunks
CREATE POLICY "Users can update their own chunks"
ON public.manual_chunks
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own chunks
CREATE POLICY "Users can delete their own chunks"
ON public.manual_chunks
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGER FOR updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_manual_chunks_updated_at
BEFORE UPDATE ON public.manual_chunks
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- HELPFUL COMMENTS
-- =====================================================
COMMENT ON TABLE public.manual_chunks IS 'Stores chunked content from manuals with vector embeddings for semantic search (RAG)';
COMMENT ON COLUMN public.manual_chunks.embedding IS 'Voyage AI voyage-3 embedding (1024 dimensions)';
COMMENT ON COLUMN public.manual_chunks.section_title IS 'Heading or section title (used for heading-aware chunking)';
COMMENT ON COLUMN public.manual_chunks.metadata IS 'Flexible metadata (chunk_type, heading_level, etc.)';