-- Run this directly in Supabase SQL Editor
-- Query 1: Column definition
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'verse_chunks' AND column_name = 'embedding';

-- Query 2: NULL count
SELECT count(*) as null_count FROM verse_chunks WHERE embedding IS NULL;

-- Query 3: Sample embedding (from first row)
SELECT embedding FROM verse_chunks LIMIT 1;
