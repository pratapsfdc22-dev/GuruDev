import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

let supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return supabase
}

export const RetrievedVerseSchema = z.object({
  id: z.string().uuid(),
  verse_id: z.string().uuid(),
  book: z.string(),
  canto: z.number().nullable(),
  chapter: z.number(),
  verse: z.number(),
  vedabase_url: z.string().url(),
  chunk_text: z.string(),
  similarity_score: z.number(),
})

export type RetrievedVerse = z.infer<typeof RetrievedVerseSchema>

async function embedQuery(query: string): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
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

export async function retrieveVerses(
  searchQueries: string[],
  topK: number = 12,
): Promise<RetrievedVerse[]> {
  if (searchQueries.length === 0) {
    return []
  }

  const results: Map<string, RetrievedVerse & { score: number }> = new Map()

  for (const query of searchQueries) {
    const embedding = await embedQuery(query)

    const { data, error } = await getSupabase().rpc('hybrid_search_verse_chunks', {
      query_embedding: embedding,
      query_text: query,
      vector_weight: 0.6,
      fts_weight: 0.4,
      match_count: topK,
    })

    if (error) {
      console.error(`Retrieval error for query "${query}":`, error)
      continue
    }

    if (!data || !Array.isArray(data)) {
      continue
    }

    // Validate each result has required fields
    for (const verse of data) {
      if (!verse.id || !verse.verse_id || !verse.book || !verse.vedabase_url || !verse.chunk_text) {
        console.warn(`Incomplete verse result skipped:`, verse)
        continue
      }
      const key = `${verse.verse_id}`
      const existing = results.get(key)

      const verseResult: RetrievedVerse & { score: number } = {
        id: verse.id,
        verse_id: verse.verse_id,
        book: verse.book,
        canto: verse.canto,
        chapter: verse.chapter,
        verse: verse.verse,
        vedabase_url: verse.vedabase_url,
        chunk_text: verse.chunk_text,
        similarity_score: verse.combined_score || 0,
        score: verse.combined_score || 0,
      }

      if (existing) {
        // Take the higher score (verse found in multiple queries is more relevant)
        verseResult.score = Math.max(existing.score, verseResult.score)
      }

      results.set(key, verseResult)
    }
  }

  // Sort by score and return top K
  return Array.from(results.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ score, ...verse }) => verse)
}

export function formatVerseRef(verse: RetrievedVerse): string {
  if (verse.book === 'Bhagavad-gita') {
    return `Bg. ${verse.chapter}.${verse.verse}`
  } else if (verse.book === 'Srimad-Bhagavatam') {
    return `SB ${verse.canto}.${verse.chapter}.${verse.verse}`
  } else if (verse.book === 'Sri Caitanya-caritamrita' || verse.book === 'Caitanya-caritamrita') {
    return `Cc ${verse.canto}.${verse.chapter}.${verse.verse}`
  }
  return `${verse.book} ${verse.chapter}.${verse.verse}`
}
