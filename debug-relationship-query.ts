import * as fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf-8')
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

import { classifySafety } from './lib/ai/safety'
import { transformQuery } from './lib/ai/query-transform'
import { retrieveVerses } from './lib/ai/retrieval'
import { createClient } from '@/lib/supabase/client'

async function debug(): Promise<void> {
  const userMessage = 'My wife is rude today and not loving me. Im so frustrated'

  console.log('================================================================================')
  console.log('DEBUG: MESSAGE RETRIEVAL FAILURE')
  console.log('================================================================================')
  console.log()
  console.log('INPUT MESSAGE:')
  console.log(`"${userMessage}"`)
  console.log()

  // Step 1: Safety classification
  console.log('[Step 1] Safety Classification...')
  const safety = await classifySafety(userMessage)
  console.log(JSON.stringify(safety, null, 2))
  console.log()

  // Step 2: Query transformation
  console.log('[Step 2] Query Transformation...')
  const transformation = await transformQuery(userMessage, safety.classification === 'sensitive')
  console.log(JSON.stringify(transformation, null, 2))
  console.log()

  // Step 3: Retrieval with direct RPC inspection
  console.log('[Step 3] Retrieval - Calling hybrid_search_verse_chunks RPC...')
  console.log()

  const supabase = createClient()

  for (const query of transformation.search_queries) {
    console.log(`--- Query: "${query}" ---`)

    try {
      const { data, error } = await supabase.rpc('hybrid_search_verse_chunks', {
        search_query: query,
        top_k: 12,
      })

      if (error) {
        console.log(`ERROR:`)
        console.log(JSON.stringify(error, null, 2))
      } else if (!data || data.length === 0) {
        console.log(`RESULT: 0 rows returned`)
      } else {
        console.log(`RESULT: ${data.length} rows`)
        console.log(`First result:`)
        console.log(JSON.stringify(data[0], null, 2))
      }
    } catch (e) {
      console.log(`EXCEPTION:`)
      console.log(e instanceof Error ? e.message : String(e))
    }
    console.log()
  }

  // Step 4: Full retrieval
  console.log('[Step 4] Full retrieveVerses() call...')
  try {
    const retrieved = await retrieveVerses(transformation.search_queries, 12)
    console.log(`Total retrieved: ${retrieved.length} verses`)
    if (retrieved.length > 0) {
      console.log(`First verse:`)
      console.log(JSON.stringify(retrieved[0], null, 2))
    }
  } catch (e) {
    console.log(`ERROR:`)
    console.log(e instanceof Error ? e.message : String(e))
  }
}

debug().catch(console.error)
