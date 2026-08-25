import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function verify(): Promise<void> {
  console.log('Query 1: Check column definition in information_schema\n')
  console.log(
    'SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = \'verse_chunks\' AND column_name = \'embedding\';\n'
  )

  // Query via direct fetch since we need raw SQL execution
  const headers = new Headers()
  headers.set('apikey', SUPABASE_SERVICE_KEY || '')
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY || ''}`)
  headers.set('Content-Type', 'application/json')

  // Try to get schema info via SQL - use a simple approach
  const schemaResult = await client.rpc('pg_get_cols', {
    table_name: 'verse_chunks',
    col_name: 'embedding',
  } as any)
  const schemaData = schemaResult.data
  const schemaError = schemaResult.error

  if (schemaError || !schemaData) {
    console.log('(Schema RPC not available, checking via direct query)\n')

    // Fetch one row and inspect the embedding field
    const { data: sample, error: sampleError } = await client
      .from('verse_chunks')
      .select('embedding')
      .limit(1)

    if (sampleError) {
      console.log(`Error fetching sample: ${sampleError.message}\n`)
    } else if (sample && sample.length > 0) {
      const emb = (sample as any)[0].embedding
      console.log('Sample embedding from first row:')
      console.log(`  Type (JS): ${typeof emb}`)
      console.log(`  Constructor: ${emb?.constructor?.name}`)
      console.log(`  Length: ${(emb as any)?.length}`)
      console.log(`  First 50 chars: ${String(emb).substring(0, 50)}`)
      console.log()
    }
  } else {
    console.log('Schema info:')
    console.log(JSON.stringify(schemaData, null, 2))
    console.log()
  }

  console.log('\n' + '═'.repeat(80) + '\n')
  console.log('Query 2: Count NULL embeddings\n')
  console.log('SELECT count(*) FROM verse_chunks WHERE embedding IS NULL;\n')

  const { count, error: countError } = await client
    .from('verse_chunks')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null)

  if (countError) {
    console.log(`Error: ${countError.message}\n`)
  } else {
    console.log(`Result: ${count}\n`)
  }

  console.log('\n' + '═'.repeat(80) + '\n')

  process.exit(0)
}

verify().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
