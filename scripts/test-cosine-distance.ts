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
  console.log('TESTING RAW COSINE DISTANCE COMPUTATION')
  console.log('='.repeat(80))

  const testQuery = 'anxiety and fear about the future'
  console.log(`\nQuery: "${testQuery}"`)
  const embedding = await embedQuery(testQuery)
  console.log(`✓ Embedding: 1024 dims\n`)

  // Test: query the database for distances WITHOUT any WHERE filter
  console.log('Running raw distance query (no WHERE filter):')
  console.log('SELECT')
  console.log('  book, chapter, verse,')
  console.log('  (embedding <=> query_embedding) as distance,')
  console.log('  1 - (embedding <=> query_embedding) as similarity')
  console.log('FROM verse_chunks')
  console.log('CROSS JOIN (SELECT $1::vector as query_embedding) q')
  console.log('ORDER BY distance')
  console.log('LIMIT 10;\n')

  // Use Supabase RPC to call raw SQL if available, or fetch and compute manually
  const { data: rawResults, error } = await client.rpc(
    'sql',
    {
      query: `
        SELECT
          book, chapter, verse,
          (embedding <=> $1::vector) as distance,
          1 - (embedding <=> $1::vector) as similarity
        FROM verse_chunks
        ORDER BY embedding <=> $1::vector
        LIMIT 10
      `,
      params: [embedding],
    }
  ).then((r) => r)
  .catch((e) => ({ data: null, error: e }))

  if (error || !rawResults) {
    console.log('(RPC SQL not available, fetching chunks and computing distances in JavaScript...)\n')

    // Fallback: fetch chunks and compute distances
    const { data: chunks } = await client
      .from('verse_chunks')
      .select('book, chapter, verse, embedding')
      .order('id')
      .limit(10)

    if (chunks && chunks.length > 0) {
      const results = chunks
        .map((chunk: any) => {
          const storedEmb = chunk.embedding as number[]
          const distance = cosineDist(embedding, storedEmb)
          return {
            book: chunk.book,
            chapter: chunk.chapter,
            verse: chunk.verse,
            distance: distance,
            similarity: 1 - distance,
          }
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10)

      console.log('Top 10 by cosine distance:')
      results.forEach((r, idx) => {
        console.log(
          `${idx + 1}. ${r.book} ${r.chapter}.${r.verse}: distance=${r.distance.toFixed(4)}, similarity=${r.similarity.toFixed(4)}`
        )
      })
    }
  } else {
    console.log('Results:')
    ;(rawResults as any[]).forEach((r: any, idx: number) => {
      console.log(
        `${idx + 1}. ${r.book} ${r.chapter}.${r.verse}: distance=${r.distance.toFixed(4)}, similarity=${r.similarity.toFixed(4)}`
      )
    })
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log('NOW TESTING WHERE CLAUSE LOGIC')
  console.log('='.repeat(80))

  console.log(`\nmatch_threshold = -1`)
  console.log(`WHERE vc.embedding <=> query_embedding < (1 - (-1))`)
  console.log(`WHERE distance < 2`)
  console.log(`This filters for: distance < 2 (should accept distances 0 to ~2)\n`)

  console.log('Testing with different thresholds:')
  console.log(`  threshold=-1: accept distance < 2.0`)
  console.log(`  threshold=0.5: accept distance < 0.5`)
  console.log(`  threshold=-0.5: accept distance < 1.5`)

  process.exit(0)
}

// Compute cosine distance (1 - cosine similarity)
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

test().catch(console.error)
