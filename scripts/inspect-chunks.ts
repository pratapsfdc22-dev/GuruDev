import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SERVICE_KEY)

async function inspect() {
  console.log('='.repeat(80))
  console.log('INSPECTING SPECIFIC CHUNKS FOR ARTIFACTS')
  console.log('='.repeat(80))

  // Query specific verses
  const testVerses = [
    { book: 'Bhagavad-gita', chapter: 3, verse: 22 },
    { book: 'Bhagavad-gita', chapter: 4, verse: 17 },
    { book: 'Bhagavad-gita', chapter: 3, verse: 41 },
  ]

  for (const tv of testVerses) {
    console.log(`\n>>> ${tv.book} ${tv.chapter}.${tv.verse}`)

    const { data, error } = await client
      .from('verse_chunks')
      .select('chunk_text, embedding')
      .eq('book', tv.book)
      .eq('chapter', tv.chapter)
      .eq('verse', tv.verse)
      .limit(1)

    if (error) {
      console.log(`ERROR: ${error.message}`)
      continue
    }

    if (!data || data.length === 0) {
      console.log('NO CHUNKS FOUND')
      continue
    }

    const chunk = data[0]
    const text = chunk.chunk_text as string
    const hasEmbedding = chunk.embedding ? 'YES (1024-dim)' : 'NO'

    console.log(`Embedding: ${hasEmbedding}`)
    console.log(`Length: ${text.length} chars`)
    console.log(`First 400 chars:\n---`)
    console.log(text.substring(0, 400))
    console.log('---')

    // Check for artifact patterns
    const patterns = {
      '__next_f.push': text.includes('__next_f.push'),
      '__next_f': text.includes('__next_f'),
      'push([': text.includes('push(['),
      'className:': text.includes('className:'),
      'children:[': text.includes('children:['),
      '.js,': text.includes('.js,'),
      'self.__next': text.includes('self.__next'),
      'dangerously': text.includes('dangerously'),
      'word_for_word': text.includes('word_for_word'),
      'self.G': text.includes('self.G'),
    }

    const found = Object.entries(patterns)
      .filter(([, detected]) => detected)
      .map(([pattern]) => pattern)

    if (found.length > 0) {
      console.log(`⚠️ ARTIFACTS DETECTED: ${found.join(', ')}`)
    } else {
      console.log('✅ NO ARTIFACTS DETECTED')
    }
  }

  // Now count all chunks with artifact patterns
  console.log(`\n\n${'='.repeat(80)}`)
  console.log('COUNTING ARTIFACT PATTERNS ACROSS ALL CHUNKS')
  console.log(`${'='.repeat(80)}\n`)

  const patterns = [
    '__next_f.push',
    '__next_f',
    'push([',
    'className:',
    'children:[',
    '.js,',
    'self.__next',
    'dangerously',
    'word_for_word',
    'self.G',
  ]

  for (const pattern of patterns) {
    const { data, error, count } = await client
      .from('verse_chunks')
      .select('id', { count: 'exact', head: true })
      .ilike('chunk_text', `%${pattern}%`)

    if (error) {
      console.log(`${pattern}: ERROR - ${error.message}`)
    } else {
      console.log(`${pattern}: ${count || 0} chunks`)
    }
  }

  console.log(`\nTotal chunks in database:`)
  const { count: totalCount } = await client
    .from('verse_chunks')
    .select('id', { count: 'exact', head: true })

  console.log(`${totalCount} chunks`)

  process.exit(0)
}

inspect().catch(console.error)
