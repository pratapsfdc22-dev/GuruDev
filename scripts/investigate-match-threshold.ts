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

async function investigate(): Promise<void> {
  console.log(`\n${'═'.repeat(80)}`)
  console.log(`INVESTIGATING match_threshold BEHAVIOR`)
  console.log(`${'═'.repeat(80)}\n`)

  // Step 1: Check for NULL embeddings
  console.log(`Step 1: Checking for NULL embeddings in verse_chunks...`)
  const { data: nullCheck, error: nullError } = await client
    .from('verse_chunks')
    .select('count', { count: 'exact' })
    .is('embedding', null)

  if (nullError) {
    console.log(`  Error: ${nullError.message}`)
  } else {
    const totalCount = await client
      .from('verse_chunks')
      .select('count', { count: 'exact' })
    console.log(`  NULL embeddings: ${(nullCheck as any).count}`)
    if (totalCount.data) {
      console.log(`  Total rows: ${(totalCount.data as any).count}`)
    }
  }

  // Step 2: Test the RPC with different match_threshold values
  console.log(`\nStep 2: Testing RPC with various match_threshold values...`)

  const testQuery = 'How can I deal with anxiety and fear about the future?'
  const embedding = await embedQuery(testQuery)

  console.log(`  Query: "${testQuery}"`)
  console.log(`  Query embedding: 1024 dimensions\n`)

  const thresholds = [-1, -0.5, 0, 0.5]

  for (const threshold of thresholds) {
    const { data, error } = await client.rpc('match_verse_chunks', {
      query_embedding: embedding,
      match_count: 12,
      match_threshold: threshold,
    })

    if (error) {
      console.log(`  ❌ threshold=${threshold}: Error ${error.message}`)
    } else {
      const count = data ? (data as any[]).length : 0
      console.log(`  ✓ threshold=${threshold}: returned ${count} results`)

      if (count > 0) {
        const first = (data as any[])[0]
        console.log(`     Top result: ${first.book} ${first.chapter}.${first.verse}, similarity=${first.similarity.toFixed(4)}`)
      }
    }
  }

  // Step 3: Log the WHERE clause logic
  console.log(`\nStep 3: Understanding the WHERE clause logic...`)
  console.log(`  RPC WHERE clause: vc.embedding <=> query_embedding < (1 - match_threshold)`)
  console.log(`  This filters: distance < (1 - threshold)\n`)

  for (const threshold of thresholds) {
    const filterValue = 1 - threshold
    console.log(`  threshold=${threshold} => distance < ${filterValue}`)
  }

  console.log(`\n  Analysis:`)
  console.log(`  - threshold=-1 => distance < 2.0 (very permissive, should accept ~all rows)`)
  console.log(`  - threshold=0 => distance < 1.0 (accepts similar items)`)
  console.log(`  - threshold=0.5 => distance < 0.5 (accepts only very similar items)`)

  // Step 4: Test raw SQL distance distribution
  console.log(`\nStep 4: Checking distance distribution for the test query...`)

  const { data: distances, error: distError } = await client
    .from('verse_chunks')
    .select(`book, chapter, verse,
             (embedding <=> ${JSON.stringify(embedding)})::float as distance`)
    .order('embedding <=> ' + JSON.stringify(embedding))
    .limit(20)

  if (distError) {
    console.log(`  Error: ${distError.message}`)
  } else if (distances) {
    console.log(`  Top 20 closest verses and their distances:\n`)
    ;(distances as any[]).forEach((r, idx) => {
      const verseRef = r.book === 'Bhagavad-gita'
        ? `Bg ${r.chapter}.${r.verse}`
        : `SB ${r.canto}.${r.chapter}.${r.verse}`
      console.log(`    ${idx + 1}. ${verseRef}: distance=${r.distance.toFixed(4)}`)
    })
  }

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

investigate().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
