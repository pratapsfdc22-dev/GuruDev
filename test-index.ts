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
  const embedding2 = await embedQuery('How can I deal with anxiety and fear about the future?')
  const literal = embedding2.join(',')

  const explainQuery = `
EXPLAIN ANALYZE
SELECT vc.id, 1 - (vc.embedding <=> '[${literal}]'::vector) as similarity
FROM verse_chunks vc
WHERE vc.embedding <=> '[${literal}]'::vector < 2
ORDER BY vc.embedding <=> '[${literal}]'::vector
LIMIT 12;
`

  console.log('Run this in Supabase SQL Editor:\n')
  console.log(explainQuery)
}

test()
