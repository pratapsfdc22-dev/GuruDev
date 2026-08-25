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
  console.log(`DIAGNOSING QUERY 2: "How can I deal with anxiety and fear about the future?"`)
  console.log(`${'═'.repeat(80)}\n`)

  const query2 = 'How can I deal with anxiety and fear about the future?'
  const embedding2 = await embedQuery(query2)

  console.log(`Query embedding: 1024 dimensions`)
  console.log(`First 5 values: [${embedding2.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`)
  console.log(`Last 5 values: [${embedding2.slice(-5).map(v => v.toFixed(4)).join(', ')}]`)
  console.log(`Min: ${Math.min(...embedding2).toFixed(4)}, Max: ${Math.max(...embedding2).toFixed(4)}`)

  // Test with different thresholds
  console.log(`\nTesting RPC with various thresholds:\n`)

  const thresholds = [-1, -0.5, 0, 0.5, 1, 0.9]

  for (const threshold of thresholds) {
    const { data, error } = await client.rpc('match_verse_chunks', {
      query_embedding: embedding2,
      match_count: 12,
      match_threshold: threshold,
    })

    const count = data ? (data as any[]).length : 0
    const filterValue = 1 - threshold

    console.log(
      `  threshold=${threshold.toFixed(1).padStart(4)}: distance < ${filterValue.toFixed(1).padStart(4)} => ${count} results`
    )

    if (error) {
      console.log(`    ERROR: ${JSON.stringify(error, null, 2)}`)
    }

    if (count > 0 && threshold === -1) {
      const first = (data as any[])[0]
      console.log(`    Top: ${first.book} ${first.chapter}.${first.verse}, similarity=${first.similarity.toFixed(4)}`)
    }
  }

  // Compare with query 1
  console.log(`\n${'─'.repeat(80)}`)
  console.log(`For comparison - Query 1: "How do I find meaning and purpose in my work?"\n`)

  const query1 = 'How do I find meaning and purpose in my work?'
  const embedding1 = await embedQuery(query1)

  console.log(`Query embedding: 1024 dimensions`)
  console.log(`First 5 values: [${embedding1.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`)

  const { data: data1, error: error1 } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding1,
    match_count: 12,
    match_threshold: -1,
  })

  const count1 = data1 ? (data1 as any[]).length : 0
  console.log(`\n  threshold=-1: ${count1} results`)

  if (error1) {
    console.log(`  ERROR: ${JSON.stringify(error1, null, 2)}`)
  }

  if (count1 > 0) {
    const first = (data1 as any[])[0]
    console.log(`  Top: ${first.book} ${first.chapter}.${first.verse}, similarity=${first.similarity.toFixed(4)}`)
  }

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
