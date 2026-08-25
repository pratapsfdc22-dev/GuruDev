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
  book: string
  canto: number | null
  chapter: number
  verse: number
  vedabase_url: string
  chunk_text: string
  chunk_index: number
  total_chunks: number
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
  // Rough approximation: ~1 token per 4 characters
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

async function generateEmbedding(text: string): Promise<number[]> {
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
    throw new Error(`Voyage API error: ${response.status}`)
  }

  const data = (await response.json()) as any
  return data.data[0].embedding
}

async function writeToSupabase(verses: ParsedVerse[], chunks: VerseChunk[]): Promise<void> {
  // Write verses
  const versesHeaders = new Headers()
  versesHeaders.set('apikey', SUPABASE_SERVICE_KEY || '')
  versesHeaders.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY}`)
  versesHeaders.set('Content-Type', 'application/json')
  versesHeaders.set('Prefer', 'return=minimal')

  const versesResponse = await fetch(`${SUPABASE_URL}/rest/v1/verses`, {
    method: 'POST',
    headers: versesHeaders,
    body: JSON.stringify(
      verses.map(v => ({
        book: v.book,
        canto: v.canto,
        chapter: v.chapter,
        verse: v.verse,
        vedabase_url: v.vedabase_url,
        sanskrit: v.sanskrit,
        transliteration: v.transliteration,
        translation_excerpt: v.translation_excerpt,
      }))
    ),
  })

  if (!versesResponse.ok) {
    console.error('Failed to write verses:', await versesResponse.text())
    throw new Error('Verse insertion failed')
  }

  console.log(`Wrote ${verses.length} verses to database`)

  // Write chunks with embeddings
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.chunk_text)

    const chunkHeaders = new Headers()
    chunkHeaders.set('apikey', SUPABASE_SERVICE_KEY || '')
    chunkHeaders.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY}`)
    chunkHeaders.set('Content-Type', 'application/json')
    chunkHeaders.set('Prefer', 'return=minimal')

    const chunkResponse = await fetch(`${SUPABASE_URL}/rest/v1/verse_chunks`, {
      method: 'POST',
      headers: chunkHeaders,
      body: JSON.stringify({
        book: chunk.book,
        canto: chunk.canto,
        chapter: chunk.chapter,
        verse: chunk.verse,
        vedabase_url: chunk.vedabase_url,
        chunk_text: chunk.chunk_text,
        chunk_index: chunk.chunk_index,
        total_chunks: chunk.total_chunks,
        embedding,
      }),
    })

    if (!chunkResponse.ok) {
      console.error(`Failed to write chunk Bg ${chunk.chapter}.${chunk.verse}:${chunk.chunk_index}`)
    }
  }

  console.log(`Wrote ${chunks.length} verse chunks with embeddings to database`)
}

async function ingestBhagavadGita(): Promise<void> {
  const allVerses: ParsedVerse[] = []
  const allChunks: VerseChunk[] = []
  let successCount = 0
  let failureCount = 0

  console.log('Starting Bhagavad-gita full ingestion...')
  console.log('Bhagavad-gita has 18 chapters with ~700 total verses\n')

  // BG chapter verse counts (standard)
  const bgVerseCount: Record<number, number> = {
    1: 47, 2: 72, 3: 43, 4: 42, 5: 29, 6: 47, 7: 30, 8: 28, 9: 34, 10: 42,
    11: 55, 12: 20, 13: 34, 14: 27, 15: 20, 16: 24, 17: 28, 18: 78,
  }

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
          successCount++

          // Chunk the purport
          const purportChunks = chunkPurport(parsed.purport_full, 500)
          purportChunks.forEach((chunkText, idx) => {
            allChunks.push({
              book: 'Bhagavad-gita',
              canto: null,
              chapter: ch,
              verse,
              vedabase_url: parsed.vedabase_url,
              chunk_text: chunkText,
              chunk_index: idx,
              total_chunks: purportChunks.length,
            })
          })

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
  console.log(`Generated ${allChunks.length} chunks from ${allVerses.length} verses`)
  console.log('\nWriting to Supabase...')

  await writeToSupabase(allVerses, allChunks)

  console.log('\n=== INGESTION SUMMARY ===')
  console.log(`Verses table rows: ${allVerses.length}`)
  console.log(`Verse chunks table rows: ${allChunks.length}`)

  // Show 2 random chunks
  if (allChunks.length >= 2) {
    console.log('\n=== SAMPLE CHUNKS (raw, unmodified) ===\n')
    const indices = [
      Math.floor(Math.random() * allChunks.length),
      Math.floor(Math.random() * allChunks.length),
    ]

    for (const idx of indices) {
      const chunk = allChunks[idx]
      console.log(`Chunk ${idx}:`)
      console.log(`  Verse: Bg ${chunk.chapter}.${chunk.verse}`)
      console.log(`  Chunk index: ${chunk.chunk_index}/${chunk.total_chunks}`)
      console.log(`  Text length: ${chunk.chunk_text.length} characters`)
      console.log(`  Text:\n"${chunk.chunk_text}"\n`)
    }
  }
}

ingestBhagavadGita()
  .then(() => {
    console.log('✓ Phase 2 ingestion complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('✗ Ingestion failed:', error)
    process.exit(1)
  })
