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
  console.log(`TESTING EMBEDDING STRING FORMAT FIX`)
  console.log(`${'═'.repeat(80)}\n`)

  const query2 = 'How can I deal with anxiety and fear about the future?'
  const embedding2 = await embedQuery(query2)

  console.log(`Query 2: "${query2}"`)
  console.log(`Generated embedding: ${embedding2.length} dimensions\n`)

  // Test 1: Array (currently broken)
  console.log(`Test 1: Passing as array (current behavior)`)
  const { data: data1 } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding2,
    match_count: 12,
    match_threshold: -1,
  })
  console.log(`  Result: ${data1 ? (data1 as any[]).length : 0} rows\n`)

  // Test 2: Convert to string format "[0.1, 0.2, ...]"
  console.log(`Test 2: Passing as string format "[val1, val2, ...]"`)
  const embeddingString = `[${embedding2.join(',')}]`
  const { data: data2 } = await client.rpc('match_verse_chunks', {
    query_embedding: embeddingString,
    match_count: 12,
    match_threshold: -1,
  })
  console.log(`  Result: ${data2 ? (data2 as any[]).length : 0} rows`)
  if (data2 && (data2 as any[]).length > 0) {
    const first = (data2 as any[])[0]
    console.log(`  Top: ${first.book} ${first.chapter}.${first.verse}, similarity=${first.similarity.toFixed(4)}\n`)
  } else {
    console.log()
  }

  // Test 3: Try Postgres array syntax "{0.1, 0.2, ...}"
  console.log(`Test 3: Passing as Postgres array format "{val1, val2, ...}"`)
  const embeddingPostgres = `{${embedding2.join(',')}}`
  const { data: data3 } = await client.rpc('match_verse_chunks', {
    query_embedding: embeddingPostgres,
    match_count: 12,
    match_threshold: -1,
  })
  console.log(`  Result: ${data3 ? (data3 as any[]).length : 0} rows\n`)

  console.log(`${'═'.repeat(80)}\n`)
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
