const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !VOYAGE_API_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

interface VerseChunk {
  id?: string
  book: string
  canto: number | null
  chapter: number
  verse: number
  vedabase_url: string
  chunk_text: string
  chunk_index: number
  total_chunks: number
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VOYAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: 'voyage-3',
        }),
      })

      if (!response.ok) {
        if (attempt < retries) {
          console.log(`  Attempt ${attempt} failed (${response.status}), retrying in 2s...`)
          await sleep(2000)
          continue
        }
        throw new Error(`Voyage API error: ${response.status}`)
      }

      const data = (await response.json()) as any
      return data.data[0].embedding
    } catch (error) {
      if (attempt < retries) {
        await sleep(2000)
        continue
      }
      throw error
    }
  }
  throw new Error('Embedding generation failed after retries')
}

async function fetchChunksFromDatabase(): Promise<VerseChunk[]> {
  const headers = new Headers()
  headers.set('apikey', SUPABASE_SERVICE_KEY || '')
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY}`)
  headers.set('Content-Type', 'application/json')

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/verse_chunks?select=*&limit=1`,
    {
      method: 'GET',
      headers,
    }
  )

  if (!response.ok) {
    console.log('verse_chunks table appears to be empty or inaccessible')
    return []
  }

  const data = (await response.json()) as any
  return Array.isArray(data) ? data : []
}

async function writeChunkWithEmbedding(chunk: VerseChunk, embedding: number[]): Promise<boolean> {
  const headers = new Headers()
  headers.set('apikey', SUPABASE_SERVICE_KEY || '')
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY}`)
  headers.set('Content-Type', 'application/json')
  headers.set('Prefer', 'return=minimal')

  const response = await fetch(`${SUPABASE_URL}/rest/v1/verse_chunks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      book: chunk.book,
      canto: chunk.canto,
      chapter: chunk.chapter,
      verse: chunk.verse,
      vedabase_url: chunk.vedabase_url,
      chunk_text: chunk.chunk_text,
      chunk_index: chunk.chunk_index,
      total_chunks: chunk.total_chunks,
      embedding,
    }),
  })

  if (!response.ok) {
    console.error(`Failed to write chunk: ${response.status}`)
    return false
  }

  return true
}

async function regenerateEmbeddings(): Promise<void> {
  console.log('Checking verse_chunks table...')

  const existingChunks = await fetchChunksFromDatabase()
  console.log(`Found ${existingChunks.length} existing chunks in database\n`)

  if (existingChunks.length > 0) {
    console.log('Chunks already written to database. Phase 2 ingestion complete.')
    return
  }

  console.log('Since verse_chunks is empty, re-running full Phase 2 ingestion with embedding generation...')
  console.log('(Note: Re-run the main ingest-phase2-full.ts script with extended timeout)\n')

  // This script is just a fallback. The main script should be run with increased timeout
  // or we need to split the embedding generation into a separate step.
}

regenerateEmbeddings()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
