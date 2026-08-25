-- Fix: Convert embedding column from TEXT/JSONB to native vector(1024) type
-- The embeddings were stored as JSON string representations instead of native vectors
-- This migration converts all existing data and changes the column type

BEGIN;

-- Step 1: Create a temporary column of correct type
ALTER TABLE verse_chunks
ADD COLUMN embedding_fixed vector(1024);

-- Step 2: Convert the string representation to actual vector type
UPDATE verse_chunks
SET embedding_fixed = embedding::vector(1024)
WHERE embedding IS NOT NULL;

-- Step 3: Drop the old column and rename the new one
ALTER TABLE verse_chunks
DROP COLUMN embedding;

ALTER TABLE verse_chunks
RENAME COLUMN embedding_fixed TO embedding;

-- Step 4: Recreate indexes on the fixed column
CREATE INDEX idx_verse_chunks_embedding_hnsw ON verse_chunks
USING hnsw (embedding vector_cosine_ops);

COMMIT;
