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
  console.log(`INSPECTING STORED EMBEDDING`)
  console.log(`${'═'.repeat(80)}\n`)

  const { data } = await client
    .from('verse_chunks')
    .select('embedding')
    .limit(1)

  if (!data || data.length === 0) {
    console.log('No data found')
    process.exit(1)
  }

  const embedding = (data as any)[0].embedding

  console.log(`Embedding type: ${typeof embedding}`)
  console.log(`Length: ${(embedding as any).length}`)
  console.log(`First 100 chars: ${String(embedding).substring(0, 100)}`)
  console.log(`Last 100 chars: ${String(embedding).substring((embedding as any).length - 100)}`)

  if (typeof embedding === 'string') {
    // Parse and check the values
    try {
      const parsed = JSON.parse(embedding) as number[]
      console.log(`\nParsed as JSON array: ${parsed.length} elements`)
      console.log(`First 5: [${parsed.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`)
      console.log(`Last 5: [${parsed.slice(-5).map(v => v.toFixed(4)).join(', ')}]`)
    } catch (e) {
      console.log(`\nFailed to parse as JSON: ${e}`)
    }
  }

  console.log(`\n${'═'.repeat(80)}\n`)
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
