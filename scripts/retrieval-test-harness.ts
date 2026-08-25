import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !VOYAGE_API_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface RetrievalResult {
  verse_id: string
  book: string
  canto: number | null
  chapter: number
  verse: number
  vedabase_url: string
  chunk_text: string
  similarity_score: number
  fts_score: number
  combined_score: number
  source: 'vector' | 'fts' | 'both'
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

async function retrieveHybrid(query: string, topK: number = 12): Promise<RetrievalResult[]> {
  console.log(`\n📝 Query: "${query}"`)
  console.log(`Embedding query...`)

  const embedding = await embedQuery(query)
  console.log(`✓ Query embedded (1024 dimensions)`)

  // 1 & 2. Hybrid search (vector + FTS combined)
  // Using hybrid_search_verse_chunks which is more reliable than match_verse_chunks
  // and provides both vector and FTS scoring anyway
  console.log(`\nRunning hybrid search (pgvector + full-text, combined)...`)
  const { data: hybridResults, error: hybridError } = await client.rpc(
    'hybrid_search_verse_chunks',
    {
      query_embedding: embedding as any,
      query_text: query,
      vector_weight: 0.6,
      fts_weight: 0.4,
      match_count: topK,
    }
  )

  if (hybridError) {
    console.log(`⚠️ Hybrid search error: ${hybridError.message}`)
  }

  const hybridResults_Array: any[] = hybridResults || []
  console.log(`✓ Found ${hybridResults_Array.length} hybrid matches`)



  // 2. Format results (hybrid search already provides combined scores)
  console.log(`\nFormatting results...`)

  const topResults: RetrievalResult[] = hybridResults_Array
    .map(r => {
      const source: 'vector' | 'fts' | 'both' = (r.vector_score && r.vector_score > 0 && r.fts_score && r.fts_score > 0)
        ? 'both'
        : r.vector_score && r.vector_score > 0
          ? 'vector'
          : 'fts'
      return {
        verse_id: r.verse_id,
        book: r.book,
        canto: r.canto,
        chapter: r.chapter,
        verse: r.verse,
        vedabase_url: r.vedabase_url,
        chunk_text: r.chunk_text,
        similarity_score: r.vector_score || 0,
        fts_score: r.fts_score || 0,
        combined_score: r.combined_score || 0,
        source,
      }
    })
    .slice(0, 6)

  console.log(`✓ Returning top 6 combined results\n`)

  return topResults
}

// Add missing import at the top if not present

function formatVerseRef(result: RetrievalResult): string {
  if (result.book === 'Bhagavad-gita') {
    return `Bg ${result.chapter}.${result.verse}`
  } else if (result.book === 'Srimad-Bhagavatam') {
    return `SB ${result.canto}.${result.chapter}.${result.verse}`
  }
  return `${result.book} ${result.chapter}.${result.verse}`
}

function displayResults(results: RetrievalResult[]): void {
  if (results.length === 0) {
    console.log('❌ No results found\n')
    return
  }

  console.log(`${'═'.repeat(80)}`)
  console.log(`RETRIEVAL RESULTS (Top ${results.length})`)
  console.log(`${'═'.repeat(80)}\n`)

  results.forEach((r, idx) => {
    const verseRef = formatVerseRef(r)
    const excerpt = r.chunk_text.substring(0, 120).replace(/\n/g, ' ')
    const sourceLabel = r.source === 'both' ? '🔀' : r.source === 'vector' ? '📊' : '🔍'

    console.log(`${idx + 1}. [${sourceLabel}] ${verseRef}`)
    console.log(`   Score: ${r.combined_score.toFixed(3)} (vector: ${r.similarity_score.toFixed(2)}, fts: ${r.fts_score.toFixed(2)})`)
    console.log(`   URL: ${r.vedabase_url}`)
    console.log(`   "${excerpt}..."`)
    console.log()
  })

  console.log(`${'═'.repeat(80)}\n`)
}

async function runTest(query: string): Promise<void> {
  try {
    const results = await retrieveHybrid(query, 12)
    displayResults(results)
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}\n`)
  }
}

async function main(): Promise<void> {
  const testQueries = [
    'How do I find meaning and purpose in my work?',
    'How can I deal with anxiety and fear about the future?',
    'What is my duty when I disagree with authority?',
    'How should I handle conflict in relationships?',
    'What does it mean to let go of attachments?',
  ]

  console.log(`\n${'═'.repeat(80)}`)
  console.log(`RETRIEVAL TEST HARNESS`)
  console.log(`${'═'.repeat(80)}`)
  console.log(`Running ${testQueries.length} test queries...\n`)

  for (let i = 0; i < testQueries.length; i++) {
    await runTest(testQueries[i])
    if (i < testQueries.length - 1) {
      console.log('Waiting 2s before next query...\n')
      await sleep(2000)
    }
  }

  console.log(`${'═'.repeat(80)}`)
  console.log(`✓ All tests complete`)
  console.log(`${'═'.repeat(80)}\n`)

  process.exit(0)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
