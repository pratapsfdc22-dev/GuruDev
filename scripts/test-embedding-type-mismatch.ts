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
  console.log(`TESTING EMBEDDING TYPE CONVERSION`)
  console.log(`${'═'.repeat(80)}\n`)

  const query2 = 'How can I deal with anxiety and fear about the future?'
  const embedding2 = await embedQuery(query2)

  console.log(`Generated embedding: ${embedding2.length} dimensions`)
  console.log(`Type: ${typeof embedding2}, Array.isArray: ${Array.isArray(embedding2)}`)
  console.log()

  // Test 1: Pass the array as-is
  console.log(`Test 1: Passing array directly to RPC`)
  const { data: data1 } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding2,
    match_count: 12,
    match_threshold: -1,
  })
  console.log(`  Result: ${data1 ? (data1 as any[]).length : 0} rows\n`)

  // Test 2: Pass as a typed array conversion
  console.log(`Test 2: Passing as Float32Array`)
  const { data: data2 } = await client.rpc('match_verse_chunks', {
    query_embedding: new Float32Array(embedding2),
    match_count: 12,
    match_threshold: -1,
  })
  console.log(`  Result: ${data2 ? (data2 as any[]).length : 0} rows\n`)

  // Test 3: Use the first stored embedding instead
  console.log(`Test 3: Using first stored embedding from database`)
  const { data: storedChunks } = await client
    .from('verse_chunks')
    .select('embedding')
    .limit(1)

  if (storedChunks && storedChunks.length > 0) {
    const storedEmb = (storedChunks as any)[0].embedding
    console.log(`  Stored embedding type: ${typeof storedEmb}`)

    const { data: data3 } = await client.rpc('match_verse_chunks', {
      query_embedding: storedEmb,
      match_count: 12,
      match_threshold: -1,
    })
    console.log(`  Result: ${data3 ? (data3 as any[]).length : 0} rows\n`)

    // Test 4: Try parsing stored embedding as JSON if it's a string
    if (typeof storedEmb === 'string') {
      console.log(`Test 4: Stored embedding is STRING, parsing as JSON array`)
      try {
        const parsed = JSON.parse(storedEmb) as number[]
        console.log(`    Parsed to array of ${parsed.length} numbers`)

        const { data: data4 } = await client.rpc('match_verse_chunks', {
          query_embedding: parsed,
          match_count: 12,
          match_threshold: -1,
        })
        console.log(`    Result: ${data4 ? (data4 as any[]).length : 0} rows\n`)
      } catch (e) {
        console.log(`    Parse error: ${e}\n`)
      }
    }
  }

  // Test 5: Direct comparison - pass the exact same embedding used in successful query 1
  console.log(`Test 5: Using the embedding from Query 1 (which returns 4 results)`)
  const query1 = 'How do I find meaning and purpose in my work?'
  const embedding1 = await embedQuery(query1)

  const { data: data5 } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding1,
    match_count: 12,
    match_threshold: -1,
  })
  console.log(`  Query 1 embedding result: ${data5 ? (data5 as any[]).length : 0} rows`)

  // Now test if swapping queries makes a difference
  console.log(`\nTest 6: Swapping to use Query 2 embedding with Query 1 semantics`)
  const { data: data6 } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding2,
    match_count: 12,
    match_threshold: -1,
  })
  console.log(`  Query 2 embedding result: ${data6 ? (data6 as any[]).length : 0} rows`)

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
