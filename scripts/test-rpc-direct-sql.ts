import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SERVICE_KEY)

async function test() {
  console.log('='.repeat(80))
  console.log('DIRECT SQL TEST: match_verse_chunks with a real stored embedding')
  console.log('='.repeat(80))

  console.log('\nTest query:')
  console.log(`
  SELECT * FROM match_verse_chunks(
    (SELECT embedding FROM verse_chunks LIMIT 1),
    12,
    -1
  );
  `)
  console.log('(Using first chunk\'s actual embedding from database)')

  // First, fetch one real embedding
  console.log('\nStep 1: Fetching first chunk and its embedding...')
  const { data: firstChunk } = await client
    .from('verse_chunks')
    .select('id, book, chapter, verse, embedding')
    .limit(1)

  if (!firstChunk || firstChunk.length === 0) {
    console.log('ERROR: No chunks found in database')
    process.exit(1)
  }

  const chunk = firstChunk[0] as any
  const realEmbedding = chunk.embedding as number[]

  console.log(`✓ Fetched: ${chunk.book} ${chunk.chapter}.${chunk.verse}`)
  console.log(`  Embedding dimensions: ${realEmbedding.length}`)
  console.log(`  First 3 values: [${realEmbedding.slice(0, 3).map((v) => v.toFixed(4)).join(', ')}]`)

  // Now call the RPC with this embedding
  console.log(`\nStep 2: Calling match_verse_chunks with this embedding...`)
  console.log(`  query_embedding: [array of ${realEmbedding.length} floats]`)
  console.log(`  match_count: 12`)
  console.log(`  match_threshold: -1`)

  const { data, error } = await client.rpc('match_verse_chunks', {
    query_embedding: realEmbedding,
    match_count: 12,
    match_threshold: -1,
  })

  console.log(`\nStep 3: RPC Response`)
  console.log(`  Status: ${error ? 'ERROR' : 'OK'}`)

  if (error) {
    console.log(`  Error: ${error.message}`)
    console.log(`  Error details: ${JSON.stringify(error)}`)
  } else {
    if (Array.isArray(data)) {
      console.log(`  Rows returned: ${data.length}`)

      if (data.length > 0) {
        console.log(`\n  First result:`)
        const first = data[0] as any
        console.log(`    book: ${first.book}`)
        console.log(`    chapter: ${first.chapter}`)
        console.log(`    verse: ${first.verse}`)
        console.log(`    similarity: ${first.similarity}`)
        console.log(`    chunk_text (first 80 chars): ${(first.chunk_text as string).substring(0, 80)}`)

        console.log(`\n  All ${data.length} results:`)
        ;(data as any[]).forEach((r, idx) => {
          console.log(
            `    ${idx + 1}. ${r.book} ${r.chapter}.${r.verse} (similarity: ${r.similarity.toFixed(4)})`
          )
        })
      } else {
        console.log(`  ⚠️ ZERO ROWS returned (even with a real stored embedding!)`)
      }
    } else {
      console.log(`  Unexpected response type: ${typeof data}`)
      console.log(`  Response: ${JSON.stringify(data)}`)
    }
  }

  console.log(`\n${'='.repeat(80)}\n`)
  process.exit(0)
}

test().catch(console.error)
