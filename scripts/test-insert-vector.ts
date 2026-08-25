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

  const data = (await response.json()) as any
  return data.data[0].embedding
}

async function test() {
  console.log('='.repeat(80))
  console.log('TESTING HOW DIFFERENT INSERT METHODS STORE VECTORS')
  console.log('='.repeat(80))

  const testQuery = 'test for vector storage type'
  const embedding = await embedQuery(testQuery)

  console.log(`\nGenerated test embedding: 1024 dimensions`)
  console.log(`typeof embedding: ${typeof embedding}`)
  console.log(`Array.isArray(embedding): ${Array.isArray(embedding)}`)

  // Create a test record (don't actually insert yet)
  const testRecord = {
    verse_id: '00000000-0000-0000-0000-000000000001',
    book: 'TEST',
    canto: 1,
    chapter: 1,
    verse: 1,
    vedabase_url: 'https://test.local/test',
    chunk_text: 'TEST CONTENT',
    embedding: embedding,
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log('RAW RECORD BEFORE JSON.stringify')
  console.log('='.repeat(80))

  console.log(`\nrecord.embedding:`)
  console.log(`  type: ${typeof testRecord.embedding}`)
  console.log(`  length: ${(testRecord.embedding as number[]).length}`)
  console.log(`  first 3: [${(testRecord.embedding as number[]).slice(0, 3).join(', ')}]`)

  console.log(`\n${'='.repeat(80)}`)
  console.log('AFTER JSON.stringify (what REST API receives)')
  console.log('='.repeat(80))

  const jsonString = JSON.stringify([testRecord])
  console.log(`\nJSON string length: ${jsonString.length} chars`)
  console.log(`First 200 chars: ${jsonString.substring(0, 200)}`)

  // Parse it back to see what Postgres receives
  const parsed = JSON.parse(jsonString)
  const parsedEmb = parsed[0].embedding

  console.log(`\n${'='.repeat(80)}`)
  console.log('AFTER JSON.parse (what Postgres receives)')
  console.log('='.repeat(80))

  console.log(`\nparsed.embedding:`)
  console.log(`  type: ${typeof parsedEmb}`)
  console.log(`  is array: ${Array.isArray(parsedEmb)}`)
  console.log(`  length: ${(parsedEmb as number[]).length}`)
  console.log(`  first 3: [${(parsedEmb as number[]).slice(0, 3).join(', ')}]`)

  console.log(`\n${'='.repeat(80)}`)
  console.log('WHAT SUPABASE JAVASCRIPT CLIENT WOULD SEND')
  console.log('='.repeat(80))

  console.log(`\nUsing client.from('verse_chunks').insert([testRecord])`)
  console.log(`Supabase JS client calls JSON.stringify internally`)
  console.log(`The REST API receives the same JSON structure`)
  console.log(`Postgres receives: array for embedding field\n`)

  console.log(`${'='.repeat(80)}`)
  console.log('HYPOTHESIS: Why Postgres stores as STRING')
  console.log('='.repeat(80))

  console.log(`\n1. Supabase REST API receives: {"embedding": [1.0, 2.0, ...]}`)
  console.log(`2. The "embedding" field value is a JSON array`)
  console.log(`3. Postgres tries to cast JSON array -> vector(1024)`)
  console.log(`4. If the casting fails or uses COERCE, it may fall back to text`)
  console.log(`5. Result: embedding stored as STRING JSON representation\n`)

  console.log(`This happens because:`)
  console.log(`- Supabase PostgREST doesn't know about pgvector type`)
  console.log(`- OR Postgres is treating the incoming JSON as text and coercing it`)
  console.log(`- Vector type accepts text input like '[1.0, 2.0, ...]' and converts`)
  console.log(`- But somewhere in the chain, the conversion is being stored as text\n`)

  console.log(`${'='.repeat(80)}\n`)
  process.exit(0)
}

test().catch(console.error)
