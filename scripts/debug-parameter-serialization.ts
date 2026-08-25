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
  console.log(`DEBUGGING PARAMETER SERIALIZATION`)
  console.log(`${'═'.repeat(80)}\n`)

  const query1 = 'How do I find meaning and purpose in my work?'
  const query2 = 'How can I deal with anxiety and fear about the future?'

  const embedding1 = await embedQuery(query1)
  const embedding2 = await embedQuery(query2)

  console.log(`Embedding sizes:`)
  console.log(`  Query 1 JSON: ${JSON.stringify(embedding1).length} chars`)
  console.log(`  Query 2 JSON: ${JSON.stringify(embedding2).length} chars`)
  console.log()

  // Try encoding Query 2's embedding as a Postgres vector literal
  const query2Literal = `vector '[${embedding2.join(',')}]'`

  console.log(`Attempting to use Postgres vector literal syntax:`)
  console.log(`  Literal length: ${query2Literal.length} chars`)
  console.log(`  Literal sample: ${query2Literal.substring(0, 80)}...\n`)

  // Test 1: Send as array (current approach)
  console.log(`Test 1: Send Query 2 embedding as native array`)
  const { data: data1 } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding2 as any,
    match_count: 12,
    match_threshold: -1,
  })
  console.log(`  Result: ${data1 ? (data1 as any[]).length : 0} rows\n`)

  // Test 2: Cast embedding2 to Float32Array and back
  console.log(`Test 2: Convert to Float32Array then back to array`)
  const asFloat32 = new Float32Array(embedding2)
  const backToArray = Array.from(asFloat32)
  const { data: data2 } = await client.rpc('match_verse_chunks', {
    query_embedding: backToArray as any,
    match_count: 12,
    match_threshold: -1,
  })
  console.log(`  Result: ${data2 ? (data2 as any[]).length : 0} rows`)
  console.log(`  (Verify conversion preserved values: first=${backToArray[0].toFixed(6)}, original=${embedding2[0].toFixed(6)})\n`)

  // Test 3: Use first stored chunk's embedding + Query 2's text
  // to see if the text changes the result
  console.log(`Test 3: Try hybrid_search_verse_chunks with Query 2 text`)
  const { data: data3 } = await client.rpc('hybrid_search_verse_chunks', {
    query_embedding: embedding1 as any, // Use Query 1's embedding (which works)
    query_text: query2, // But search for Query 2 terms
    vector_weight: 0.6,
    fts_weight: 0.4,
    match_count: 12,
  })
  console.log(`  Result: ${data3 ? (data3 as any[]).length : 0} rows`)
  console.log(`  (This tells us if query_embedding is the issue vs. query_text)\n`)

  console.log(`${'═'.repeat(80)}\n`)
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
