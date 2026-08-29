import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

// Load .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf-8')
const envVars: Record<string, string> = {}
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY
const VOYAGE_API_KEY = envVars.VOYAGE_API_KEY

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function embedQuery(query: string): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [query], model: 'voyage-3' }),
  })
  const data = (await response.json()) as any
  return data.data[0].embedding
}

async function test() {
  const embedding2 = await embedQuery('How can I deal with anxiety and fear about the future?')

  console.log('Calling debug_match_verse_chunks with Query 2 embedding...\n')
  const { data, error } = await client.rpc('debug_match_verse_chunks', {
    query_embedding: embedding2 as any,
    match_count: 12,
    match_threshold: -1,
  })

  console.log('data:', JSON.stringify(data))
  console.log('error:', JSON.stringify(error))

  process.exit(0)
}

test()
