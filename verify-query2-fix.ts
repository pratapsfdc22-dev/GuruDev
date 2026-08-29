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
  const data = await response.json() as { data: Array<{ embedding: number[] }> }
  return data.data[0].embedding
}

async function main(): Promise<void> {
  const query2 = 'How can I deal with anxiety and fear about the future?'
  console.log('Embedding Query 2...')
  const embedding = await embedQuery(query2)
  console.log(`✓ Embedded: ${embedding.length} dimensions\n`)

  console.log('Calling match_verse_chunks...')
  console.time('RPC duration')
  const { data, error } = await client.rpc('match_verse_chunks', {
    query_embedding: embedding,
    match_count: 12,
    match_threshold: -1,
  })
  console.timeEnd('RPC duration')

  console.log(`\nResults:`)
  console.log(`  Error: ${error ? JSON.stringify(error) : 'none'}`)
  console.log(`  Rows: ${data?.length || 0}`)

  if (data && data.length > 0) {
    console.log(`\nFirst result:`)
    const first = data[0] as any
    console.log(`  ${first.book} ${first.chapter}.${first.verse}`)
    console.log(`  Similarity: ${first.similarity.toFixed(3)}`)
    console.log(`  URL: ${first.vedabase_url}`)
    console.log(`\nAll ${data.length} results:`)
    data.forEach((r: any, i: number) => {
      console.log(`  ${i + 1}. ${r.book} ${r.chapter}.${r.verse} (sim: ${r.similarity.toFixed(3)})`)
    })
  }

  process.exit(0)
}

main().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
