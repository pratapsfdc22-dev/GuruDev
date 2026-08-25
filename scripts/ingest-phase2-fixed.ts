const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !VOYAGE_API_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

interface ParsedVerse {
  book: string
  canto: number | null
  chapter: number
  verse: number
  vedabase_url: string
  sanskrit: string
  transliteration: string
  synonyms: string
  translation_excerpt: string
  purport_full: string
}

interface VerseChunk {
  verse_id: string
  book: string
  canto: number | null
  chapter: number
  verse: number
  vedabase_url: string
  chunk_text: string
  embedding: number[]
}

const USER_AGENT = 'GuruDev-Ingestion/1.0 (Vedabase corpus ingestion; contact pratapsfdc22@gmail.com)'
const RATE_LIMIT_MS = 500
let lastRequestTime = 0

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRateLimit(url: string): Promise<string> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - timeSinceLastRequest)
  }
  lastRequestTime = Date.now()

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return response.text()
}

function cleanHtmlText(text: string): string {
  text = text.replace(/<br\s*\/?>/g, ' ')
  text = text.replace(/\\u003cbr\s*\/?\\u003e/g, ' ')
  text = text.replace(/<\/[^>]+><[^>]+>/g, ' ')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/\\"/g, '')
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&rsquo;/g, "'")
  text = text.replace(/&lsquo;/g, "'")
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

function cleanHtmlTextPreservingLineBreaks(text: string): string {
  text = text.replace(/<br\s*\/?>/g, '\n')
  text = text.replace(/\\u003cbr\s*\/?\\u003e/g, '\n')
  text = text.replace(/<\/[^>]+><[^>]+>/g, ' ')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/\\"/g, '')
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&rsquo;/g, "'")
  text = text.replace(/&lsquo;/g, "'")
  text = text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(l => l).join('\n')
  return text
}

function truncateToWords(text: string, wordLimit: number): string {
  const words = text.split(/\s+/)
  return words.slice(0, wordLimit).join(' ')
}

async function parseVersePage(html: string, chapter: number, verse: number): Promise<ParsedVerse | null> {
  try {
    // Extract Sanskrit (both lines, through double daṇḍa)
    const sanskritRegex = /([ऀ-ॿ०-९\s।]+।[^॥]*?[ऀ-ॿ०-९\s।]+॥)/
    const sanskritMatch = html.match(sanskritRegex)
    const sanskrit = sanskritMatch ? cleanHtmlTextPreservingLineBreaks(sanskritMatch[1]) : ''

    // Extract transliteration
    const translitMatch = html.match(/(<em>[^<]{50,300}<\/em>)/i)
    const transliteration = translitMatch ? cleanHtmlText(translitMatch[1]) : ''

    // Extract synonyms
    const synonymsMatch = html.match(/<h2[^>]*>Synonyms<\/h2>(.*?)(?=<\/div>.*?<h2|<div class="av-)/)
    let synonymsRaw = synonymsMatch ? synonymsMatch[1] : ''
    synonymsRaw = synonymsRaw.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, '')
    const synonyms = cleanHtmlText(synonymsRaw)

    // Extract full translation
    const translationMatch = html.match(/<strong>(.*?)<\/strong>/)
    const translationFull = translationMatch ? cleanHtmlText(translationMatch[1]) : ''
    const translation_excerpt = truncateToWords(translationFull, 15)

    // Extract full purport
    const purportMatch = html.match(/<div class="av-purport">(.*?)(?=<div class="av-|$)/s)
    const purportRaw = purportMatch ? purportMatch[1] : ''
    const purport_full = cleanHtmlText(purportRaw)

    const parsed: ParsedVerse = {
      book: 'Bhagavad-gita',
      canto: null,
      chapter,
      verse,
      vedabase_url: `https://vedabase.io/en/library/bg/${chapter}/${verse}/`,
      sanskrit,
      transliteration,
      synonyms,
      translation_excerpt,
      purport_full,
    }

    return parsed
  } catch (error) {
    console.error(`Error parsing Bg ${chapter}.${verse}:`, error)
    return null
  }
}

function countTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function chunkPurport(purport: string, targetTokens = 500): string[] {
  if (!purport || purport.length === 0) {
    return []
  }

  const chunks: string[] = []
  const sentences = purport.match(/[^.!?]+[.!?]+/g) || [purport]

  let currentChunk = ''
  let currentTokens = 0

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence)

    if (currentTokens + sentenceTokens > targetTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
      currentTokens = sentenceTokens
    } else {
      currentChunk += sentence
      currentTokens += sentenceTokens
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VOYAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: 'voyage-3',
        }),
      })

      if (!response.ok) {
        if (attempt < retries) {
          await sleep(2000)
          continue
        }
        throw new Error(`Voyage API error: ${response.status}`)
      }

      const data = (await response.json()) as any
      return data.data[0].embedding
    } catch (error) {
      if (attempt < retries) {
        await sleep(2000)
        continue
      }
      throw error
    }
  }
  throw new Error('Embedding generation failed')
}

async function insertVerses(verses: ParsedVerse[]): Promise<Map<string, string>> {
  const headers = new Headers()
  headers.set('apikey', SUPABASE_SERVICE_KEY || '')
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY}`)
  headers.set('Content-Type', 'application/json')
  headers.set('Prefer', 'return=representation')

  const verseMap = new Map<string, string>()

  for (const verse of verses) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/verses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          book: verse.book,
          canto: verse.canto,
          chapter: verse.chapter,
          verse: verse.verse,
          vedabase_url: verse.vedabase_url,
          sanskrit: verse.sanskrit,
          transliteration: verse.transliteration,
          translation_excerpt: verse.translation_excerpt,
        }),
      })

      if (response.ok) {
        const data = (await response.json()) as any
        if (Array.isArray(data) && data.length > 0) {
          verseMap.set(verse.vedabase_url, data[0].id)
        }
      } else {
        const error = await response.text()
        if (error.includes('duplicate')) {
          // Verse already exists, fetch its ID
          const fetchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/verses?vedabase_url=eq.${encodeURIComponent(verse.vedabase_url)}&select=id`,
            { method: 'GET', headers }
          )
          if (fetchRes.ok) {
            const existing = (await fetchRes.json()) as any
            if (existing.length > 0) {
              verseMap.set(verse.vedabase_url, existing[0].id)
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error inserting verse ${verse.chapter}.${verse.verse}:`, error)
    }
  }

  return verseMap
}

async function insertChunks(chunks: VerseChunk[]): Promise<void> {
  const headers = new Headers()
  headers.set('apikey', SUPABASE_SERVICE_KEY || '')
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY}`)
  headers.set('Content-Type', 'application/json')
  headers.set('Prefer', 'return=minimal')

  let successCount = 0
  let failureCount = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/verse_chunks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          verse_id: chunk.verse_id,
          book: chunk.book,
          canto: chunk.canto,
          chapter: chunk.chapter,
          verse: chunk.verse,
          vedabase_url: chunk.vedabase_url,
          chunk_text: chunk.chunk_text,
          embedding: chunk.embedding,
        }),
      })

      if (response.ok) {
        successCount++
      } else {
        failureCount++
      }

      if ((i + 1) % 1000 === 0) {
        console.log(`  Wrote ${i + 1}/${chunks.length} chunks...`)
      }
    } catch (error) {
      failureCount++
    }
  }

  console.log(`Wrote ${successCount} chunks, ${failureCount} failures`)
}

async function ingestBhagavadGita(): Promise<void> {
  const allVerses: ParsedVerse[] = []
  const allChunksData: Array<{ verse: ParsedVerse; chunks: string[] }> = []
  let successCount = 0
  let failureCount = 0

  console.log('Starting Bhagavad-gita full ingestion...')
  console.log('Bhagavad-gita has 18 chapters with ~700 total verses\n')

  // BG chapter verse counts (standard)
  const bgVerseCount: Record<number, number> = {
    1: 47, 2: 72, 3: 43, 4: 42, 5: 29, 6: 47, 7: 30, 8: 28, 9: 34, 10: 42,
    11: 55, 12: 20, 13: 34, 14: 27, 15: 20, 16: 24, 17: 28, 18: 78,
  }

  // Phase 1: Parse all verses
  for (const chapter of Object.keys(bgVerseCount)) {
    const ch = parseInt(chapter, 10)
    const maxVerse = bgVerseCount[ch]

    for (let verse = 1; verse <= maxVerse; verse++) {
      const url = `https://vedabase.io/en/library/bg/${ch}/${verse}/`

      try {
        const html = await fetchWithRateLimit(url)
        const parsed = await parseVersePage(html, ch, verse)

        if (parsed) {
          allVerses.push(parsed)
          const chunks = chunkPurport(parsed.purport_full, 500)
          allChunksData.push({ verse: parsed, chunks })
          successCount++

          if (successCount % 50 === 0) {
            console.log(`✓ Parsed ${successCount} verses...`)
          }
        } else {
          failureCount++
        }
      } catch (error) {
        failureCount++
        console.error(`✗ Error fetching Bg ${ch}.${verse}`)
      }
    }
  }

  console.log(`\n✓ Parsing complete: ${successCount} verses, ${failureCount} failures`)
  const totalChunks = allChunksData.reduce((sum, item) => sum + item.chunks.length, 0)
  console.log(`Generated ${totalChunks} chunks from ${allVerses.length} verses\n`)

  // Phase 2: Insert verses and get their IDs
  console.log('Writing verses to Supabase...')
  const verseIdMap = await insertVerses(allVerses)
  console.log(`Verses written: ${verseIdMap.size}\n`)

  // Phase 3: Generate embeddings and prepare chunks
  console.log('Generating embeddings and writing chunks...')
  const allChunks: VerseChunk[] = []

  for (const { verse, chunks } of allChunksData) {
    const verseId = verseIdMap.get(verse.vedabase_url)
    if (!verseId) {
      console.warn(`Warning: No ID found for verse ${verse.chapter}.${verse.verse}`)
      continue
    }

    for (const chunkText of chunks) {
      try {
        const embedding = await generateEmbedding(chunkText)
        allChunks.push({
          verse_id: verseId,
          book: verse.book,
          canto: verse.canto,
          chapter: verse.chapter,
          verse: verse.verse,
          vedabase_url: verse.vedabase_url,
          chunk_text: chunkText,
          embedding,
        })

        if (allChunks.length % 500 === 0) {
          console.log(`  Generated embeddings for ${allChunks.length} chunks...`)
        }
      } catch (error) {
        console.error(`Failed to generate embedding for Bg ${verse.chapter}.${verse.verse}`)
      }
    }
  }

  console.log(`Generated embeddings for ${allChunks.length} chunks\n`)

  // Phase 4: Insert chunks
  console.log('Writing chunks to database...')
  await insertChunks(allChunks)

  console.log('\n=== INGESTION SUMMARY ===')
  console.log(`Total verses parsed: ${allVerses.length}`)
  console.log(`Total chunks written: ${allChunks.length}`)

  // Show 2 random chunks
  if (allChunks.length >= 2) {
    console.log('\n=== 2 RANDOM CHUNKS (raw, unmodified) ===\n')
    const idx1 = Math.floor(Math.random() * allChunks.length)
    const idx2 = Math.floor(Math.random() * allChunks.length)

    console.log(`CHUNK 1 (index ${idx1}):`)
    console.log(JSON.stringify(allChunks[idx1], null, 2))
    console.log(`\nCHUNK 2 (index ${idx2}):`)
    console.log(JSON.stringify(allChunks[idx2], null, 2))
  }
}

ingestBhagavadGita()
  .then(() => {
    console.log('\n✓ Phase 2 ingestion complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('✗ Ingestion failed:', error)
    process.exit(1)
  })
