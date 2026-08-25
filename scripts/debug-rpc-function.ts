import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY || !VOYAGE_API_KEY) {
  console.error('Missing env vars')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SERVICE_KEY)

async function embedQuery(query: string): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [query],
      model: 'voyage-3',
    }),
  })

  if (!response.ok) {
    throw new Error(`Voyage API error: ${response.status}`)
  }

  const data = (await response.json()) as any
  return data.data[0].embedding
}

async function debug() {
  console.log('='.repeat(80))
  console.log('DEBUGGING RPC FUNCTION BEHAVIOR')
  console.log('='.repeat(80))

  // First, verify embeddings exist in the database
  console.log('\n1. Checking if embeddings exist in database...')
  const { data: countData } = await client
    .from('verse_chunks')
    .select('id', { count: 'exact', head: true })

  console.log(`   Total chunks: ${countData?.length || 'unknown'}`)

  // Try getting a chunk directly with embedding
  const { data: sampleChunk } = await client
    .from('verse_chunks')
    .select('id, book, chapter, verse, embedding')
    .limit(1)

  if (sampleChunk && sampleChunk.length > 0) {
    const chunk = sampleChunk[0] as any
    console.log(`   Sample chunk has embedding: ${chunk.embedding ? '✓ YES' : '✗ NO'}`)
    if (chunk.embedding) {
      console.log(`   Embedding dimensions: ${(chunk.embedding as number[]).length}`)
    }
  }

  // Now test with a simple query
  console.log('\n2. Testing match_verse_chunks with a simple embedding...')

  // Create a dummy embedding (all zeros)
  const dummyEmbedding = Array(1024).fill(0)
  console.log(`   Calling with dummy embedding (1024 zeros)...`)

  const { data: dummyResult, error: dummyError } = await client.rpc(
    'match_verse_chunks',
    {
      query_embedding: dummyEmbedding,
      match_count: 12,
      match_threshold: -1,
    }
  )

  if (dummyError) {
    console.log(`   ✗ ERROR: ${dummyError.message}`)
  } else {
    console.log(`   ✓ Returned ${dummyResult?.length || 0} results`)
  }

  // Now test with the anxiety query
  console.log('\n3. Testing with actual "anxiety" query embedding...')
  const anxietyQuery = 'How can I deal with anxiety and fear about the future?'
  const anxietyEmbedding = await embedQuery(anxietyQuery)
  console.log(`   Embedding created, dimensions: ${anxietyEmbedding.length}`)

  const { data: anxietyResult, error: anxietyError } = await client.rpc(
    'match_verse_chunks',
    {
      query_embedding: anxietyEmbedding,
      match_count: 12,
      match_threshold: -1,
    }
  )

  if (anxietyError) {
    console.log(`   ✗ ERROR: ${anxietyError.message}`)
  } else {
    console.log(`   ✓ Returned ${anxietyResult?.length || 0} results`)

    if (!anxietyResult || anxietyResult.length === 0) {
      console.log('\n   ⚠️ ZERO RESULTS - Investigating why...')

      // Try direct SQL-like query to see what's happening
      console.log('\n   Testing direct query for any chunks with valid embeddings...')
      const { data: directTest } = await client
        .from('verse_chunks')
        .select('id, book, chapter, verse')
        .limit(1)

      if (directTest && directTest.length > 0) {
        console.log(`   ✓ Can fetch chunks directly`)
        console.log(`   First chunk: ${directTest[0].book} ${directTest[0].chapter}.${directTest[0].verse}`)
      }

      // Check if the RPC function definition itself is working
      console.log('\n   Checking RPC function with match_threshold = 0.5...')
      const { data: thresholdResult } = await client.rpc('match_verse_chunks', {
        query_embedding: anxietyEmbedding,
        match_count: 12,
        match_threshold: 0.5,
      })

      console.log(`   With threshold=0.5: ${thresholdResult?.length || 0} results`)

      console.log('\n   Checking RPC function with match_threshold = -0.9...')
      const { data: thresholdResult2 } = await client.rpc('match_verse_chunks', {
        query_embedding: anxietyEmbedding,
        match_count: 12,
        match_threshold: -0.9,
      })

      console.log(`   With threshold=-0.9: ${thresholdResult2?.length || 0} results`)
    }
  }

  console.log(`\n${'='.repeat(80)}\n`)
  process.exit(0)
}

debug().catch(console.error)
