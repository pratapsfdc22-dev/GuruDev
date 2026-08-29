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

  console.log(`Original embedding length: ${embedding2.length}`)
  console.log(`Original first element: ${embedding2[0]}`)
  console.log(`Original last element: ${embedding2[embedding2.length - 1]}`)
  
  // Read the literal from file
  const fs = require('fs')
  const literal = fs.readFileSync('/tmp/literal-only.txt', 'utf-8')
  const literalNumbers = literal.slice(1, -1).split(',').map((s: string) => parseFloat(s.trim()))
  
  console.log(`\nLiteral has ${literalNumbers.length} elements`)
  
  if (literalNumbers.length < embedding2.length) {
    console.log(`\nMissing: ${embedding2.length - literalNumbers.length} element(s)`)
    console.log(`\nSearching for where they differ...`)
    
    for (let i = 0; i < Math.min(embedding2.length, literalNumbers.length); i++) {
      if (embedding2[i] !== literalNumbers[i]) {
        console.log(`First difference at index ${i}:`)
        console.log(`  Original[${i}] = ${embedding2[i]}`)
        console.log(`  Literal[${i}] = ${literalNumbers[i]}`)
        console.log(`  Original[${i-1}] = ${embedding2[i-1]}`)
        console.log(`  Literal[${i-1}] = ${literalNumbers[i-1]}`)
        break
      }
    }
    
    if (literalNumbers.length > 0) {
      console.log(`\nLast elements:`)
      console.log(`  Original[-2] = ${embedding2[embedding2.length - 2]}`)
      console.log(`  Original[-1] = ${embedding2[embedding2.length - 1]}`)
      console.log(`  Literal[-2] = ${literalNumbers[literalNumbers.length - 2]}`)
      console.log(`  Literal[-1] = ${literalNumbers[literalNumbers.length - 1]}`)
    }
  }
  
  process.exit(0)
}

test().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
