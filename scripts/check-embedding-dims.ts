import { createClient } from '@supabase/supabase-js'

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  // Get a sample embedding
  const { data } = await client
    .from('verse_chunks')
    .select('id, book, chapter, verse, embedding')
    .limit(5)

  if (data && data.length > 0) {
    console.log('='.repeat(60))
    console.log('EMBEDDING DIMENSIONS IN DATABASE')
    console.log('='.repeat(60))
    data.forEach((row: any) => {
      const dims = (row.embedding as number[]).length
      console.log(`${row.book} ${row.chapter}.${row.verse}: ${dims} dimensions`)
    })
  }

  process.exit(0)
}

check()
