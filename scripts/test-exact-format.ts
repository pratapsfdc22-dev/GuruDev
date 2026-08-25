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
  console.log(`TESTING EXACT JSON FORMAT (NO SPACES)`)
  console.log(`${'═'.repeat(80)}\n`)

  const query2 = 'How can I deal with anxiety and fear about the future?'
  const embedding2 = await embedQuery(query2)

  console.log(`Query 2: "${query2}"`)
  console.log(`Generated embedding: ${embedding2.length} dimensions\n`)

  // Test with exact format: JSON without spaces
  console.log(`Test: Passing as JSON string without spaces "[val,val,...]"`)
  const embeddingCompact = `[${embedding2.join(',')}]`
  console.log(`  Format: ${embeddingCompact.substring(0, 50)}...`)
  console.log(`  Length: ${embeddingCompact.length} chars\n`)

  const { data, error } = await client.rpc('match_verse_chunks', {
    query_embedding: embeddingCompact,
    match_count: 12,
    match_threshold: -1,
  })

  if (error) {
    console.log(`  ERROR: ${JSON.stringify(error)}`)
  } else {
    const count = data ? (data as any[]).length : 0
    console.log(`  Result: ${count} rows`)

    if (count > 0) {
      const first = (data as any[])[0]
      console.log(`  Top: ${first.book} ${first.chapter}.${first.verse}, similarity=${first.similarity.toFixed(4)}`)
    }
  }

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
