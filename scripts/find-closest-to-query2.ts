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

function cosineDist(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  const similarity = dot / (normA * normB)
  return 1 - similarity
}

async function test(): Promise<void> {
  console.log(`\n${'═'.repeat(80)}`)
  console.log(`FINDING CLOSEST CORPUS CHUNKS TO QUERY 2`)
  console.log(`${'═'.repeat(80)}\n`)

  const query2 = 'How can I deal with anxiety and fear about the future?'
  const embedding2 = await embedQuery(query2)

  console.log(`Query 2: "${query2}"`)
  console.log(`Computing distances to all 7,404 stored chunks...\n`)

  // Fetch ALL chunks with embeddings (this will be large)
  // In practice, just sample to find the range
  const { data: chunks, error } = await client
    .from('verse_chunks')
    .select('book, chapter, verse, embedding')
    .limit(1000)

  if (error) {
    console.log(`Error fetching chunks: ${error.message}`)
    process.exit(1)
  }

  if (!chunks || chunks.length === 0) {
    console.log('No chunks found')
    process.exit(1)
  }

  console.log(`Analyzing distances for sample of ${chunks.length} chunks:\n`)

  const distances: Array<{ distance: number; book: string; chapter: number; verse: number }> = []

  for (const chunk of chunks as any[]) {
    const storedEmb = chunk.embedding
    let embArray: number[]

    if (typeof storedEmb === 'string') {
      try {
        embArray = JSON.parse(storedEmb)
      } catch {
        continue
      }
    } else if (Array.isArray(storedEmb)) {
      embArray = storedEmb
    } else {
      continue
    }

    const dist = cosineDist(embedding2, embArray)
    distances.push({
      distance: dist,
      book: chunk.book,
      chapter: chunk.chapter,
      verse: chunk.verse,
    })
  }

  distances.sort((a, b) => a.distance - b.distance)

  console.log(`Top 10 closest chunks (smallest distance):`)
  distances.slice(0, 10).forEach((d, idx) => {
    console.log(
      `  ${idx + 1}. ${d.book} ${d.chapter}.${d.verse}: distance=${d.distance.toFixed(4)}, similarity=${(1 - d.distance).toFixed(4)}`
    )
  })

  console.log(`\nDistance statistics (sample of ${distances.length}):`)
  const minDist = Math.min(...distances.map(d => d.distance))
  const maxDist = Math.max(...distances.map(d => d.distance))
  const avgDist = distances.reduce((sum, d) => sum + d.distance, 0) / distances.length

  console.log(`  Min: ${minDist.toFixed(4)} (similarity: ${(1 - minDist).toFixed(4)})`)
  console.log(`  Max: ${maxDist.toFixed(4)} (similarity: ${(1 - maxDist).toFixed(4)})`)
  console.log(`  Avg: ${avgDist.toFixed(4)} (similarity: ${(1 - avgDist).toFixed(4)})`)

  console.log(`\n✓ Closest match has distance ${minDist.toFixed(4)}, which is ${minDist > 2 ? 'ABOVE' : 'BELOW'} the threshold of 2.0`)

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
