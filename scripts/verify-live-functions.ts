import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function verify(): Promise<void> {
  console.log(`\n${'═'.repeat(80)}`)
  console.log(`VERIFYING LIVE FUNCTION DEFINITIONS IN DATABASE`)
  console.log(`${'═'.repeat(80)}\n`)

  // Query 1: Get match_verse_chunks definition
  console.log(`Query 1: SELECT pg_get_functiondef('match_verse_chunks'::regproc);\n`)

  const matchVerseSql = `SELECT pg_get_functiondef('match_verse_chunks'::regproc) as def;`

  try {
    const { data: matchData, error: matchError } = await client
      .rpc('query_sql', { query: matchVerseSql } as any)
      .then(r => r)
      .catch(() => ({ data: null, error: null }))

    if (matchError || !matchData) {
      console.log('(RPC query_sql not available, attempting direct fetch...\n)')
    } else if (matchData) {
      console.log('Result:')
      console.log(JSON.stringify(matchData, null, 2))
      console.log()
    }
  } catch (e) {
    console.log('(Could not fetch via RPC)\n')
  }

  // Query 2: Get hybrid_search_verse_chunks definition
  console.log(`\n${'─'.repeat(80)}\n`)
  console.log(`Query 2: SELECT pg_get_functiondef('hybrid_search_verse_chunks'::regproc);\n`)

  const hybridSql = `SELECT pg_get_functiondef('hybrid_search_verse_chunks'::regproc) as def;`

  try {
    const { data: hybridData, error: hybridError } = await client
      .rpc('query_sql', { query: hybridSql } as any)
      .then(r => r)
      .catch(() => ({ data: null, error: null }))

    if (hybridError || !hybridData) {
      console.log('(RPC query_sql not available)\n')
    } else if (hybridData) {
      console.log('Result:')
      console.log(JSON.stringify(hybridData, null, 2))
      console.log()
    }
  } catch (e) {
    console.log('(Could not fetch via RPC)\n')
  }

  console.log(`\n${'═'.repeat(80)}`)
  console.log(`IMPORTANT: Run these queries directly in Supabase SQL Editor:`)
  console.log(`${'═'.repeat(80)}\n`)
  console.log(`1. SELECT pg_get_functiondef('match_verse_chunks'::regproc);\n`)
  console.log(`2. SELECT pg_get_functiondef('hybrid_search_verse_chunks'::regproc);\n`)
  console.log(`Then copy the exact output and verify:`)
  console.log(`  - match_verse_chunks: Line with WHERE clause should show distance < (1 - match_threshold)`)
  console.log(`  - hybrid_search_verse_chunks: vector_results CTE should have ORDER BY before LIMIT\n`)

  process.exit(0)
}

verify().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
