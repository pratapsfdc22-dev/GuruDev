import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SERVICE_KEY)

async function test() {
  console.log('='.repeat(80))
  console.log('CHECKING ACTUAL EMBEDDING TYPE')
  console.log('='.repeat(80))

  const { data: firstChunk } = await client
    .from('verse_chunks')
    .select('id, book, chapter, verse, embedding')
    .limit(1)

  if (!firstChunk || firstChunk.length === 0) {
    console.log('ERROR: No chunks found')
    process.exit(1)
  }

  const chunk = firstChunk[0] as any
  const emb = chunk.embedding

  console.log(`\nData type of embedding:`)
  console.log(`  typeof: ${typeof emb}`)
  console.log(`  constructor: ${emb.constructor.name}`)
  console.log(`  is Array: ${Array.isArray(emb)}`)
  console.log(`  has .length: ${typeof emb.length !== 'undefined'}`)
  console.log(`  has .slice: ${typeof emb.slice === 'function'}`)
  console.log(`  has .map: ${typeof emb.map === 'function'}`)
  console.log(`  has .toArray: ${typeof emb.toArray === 'function'}`)

  console.log(`\nValue:`)
  console.log(`  length: ${emb.length}`)
  console.log(`  string representation: ${String(emb).substring(0, 100)}`)
  console.log(`  JSON.stringify: ${JSON.stringify(emb).substring(0, 100)}`)

  console.log(`\nObject keys:`)
  const keys = Object.keys(emb)
  console.log(`  total keys: ${keys.length}`)
  console.log(`  first 10: [${keys.slice(0, 10).join(', ')}]`)

  console.log(`\nTrying to convert to array:`)
  let arr: number[] | null = null

  if (Array.isArray(emb)) {
    arr = emb
    console.log(`  ✓ Already is array`)
  } else if (emb instanceof Float32Array) {
    arr = Array.from(emb)
    console.log(`  ✓ Converted from Float32Array`)
  } else if (emb instanceof Float64Array) {
    arr = Array.from(emb)
    console.log(`  ✓ Converted from Float64Array`)
  } else if (typeof emb === 'object' && emb !== null) {
    try {
      arr = Array.from(emb)
      console.log(`  ✓ Converted via Array.from()`)
    } catch (e) {
      console.log(`  ✗ Array.from() failed: ${e}`)
    }
  }

  if (arr) {
    console.log(`\nConverted array:`)
    console.log(`  length: ${arr.length}`)
    console.log(`  first 3: [${arr.slice(0, 3).join(', ')}]`)
  }

  console.log(`\n${'='.repeat(80)}\n`)
  process.exit(0)
}

test().catch(console.error)
