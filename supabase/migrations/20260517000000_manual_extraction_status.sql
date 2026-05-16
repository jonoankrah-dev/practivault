-- Add extraction status tracking to manuals
-- This enables automatic background extraction for small numbers of manuals

ALTER TABLE public.manuals
ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS extraction_method text,
ADD COLUMN IF NOT EXISTS extracted_at timestamptz,
ADD COLUMN IF NOT EXISTS extraction_error text;

-- Backfill existing rows
-- If they already have extracted_text, mark as completed
UPDATE public.manuals
SET 
  extraction_status = 'completed',
  extraction_method = 'text',
  extracted_at = COALESCE(updated_at, created_at)
WHERE extracted_text IS NOT NULL 
  AND extraction_status = 'pending';

-- For manuals with no extracted_text, keep as 'pending' so the background worker picks them up

-- Add index for efficient worker queries
CREATE INDEX IF NOT EXISTS idx_manuals_extraction_status 
ON public.manuals (user_id, extraction_status) 
WHERE extraction_status IN ('pending', 'processing');

COMMENT ON COLUMN public.manuals.extraction_status IS 'pending | processing | completed | failed';
COMMENT ON COLUMN public.manuals.extraction_method IS 'text | ocr | null';
COMMENT ON COLUMN public.manuals.extracted_at IS 'When text extraction (including OCR) finished successfully';