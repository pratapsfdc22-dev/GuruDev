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

function computeL2Norm(embedding: number[]): number {
  let sum = 0
  for (let i = 0; i < embedding.length; i++) {
    sum += embedding[i] * embedding[i]
  }
  return Math.sqrt(sum)
}

function analyzeEmbedding(embedding: number[], label: string): void {
  console.log(`\n${label}:`)
  console.log(`  Length: ${embedding.length}`)

  const hasNaN = embedding.some(v => !Number.isFinite(v))
  console.log(`  Has NaN/Infinity: ${hasNaN}`)

  if (hasNaN) {
    const nanIndices = embedding
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => !Number.isFinite(v))
      .slice(0, 10)
    console.log(`    NaN/Infinity at indices: ${nanIndices.map(({ i, v }) => `${i}(${v})`).join(', ')}`)
  }

  const minVal = Math.min(...embedding.filter(Number.isFinite))
  const maxVal = Math.max(...embedding.filter(Number.isFinite))
  console.log(`  Range: [${minVal.toFixed(4)}, ${maxVal.toFixed(4)}]`)

  const norm = computeL2Norm(embedding)
  console.log(`  L2 norm: ${norm.toFixed(6)}`)

  const mean = embedding.reduce((a, b) => a + b, 0) / embedding.length
  console.log(`  Mean: ${mean.toFixed(6)}`)

  const variance =
    embedding.reduce((sum, v) => sum + (v - mean) ** 2, 0) / embedding.length
  const stddev = Math.sqrt(variance)
  console.log(`  StdDev: ${stddev.toFixed(6)}`)

  console.log(`  First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(6)).join(', ')}]`)
  console.log(`  Last 5 values: [${embedding.slice(-5).map(v => v.toFixed(6)).join(', ')}]`)

  // Check for repeated values (would be suspicious)
  const uniqueValues = new Set(embedding)
  const repetitionRate = 1 - uniqueValues.size / embedding.length
  if (repetitionRate > 0.1) {
    console.log(`  ⚠️ High repetition rate: ${(repetitionRate * 100).toFixed(1)}% of values repeated`)
  }
}

async function test(): Promise<void> {
  console.log(`\n${'═'.repeat(80)}`)
  console.log(`INSPECTING EMBEDDING VALUES`)
  console.log(`${'═'.repeat(80)}`)

  const query1 = 'How do I find meaning and purpose in my work?'
  const query2 = 'How can I deal with anxiety and fear about the future?'

  console.log(`\nQuery 1: "${query1}"`)
  const embedding1 = await embedQuery(query1)
  analyzeEmbedding(embedding1, 'Query 1')

  console.log(`\n---`)

  console.log(`\nQuery 2: "${query2}"`)
  const embedding2 = await embedQuery(query2)
  analyzeEmbedding(embedding2, 'Query 2')

  // Test consistency: regenerate query 2 multiple times
  console.log(`\n${'═'.repeat(80)}`)
  console.log(`TESTING QUERY 2 CONSISTENCY (3 regenerations)`)
  console.log(`${'═'.repeat(80)}`)

  const query2Regenerations: number[][] = []

  for (let i = 0; i < 3; i++) {
    console.log(`\nRegeneration ${i + 1}:`)
    const emb = await embedQuery(query2)
    query2Regenerations.push(emb)

    const norm = computeL2Norm(emb)
    const hasNaN = emb.some(v => !Number.isFinite(v))
    console.log(`  L2 norm: ${norm.toFixed(6)}, Has NaN: ${hasNaN}`)

    // Test this embedding with RPC
    const { data } = await client.rpc('match_verse_chunks', {
      query_embedding: emb as any,
      match_count: 12,
      match_threshold: -1,
    })

    const resultCount = data ? (data as any[]).length : 0
    console.log(`  RPC result: ${resultCount} rows`)
  }

  // Check if all regenerations are identical
  console.log(`\nConsistency check:`)
  let allIdentical = true
  for (let i = 1; i < query2Regenerations.length; i++) {
    const identical = query2Regenerations[0].every((v, idx) => v === query2Regenerations[i][idx])
    if (!identical) {
      allIdentical = false
      // Compute difference
      let maxDiff = 0
      for (let j = 0; j < query2Regenerations[0].length; j++) {
        maxDiff = Math.max(maxDiff, Math.abs(query2Regenerations[0][j] - query2Regenerations[i][j]))
      }
      console.log(`  Regeneration ${i}: Different (max diff: ${maxDiff.toExponential(2)})`)
    }
  }
  if (allIdentical) {
    console.log(`  ✓ All regenerations are identical`)
  }

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
