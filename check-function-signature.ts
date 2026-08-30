import * as fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf-8')
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

import { createClient } from '@supabase/supabase-js'

async function checkFunction(): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log('================================================================================')
  console.log('FUNCTION SIGNATURE CHECK')
  console.log('================================================================================')
  console.log()

  // Query the function definition
  const { data, error } = await supabase
    .from('information_schema.routines')
    .select('routine_name, routine_definition')
    .eq('routine_name', 'hybrid_search_verse_chunks')

  if (error) {
    console.log('ERROR querying information_schema:')
    console.log(JSON.stringify(error, null, 2))
    return
  }

  console.log('FUNCTION DEFINITION:')
  console.log()
  if (data && data.length > 0) {
    console.log(data[0].routine_definition)
  } else {
    console.log('Function not found in information_schema')
  }

  console.log()
  console.log('================================================================================')
  console.log('RPC CALL PARAMETERS (from retrieval.ts line 64-70):')
  console.log('================================================================================')
  console.log()
  console.log('The code sends:')
  console.log('  .rpc("hybrid_search_verse_chunks", {')
  console.log('    query_embedding: embedding,')
  console.log('    query_text: query,')
  console.log('    vector_weight: 0.6,')
  console.log('    fts_weight: 0.4,')
  console.log('    match_count: topK,')
  console.log('  })')
}

checkFunction().catch(console.error)
