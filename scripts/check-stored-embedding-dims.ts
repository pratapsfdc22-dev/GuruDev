import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SERVICE_KEY)

async function check() {
  console.log('='.repeat(80))
  console.log('CHECKING STORED EMBEDDING DIMENSIONS')
  console.log('='.repeat(80))

  // Get first 20 chunks with their embeddings
  const { data, error } = await client
    .from('verse_chunks')
    .select('book, chapter, verse, embedding')
    .limit(20)

  if (error) {
    console.error('Query error:', error)
    process.exit(1)
  }

  if (!data) {
    console.log('No data returned')
    process.exit(1)
  }

  console.log(`\nFetched ${data.length} chunks\n`)

  const dimCounts: Record<number, number> = {}

  data.forEach((row: any, idx: number) => {
    const emb = row.embedding
    let dims: number

    if (Array.isArray(emb)) {
      dims = emb.length
    } else if (typeof emb === 'object' && emb !== null) {
      // Might be serialized as object keys
      dims = Object.keys(emb).length
    } else if (typeof emb === 'string') {
      // Might be a string representation
      const parsed = JSON.parse(emb)
      dims = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
    } else {
      dims = -1 // Unknown
    }

    console.log(`[${idx}] ${row.book} ${row.chapter}.${row.verse}: ${dims} dimensions`)

    if (!dimCounts[dims]) {
      dimCounts[dims] = 0
    }
    dimCounts[dims]++
  })

  console.log(`\n${'='.repeat(80)}`)
  console.log('DIMENSION DISTRIBUTION (first 20 chunks):')
  console.log('='.repeat(80))

  Object.entries(dimCounts)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([dim, count]) => {
      console.log(`  ${dim} dimensions: ${count} chunks`)
    })

  console.log(`\n${'='.repeat(80)}\n`)
  process.exit(0)
}

check().catch(console.error)
