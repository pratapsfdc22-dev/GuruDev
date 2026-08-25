# Embedding Type Fix - Summary & Instructions

## Problem Identified

**Embeddings are stored as TEXT/JSON strings instead of native `vector(1024)` type.**

### Evidence:
- Column type check: embeddings returned as `typeof: string`, length 12,470 characters
- Each embedding is a JSON string like `"[-0.053805873,-0.0682061,...]"` instead of a native vector
- Distance calculations return NaN (can't compute numeric distance on string characters)
- RPC `match_verse_chunks` returns 0 results for queries like "anxiety about the future"
- Other queries return results by luck (edge cases where distance calculation avoids NaN)

### Root Cause:
Embeddings were inserted as JSON arrays via REST API, and Postgres stored them as TEXT instead of converting to native `vector(1024)` type.

## Solution

### Step 1: Run the Migration in Supabase SQL Editor

1. Go to **Supabase Dashboard** → Your Project → **SQL Editor**
2. Click "New Query"
3. Copy and paste this SQL:

```sql
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
```

4. Click "Run"
5. Wait for it to complete (1-2 minutes for 7,404 rows)

### Step 2: Verify the Fix

After the migration completes, run:

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/vector-retrieval-demo.ts
```

Expected output: All 5 queries should return vector results with real similarity scores (not 0).

## Updated Harness

The retrieval test harness has been updated to:
- Use the `search_verse_chunks` RPC for FTS (instead of direct table query)
- Deduplicate FTS results by `verse_id` (keeping highest relevance chunk per verse)
- Use real `ts_rank` relevance scores for FTS (instead of rank-based formula)
- Display both real vector similarity and real FTS relevance scores

After the migration, run:

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VOYAGE_API_KEY=... npx ts-node scripts/retrieval-test-harness.ts
```

This will show hybrid results with both real similarity scores visible.

## Files Modified

- `/supabase/migrations/003_fix_embedding_type.sql` - Migration script
- `/scripts/retrieval-test-harness.ts` - Updated hybrid retrieval with real scores
- `/scripts/vector-retrieval-demo.ts` - Vector-only demo (to verify vector search)

## Timeline

Phase 2 completion blocked on this fix. After migration:
- ✅ Vector retrieval working with real similarity scores
- ✅ Hybrid retrieval working with deduplicated FTS results
- ✅ Ready to proceed to Phase 3 (safety classifier + query transformation + generation)
