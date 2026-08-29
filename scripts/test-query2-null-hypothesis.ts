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
  console.log(`TEST 1: CHECK IF EMBEDDING2 IS NULL/UNDEFINED IN JS LAYER`)
  console.log(`${'═'.repeat(80)}\n`)

  const query2 = 'How can I deal with anxiety and fear about the future?'
  const embedding2 = await embedQuery(query2)

  console.log(`BEFORE RPC CALL:`)
  console.log(`  Embedding is null/undefined: ${embedding2 == null}`)
  console.log(`  Embedding type: ${typeof embedding2}`)
  console.log(`  Array.isArray: ${Array.isArray(embedding2)}`)
  console.log(`  Length: ${embedding2.length}`)
  console.log(`  Sample (first 3): [${embedding2.slice(0, 3).map(v => v.toFixed(6)).join(', ')}]`)
  console.log(`  typeof each of first 3: [${embedding2.slice(0, 3).map(v => typeof v).join(', ')}]`)
  console.log()

  // Call RPC
  console.log(`CALLING RPC...`)
  const { data, error } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding2 as any,
    match_count: 12,
    match_threshold: -1,
  })

  console.log(`  Error: ${error ? error.message : 'none'}`)
  console.log(`  Result rows: ${data ? (data as any[]).length : 'null'}`)
  console.log()

  console.log(`\n${'═'.repeat(80)}`)
  console.log(`TEST 2: GENERATE LITERAL SQL TO RUN MANUALLY`)
  console.log(`${'═'.repeat(80)}\n`)

  console.log(`Copy and paste THIS ENTIRE LINE into Supabase SQL Editor:`)
  console.log()

  const literalArray = embedding2.join(',')
  const sqlCommand = `SELECT * FROM match_verse_chunks('[${literalArray}]'::vector, 12, -1);`

  console.log(sqlCommand)
  console.log()

  console.log(`This bypasses the JS client and RPC layer entirely.`)
  console.log(`If this returns results, the embedding values are fine and the issue`)
  console.log(`is in how the REST API/RPC serializes the parameter.`)
  console.log()

  console.log(`\n${'═'.repeat(80)}`)
  console.log(`TEST 3: COMPARE WITH QUERY 1 (WHICH WORKS)`)
  console.log(`${'═'.repeat(80)}\n`)

  const query1 = 'How do I find meaning and purpose in my work?'
  const embedding1 = await embedQuery(query1)

  console.log(`Query 1 embedding:`)
  console.log(`  Embedding is null/undefined: ${embedding1 == null}`)
  console.log(`  Length: ${embedding1.length}`)
  console.log(`  Sample (first 3): [${embedding1.slice(0, 3).map(v => v.toFixed(6)).join(', ')}]`)
  console.log()

  const { data: data1 } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding1 as any,
    match_count: 12,
    match_threshold: -1,
  })

  console.log(`  RPC Result rows: ${data1 ? (data1 as any[]).length : 'null'}`)
  console.log()

  console.log(`Comparison: Both embeddings are valid arrays, but Query 1 returns results and Query 2 returns 0.`)
  console.log()

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
