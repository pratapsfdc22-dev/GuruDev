import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SERVICE_KEY)

async function runRawQueries() {
  console.log('='.repeat(80))
  console.log('QUERY 1: Vector dimensions distribution')
  console.log('='.repeat(80))
  console.log('SELECT vector_dims(embedding) AS dims, COUNT(*)')
  console.log('FROM verse_chunks')
  console.log('GROUP BY dims;')
  console.log('')

  const { data: dimsData, error: dimsError } = await client
    .rpc('vector_dims', undefined)
    .then(() => ({ data: null, error: null }))
    .catch((e) => ({ data: null, error: e }))

  // If that doesn't work, try raw query via REST
  const dimsRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sql`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'SELECT vector_dims(embedding) AS dims, COUNT(*) FROM verse_chunks GROUP BY dims;',
    }),
  })

  if (!dimsRes.ok) {
    console.log('(Raw SQL RPC not available, trying Supabase query builder...)')

    // Fall back to checking actual array lengths from fetched rows
    const { data: samples } = await client
      .from('verse_chunks')
      .select('embedding')
      .limit(100)

    if (samples && samples.length > 0) {
      const dimSet = new Set<number>()
      samples.forEach((row: any) => {
        if (Array.isArray(row.embedding)) {
          dimSet.add((row.embedding as number[]).length)
        }
      })

      console.log('Dimensions found in sample of 100 chunks:')
      Array.from(dimSet)
        .sort((a, b) => a - b)
        .forEach((dim) => {
          const count = samples.filter((r: any) => (r.embedding as number[]).length === dim).length
          console.log(`  dims=${dim}  count=${count}`)
        })
    }
  } else {
    const result = await dimsRes.json()
    console.log('Result:')
    console.log(JSON.stringify(result, null, 2))
  }

  console.log('\n' + '='.repeat(80))
  console.log('QUERY 2: Column definition')
  console.log('='.repeat(80))
  console.log('SELECT column_name, data_type, udt_name')
  console.log("FROM information_schema.columns")
  console.log("WHERE table_name = 'verse_chunks' AND column_name = 'embedding';")
  console.log('')

  const { data: colDef } = await client
    .from('information_schema_columns')
    .select('column_name, data_type, udt_name')
    .eq('table_name', 'verse_chunks')
    .eq('column_name', 'embedding')

  if (colDef && colDef.length > 0) {
    console.log('Result:')
    console.log(JSON.stringify(colDef, null, 2))
  } else {
    console.log('(Supabase query builder does not expose information_schema)')
    console.log('Attempting direct Postgres query via SQL Editor...')
    console.log('(This requires manual execution in Supabase SQL Editor)')
  }

  console.log('\n' + '='.repeat(80))
  console.log('QUERY 3: Verify total chunks')
  console.log('='.repeat(80))

  const { count: totalCount } = await client
    .from('verse_chunks')
    .select('id', { count: 'exact', head: true })

  console.log(`Total chunks in verse_chunks: ${totalCount}`)

  process.exit(0)
}

runRawQueries().catch(console.error)
