import { createClient } from '@supabase/supabase-js'

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

async function test(): Promise<void> {
  const query2 = 'How can I deal with anxiety and fear about the future?'
  const embedding2 = await embedQuery(query2)

  console.log('\n' + '═'.repeat(80))
  console.log('FULL EMBEDDING2 AS JSON STRING (copy everything between the quotes):')
  console.log('═'.repeat(80) + '\n')
  
  const jsonStr = JSON.stringify(embedding2)
  console.log(jsonStr)
  
  console.log('\n' + '═'.repeat(80))
  console.log('PASTE THIS ENTIRE LINE INTO SUPABASE SQL EDITOR:')
  console.log('═'.repeat(80) + '\n')
  
  const sqlCommand = `SELECT * FROM match_verse_chunks('[${jsonStr.slice(1, -1)}]'::vector, 12, -1);`
  console.log(sqlCommand)
  console.log('')
  
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
