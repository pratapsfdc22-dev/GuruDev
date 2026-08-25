import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function applyFix(): Promise<void> {
  console.log(`\n${'═'.repeat(80)}`)
  console.log(`APPLYING EMBEDDING TYPE FIX`)
  console.log(`${'═'.repeat(80)}\n`)

  // The migration needs to be run manually in Supabase SQL Editor
  // This script will:
  // 1. Check current column type
  // 2. Show the SQL commands needed
  // 3. Explain what will happen

  console.log(`This fix converts embeddings from TEXT/JSON strings to native vector(1024) type.\n`)

  console.log(`SQL commands to run in Supabase SQL Editor:\n`)

  const sql = `
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
`

  console.log(sql)

  console.log(`\nExpected outcome:`)
  console.log(`- All 7,404 embeddings converted from STRING format to native vector(1024)`)
  console.log(`- RPC match_verse_chunks will then compute distances correctly`)
  console.log(`- Vector similarity search will return non-zero results for all queries`)
  console.log(`- Distance calculations will no longer produce NaN values`)

  console.log(`\nIMPORTANT: Run this in Supabase SQL Editor, NOT via this script.`)
  console.log(`1. Go to Supabase Dashboard → Your Project → SQL Editor`)
  console.log(`2. Click "New Query"`)
  console.log(`3. Paste the SQL above`)
  console.log(`4. Click "Run"`)
  console.log(`5. Wait for it to complete (may take 1-2 minutes for 7,404 rows)`)

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

applyFix().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
