import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf-8')
const envVars: Record<string, string> = {}
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const client = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY)

async function embedQuery(query: string): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${envVars.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [query], model: 'voyage-3' }),
  })
  const data = (await response.json()) as any
  return data.data[0].embedding
}

async function test() {
  console.log('='.repeat(80))
  console.log('STEP 1: Check current ivfflat.probes setting')
  console.log('='.repeat(80))

  try {
    const { data: _probesResult, error: _probesError } = await client
      .from('verse_chunks')
      .select('*')
      .limit(1)

    // We can't directly run SHOW command via PostgREST, but we can infer from index behavior
    console.log('Note: SHOW ivfflat.probes requires direct SQL access.')
    console.log('Proceeding with RPC test to see actual behavior...\n')
  } catch (e) {
    console.log('(Cannot query probes via PostgREST)\n')
  }

  console.log('='.repeat(80))
  console.log('STEP 2: Embed Query 2')
  console.log('='.repeat(80))

  const query2 = 'How can I deal with anxiety and fear about the future?'
  const embedding2 = await embedQuery(query2)
  console.log(`✓ Query embedded: "${query2}"`)
  console.log(`  Dimensions: ${embedding2.length}`)
  console.log(`  First 5 values: [${embedding2.slice(0, 5).join(', ')}]\n`)

  console.log('='.repeat(80))
  console.log('STEP 3: Call match_verse_chunks RPC (with timing)')
  console.log('='.repeat(80))

  console.time('RPC call duration')
  const { data, error } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding2 as any,
    match_count: 12,
    match_threshold: -1,
  })
  console.timeEnd('RPC call duration')

  console.log(`\nResults:`)
  console.log(`  Error: ${error ? JSON.stringify(error) : 'null'}`)
  console.log(`  Rows returned: ${data?.length || 0}`)

  if (data && data.length > 0) {
    console.log(`\n  First result:`)
    const first = data[0]
    console.log(`    id: ${first.id}`)
    console.log(`    verse_id: ${first.verse_id}`)
    console.log(`    book: ${first.book}`)
    console.log(`    chapter: ${first.chapter}`)
    console.log(`    verse: ${first.verse}`)
    console.log(`    similarity: ${first.similarity}`)
    console.log(`    vedabase_url: ${first.vedabase_url}`)
    console.log(`    chunk_text: ${first.chunk_text.substring(0, 100)}...`)

    console.log(`\n  All results (summary):`)
    data.forEach((r: any, idx: number) => {
      console.log(`    ${idx + 1}. ${r.book} ${r.chapter}.${r.verse} (similarity: ${r.similarity.toFixed(3)})`)
    })
  } else {
    console.log('  ❌ No rows returned')
  }

  console.log('\n' + '='.repeat(80))
  console.log('STEP 4: Summary')
  console.log('='.repeat(80))

  if (data && data.length > 0) {
    console.log(`✓ SUCCESS: match_verse_chunks returned ${data.length} rows`)
    console.log('✓ Query 2 retrieval is now working')
  } else {
    console.log('✗ FAILURE: match_verse_chunks still returns 0 rows')
    console.log('✗ The RPC function fix may not be deployed yet')
  }

  process.exit(0)
}

test().catch(e => {
  console.error('Test failed:', e)
  process.exit(1)
})
