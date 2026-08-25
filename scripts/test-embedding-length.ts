const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !VOYAGE_API_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

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

async function main() {
  console.log('='.repeat(80))
  console.log('TESTING EMBEDDING ARRAY LENGTH FOR QUERY 2')
  console.log('='.repeat(80))

  const testQuery = 'How can I deal with anxiety and fear about the future?'
  console.log(`\nQuery: "${testQuery}"`)
  console.log('\nCalling Voyage API...')

  const embedding = await embedQuery(testQuery)

  console.log(`\n✓ Received embedding from Voyage API`)
  console.log(`\n>>> EXACT ARRAY LENGTH: ${embedding.length}`)
  console.log(`>>> Array type: ${typeof embedding}`)
  console.log(`>>> Is array: ${Array.isArray(embedding)}`)
  console.log(`>>> First 5 values: [${embedding.slice(0, 5).join(', ')}]`)
  console.log(`>>> Last 5 values: [${embedding.slice(-5).join(', ')}]`)

  console.log(`\n${'='.repeat(80)}`)
  console.log('Now testing what happens when this is passed to RPC...')
  console.log('='.repeat(80))

  const headers = new Headers()
  headers.set('apikey', SUPABASE_SERVICE_KEY || '')
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY}`)
  headers.set('Content-Type', 'application/json')

  const rpcBody = {
    query_embedding: embedding,
    match_count: 12,
    match_threshold: -1,
  }

  console.log(`\nRPC call body structure:`)
  console.log(`  query_embedding.length = ${rpcBody.query_embedding.length}`)
  console.log(`  match_count = ${rpcBody.match_count}`)
  console.log(`  match_threshold = ${rpcBody.match_threshold}`)

  console.log(`\nJSON stringified body size: ${JSON.stringify(rpcBody).length} bytes`)

  console.log(`\nCalling match_verse_chunks RPC...`)
  const vectorRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_verse_chunks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rpcBody),
  })

  console.log(`Response status: ${vectorRes.status}`)
  console.log(`Response headers: ${vectorRes.headers.get('content-type')}`)

  const responseBody = await vectorRes.json()
  console.log(`\nRPC returned: ${Array.isArray(responseBody) ? `array of ${responseBody.length} items` : typeof responseBody}`)

  if (Array.isArray(responseBody) && responseBody.length > 0) {
    console.log(`\nFirst result:`)
    const first = responseBody[0]
    console.log(`  Keys: ${Object.keys(first).join(', ')}`)
  }

  console.log(`\n${'='.repeat(80)}\n`)
  process.exit(0)
}

main().catch(console.error)
