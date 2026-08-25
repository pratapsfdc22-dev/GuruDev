import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function test(): Promise<void> {
  console.log(`\n${'═'.repeat(80)}`)
  console.log(`CHECKING STORED EMBEDDING FORMAT`)
  console.log(`${'═'.repeat(80)}\n`)

  const { data: chunks, error } = await client
    .from('verse_chunks')
    .select('id, book, chapter, verse, embedding')
    .limit(1)

  if (error) {
    console.log(`Error: ${error.message}`)
    process.exit(1)
  }

  if (!chunks || chunks.length === 0) {
    console.log(`No chunks found`)
    process.exit(1)
  }

  const chunk = (chunks as any)[0]
  const emb = chunk.embedding

  console.log(`First chunk: ${chunk.book} ${chunk.chapter}.${chunk.verse}\n`)

  console.log(`Embedding field inspection:`)
  console.log(`  typeof: ${typeof emb}`)
  console.log(`  constructor.name: ${emb?.constructor?.name}`)
  console.log(`  Array.isArray: ${Array.isArray(emb)}`)
  console.log(`  instanceof Array: ${emb instanceof Array}`)
  console.log(`  .length: ${(emb as any)?.length}`)

  console.log(`\nValue inspection:`)
  console.log(`  Raw value: ${String(emb).substring(0, 80)}`)
  console.log(`  JSON.stringify: ${JSON.stringify(emb).substring(0, 80)}`)

  console.log(`\nTrying to iterate:`)
  try {
    if (typeof (emb as any)[Symbol.iterator] === 'function') {
      const first3 = []
      let count = 0
      for (const val of emb as any) {
        first3.push(val)
        count++
        if (count >= 3) break
      }
      console.log(`  ✓ Iterable, first 3: [${first3.join(', ')}]`)
    } else {
      console.log(`  ✗ Not iterable`)
    }
  } catch (e) {
    console.log(`  ✗ Error: ${e}`)
  }

  console.log(`\nTrying to access by index:`)
  try {
    const first = (emb as any)[0]
    const second = (emb as any)[1]
    console.log(`  [0]=${first} (typeof ${typeof first})`)
    console.log(`  [1]=${second} (typeof ${typeof second})`)
  } catch (e) {
    console.log(`  Error: ${e}`)
  }

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
