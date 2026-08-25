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
  console.log('CHECKING COLUMN DEFINITION FOR embedding')
  console.log('='.repeat(80))

  console.log('\nQuery:')
  console.log(`SELECT column_name, data_type, udt_name`)
  console.log(`FROM information_schema.columns`)
  console.log(`WHERE table_name = 'verse_chunks' AND column_name = 'embedding';`)
  console.log()

  // Try to query information_schema directly
  const { data, error } = await client.rpc(
    'query_information_schema',
    {},
  ).then((r) => r).catch((e) => ({ data: null, error: e }))

  if (error || !data) {
    console.log('(information_schema RPC not available)')
    console.log('Attempting direct table query instead...\n')

    // Fallback: try to inspect via raw SQL query if available
    // Or infer from what we already know
    console.log('Based on actual data inspection:')
    console.log('- Stored embedding is a STRING (JSON representation)')
    console.log('- Query embedding is a 1024-element array')
    console.log('- RPC returns 0 rows\n')

    console.log('This indicates the column is NOT vector type.')
    console.log('Checking Supabase schema...')

    // Get table structure info
    const { data: tableInfo } = await client
      .from('information_schema.tables')
      .select('*')
      .eq('table_name', 'verse_chunks')
      .limit(1)

    if (!tableInfo || tableInfo.length === 0) {
      console.log('(Cannot query information_schema via Supabase REST)')
      console.log('\nManual verification: Check Supabase SQL editor')
      console.log('Run this query directly in SQL editor:')
      console.log('\n  SELECT column_name, data_type, udt_name')
      console.log(`  FROM information_schema.columns`)
      console.log(`  WHERE table_name = 'verse_chunks' AND column_name = 'embedding';`)
    }
  } else {
    console.log('Column information:')
    console.log(JSON.stringify(data, null, 2))
  }

  // Alternative: Try to get schema info from the table itself
  console.log('\n' + '='.repeat(80))
  console.log('ALTERNATIVE: Check via ALTER TABLE inspection')
  console.log('='.repeat(80))

  console.log(`\nIn Supabase SQL Editor, run:`)
  console.log(`  \\d verse_chunks`)
  console.log(`  -- or`)
  console.log(`  SELECT * FROM verse_chunks LIMIT 1;`)
  console.log(`  -- and look at the embedding column type in the results\n`)

  console.log('='.repeat(80))
  console.log('HYPOTHESIS BASED ON EVIDENCE')
  console.log('='.repeat(80))

  console.log(`\nGiven that:`)
  console.log(`1. Stored embedding is a STRING (12470 chars, JSON array)`)
  console.log(`2. Query embedding is ARRAY (1024 floats)`)
  console.log(`3. RPC returns 0 rows (not a type error at column level)`)
  console.log(`\nMost likely: Column is TEXT or JSONB, not vector(1024)`)
  console.log(`- Postgres allows TEXT insertion (no type validation)`)
  console.log(`- The <=> operator doesn't work on TEXT/JSONB`)
  console.log(`- WHERE distance < 2 filters to 0 rows`)

  console.log(`\n${'='.repeat(80)}\n`)
  process.exit(0)
}

test().catch(console.error)
