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

async function demonstrateVectorRetrieval(): Promise<void> {
  const testQueries = [
    'How do I find meaning and purpose in my work?',
    'How can I deal with anxiety and fear about the future?',
    'What is my duty when I disagree with authority?',
    'How should I handle conflict in relationships?',
    'What does it mean to let go of attachments?',
  ]

  console.log(`\n${'═'.repeat(80)}`)
  console.log(`VECTOR RETRIEVAL DEMO — pgvector + Voyage AI`)
  console.log(`${'═'.repeat(80)}\n`)

  for (const query of testQueries) {
    console.log(`📝 Query: "${query}"`)
    const embedding = await embedQuery(query)
    console.log(`✓ Embedded (${embedding.length} dimensions)\n`)

    const { data, error } = await client.rpc('match_verse_chunks', {
      query_embedding: embedding,
      match_count: 6,
      match_threshold: -1,
    })

    if (error) {
      console.log(`❌ Error: ${error.message}\n`)
      continue
    }

    if (!data || data.length === 0) {
      console.log(`⚠️ No vector results found\n`)
      continue
    }

    console.log(`✓ Found ${data.length} matches with real similarity scores:\n`)
    ;(data as any[]).forEach((r, idx) => {
      const verseRef = r.book === 'Bhagavad-gita'
        ? `Bg ${r.chapter}.${r.verse}`
        : `SB ${r.canto}.${r.chapter}.${r.verse}`
      console.log(
        `  ${idx + 1}. ${verseRef}: similarity=${r.similarity.toFixed(4)}`
      )
    })

    console.log()
  }

  console.log(`${'═'.repeat(80)}\n`)
  process.exit(0)
}

demonstrateVectorRetrieval().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
