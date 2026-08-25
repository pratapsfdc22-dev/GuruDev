import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !VOYAGE_API_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function embedQuery(query: string): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
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

async function test(): Promise<void> {
  console.log(`\n${'═'.repeat(80)}`)
  console.log(`TESTING RPC PARAMETER TYPE HANDLING`)
  console.log(`${'═'.repeat(80)}\n`)

  const query = 'How can I deal with anxiety and fear about the future?'
  const embedding = await embedQuery(query)

  console.log(`Query: "${query}"`)
  console.log(`Embedding: array of ${embedding.length} floats`)
  console.log(`First 3 values: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}]\n`)

  // Test 1: Call RPC with array directly (as we do now)
  console.log(`Test 1: RPC call with array parameter`)
  console.log(`  Parameters: { query_embedding: [number[], match_count: 12, match_threshold: -1 }`)

  const { data: result1, error: error1 } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding,
    match_count: 12,
    match_threshold: -1,
  })

  console.log(`  Result: ${error1 ? `ERROR: ${error1.message}` : `${result1 ? (result1 as any[]).length : 0} rows`}\n`)

  // Test 2: Call with a different query to see if that one works
  console.log(`Test 2: RPC call with different query (meaning/purpose in work)`)
  const embedding2 = await embedQuery('How do I find meaning and purpose in my work?')

  const { data: result2, error: error2 } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding2,
    match_count: 12,
    match_threshold: -1,
  })

  console.log(`  Result: ${error2 ? `ERROR: ${error2.message}` : `${result2 ? (result2 as any[]).length : 0} rows`}\n`)

  // Test 3: Check if row-level data shows distances
  console.log(`Test 3: Fetching raw verse_chunks and computing distances locally`)

  const { data: chunks, error: chunksError } = await client
    .from('verse_chunks')
    .select('book, chapter, verse, embedding')
    .limit(5)

  if (chunksError) {
    console.log(`  Error: ${chunksError.message}`)
  } else if (chunks && chunks.length > 0) {
    console.log(`  Fetched ${chunks.length} chunks, checking distance calculation:\n`)

    ;(chunks as any[]).forEach((chunk, idx) => {
      const storedEmb = chunk.embedding as number[]
      const distance = cosineDist(embedding, storedEmb)
      const similarity = 1 - distance

      console.log(
        `    ${idx + 1}. ${chunk.book} ${chunk.chapter}.${chunk.verse}: distance=${distance.toFixed(4)}, similarity=${similarity.toFixed(4)}`
      )
    })

    // Find minimum distance
    const distances = (chunks as any[]).map((chunk: any) => {
      const storedEmb = chunk.embedding as number[]
      return cosineDist(embedding, storedEmb)
    })
    const minDistance = Math.min(...distances)
    console.log(`\n  Minimum distance in sample: ${minDistance.toFixed(4)}`)
    console.log(`  Distance threshold for match_threshold=-1: 2.0`)
    console.log(`  Should accept? ${minDistance < 2.0 ? 'YES' : 'NO'}`)
  }

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

function cosineDist(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  const similarity = dot / (normA * normB)
  return 1 - similarity
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
