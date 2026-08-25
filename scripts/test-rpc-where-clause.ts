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
  console.log(`TESTING RPC WHERE CLAUSE BEHAVIOR`)
  console.log(`${'═'.repeat(80)}\n`)

  const query2 = 'How can I deal with anxiety and fear about the future?'
  const embedding2 = await embedQuery(query2)

  console.log(`Query 2: "${query2}"`)
  console.log(`Embedding: 1024 dims, L2 norm = 1.0\n`)

  // Test: Call with match_threshold values that progressively INCREASE the distance threshold
  console.log(`Testing progressive thresholds (progressively more permissive):\n`)

  const thresholds = [2, 1, 0, -1, -0.5, -0.99, -0.999, -1.999, -2]

  for (const threshold of thresholds) {
    const maxDistance = 1 - threshold
    const { data, error } = await client.rpc('match_verse_chunks', {
      query_embedding: embedding2 as any,
      match_count: 12,
      match_threshold: threshold,
    })

    const count = data ? (data as any[]).length : 0

    console.log(`  threshold=${threshold.toFixed(3).padStart(6)}: distance < ${maxDistance.toFixed(1).padStart(4)} => ${count} rows${error ? ` ERROR: ${error.message}` : ''}`)
  }

  // Try reversing: test with Query 1 (which works) at same thresholds
  console.log(`\n${'─'.repeat(80)}`)
  console.log(`For comparison - Query 1 with same thresholds:\n`)

  const query1 = 'How do I find meaning and purpose in my work?'
  const embedding1 = await embedQuery(query1)

  console.log(`Query 1: "${query1}"`)
  console.log(`Embedding: 1024 dims, L2 norm = 1.0\n`)

  for (const threshold of thresholds) {
    const maxDistance = 1 - threshold
    const { data, error } = await client.rpc('match_verse_chunks', {
      query_embedding: embedding1 as any,
      match_count: 12,
      match_threshold: threshold,
    })

    const count = data ? (data as any[]).length : 0
    console.log(`  threshold=${threshold.toFixed(3).padStart(6)}: distance < ${maxDistance.toFixed(1).padStart(4)} => ${count} rows${error ? ` ERROR: ${error.message}` : ''}`)
  }

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
