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
  const testQuery = 'How can I deal with anxiety and fear about the future?'

  console.log('='.repeat(80))
  console.log('DEBUGGING VECTOR RESPONSE FROM RPC')
  console.log('='.repeat(80))

  console.log(`\nEmbedding query: "${testQuery}"`)
  const embedding = await embedQuery(testQuery)
  console.log(`✓ Got 1024-dim embedding`)

  console.log(`\nCalling match_verse_chunks RPC directly...`)

  // Call via Supabase client to see raw response
  const { data, error, status } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding,
    match_count: 12,
    match_threshold: -1,
  })

  console.log(`Response status: ${status}`)

  if (error) {
    console.log(`ERROR: ${error.message}`)
    console.log(`Error details:`, error)
    process.exit(1)
  }

  console.log(`\n✓ RPC returned ${data?.length || 0} results`)

  if (data && data.length > 0) {
    console.log(`\nFirst 3 results (raw fields):`)
    data.slice(0, 3).forEach((r: any, idx: number) => {
      console.log(`\n[${idx}] ${r.book} ${r.chapter}.${r.verse}`)
      console.log(`  Fields: ${Object.keys(r).join(', ')}`)
      console.log(`  similarity: ${r.similarity}`)
      console.log(`  chunk_text (first 80 chars): ${(r.chunk_text as string).substring(0, 80)}`)
    })

    console.log(`\n\nAll similarity values returned by RPC:`)
    data.forEach((r: any, idx: number) => {
      console.log(`${idx + 1}. ${r.book} ${r.chapter}.${r.verse} → similarity: ${r.similarity}`)
    })

    // Now show what the harness computes from this
    console.log(`\n\nWhat the harness WOULD compute (using rank-based formula):`)
    data.forEach((r: any, idx: number) => {
      const harness_score = 1 - idx / (data.length || 1)
      console.log(`${idx + 1}. ${r.book} ${r.chapter}.${r.verse} → 1 - (${idx}/${data.length}) = ${harness_score.toFixed(2)}`)
    })
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log('Summary:')
  console.log('- RPC returns "similarity" field (should be real cosine distance scores)')
  console.log('- Harness ignores the similarity field')
  console.log('- Harness computes rank-based scores: 1 - (position / total)')
  console.log('- This is WHY scores look like 1.00, 0.92, 0.83, 0.75, 0.67...')
  console.log(`${'='.repeat(80)}\n`)

  process.exit(0)
}

debug().catch(console.error)
