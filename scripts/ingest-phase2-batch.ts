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

const USER_AGENT = 'GuruDev-Ingestion/1.0 (Vedabase corpus ingestion)'
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
    const sanskritRegex = /([ऀ-ॿ०-९\s।]+।[^॥]*?[ऀ-ॿ०-९\s।]+॥)/
    const sanskritMatch = html.match(sanskritRegex)
    const sanskrit = sanskritMatch ? cleanHtmlTextPreservingLineBreaks(sanskritMatch[1]) : ''

    const translitMatch = html.match(/(<em>[^<]{50,300}<\/em>)/i)
    const transliteration = translitMatch ? cleanHtmlText(translitMatch[1]) : ''

    const synonymsMatch = html.match(/<h2[^>]*>Synonyms<\/h2>(.*?)(?=<\/div>.*?<h2|<div class="av-)/)
    let synonymsRaw = synonymsMatch ? synonymsMatch[1] : ''
    synonymsRaw = synonymsRaw.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, '')
    const synonyms = cleanHtmlText(synonymsRaw)

    const translationMatch = html.match(/<strong>(.*?)<\/strong>/)
    const translationFull = translationMatch ? cleanHtmlText(translationMatch[1]) : ''
    const translation_excerpt = truncateToWords(translationFull, 15)

    // Extract purport: content between "Purport</h2>" and the next section
    // Stop at footer markers: "Donate", "Thanks to", or navigation divs like <div class="mt-10
    const purportRegex = /Purport<\/h2>(.*?)(?=<div class="mt-10|Donate|Thanks to|$)/s
    const purportMatch = html.match(purportRegex)
    let purportRaw = purportMatch ? purportMatch[1] : ''

    // Strip boilerplate footer content before cleaning
    // Remove: "Donate Thanks to [donor list]" section
    purportRaw = purportRaw.replace(/Donate\s+Thanks\s+to.*?(?=<div|$)/s, '')

    // Remove common footer/navigation patterns
    purportRaw = purportRaw.replace(/<div class="mt-10[\s\S]*$/s, '')

    const purport_full = cleanHtmlText(purportRaw)

    return {
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

async function generateEmbeddingsBatch(texts: string[], retries = 5): Promise<number[][]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VOYAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: texts,
          model: 'voyage-3',
        }),
      })

      if (!response.ok) {
        if (response.status === 429 && attempt < retries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 30000)
          console.log(`  Rate limited (429), waiting ${waitTime}ms before retry ${attempt}/${retries}...`)
          await sleep(waitTime)
          continue
        }
        throw new Error(`Voyage API error: ${response.status}`)
      }

      const data = (await response.json()) as any
      return data.data.map((item: any) => item.embedding)
    } catch (error) {
      if (attempt < retries && error instanceof Error && error.message.includes('429')) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 30000)
        console.log(`  Rate limited, waiting ${waitTime}ms...`)
        await sleep(waitTime)
        continue
      }
      throw error
    }
  }
  throw new Error('Failed to generate embeddings after retries')
}

async function insertVerses(verses: ParsedVerse[]): Promise<Map<string, string>> {
  const headers = new Headers()
  headers.set('apikey', SUPABASE_SERVICE_KEY || '')
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY}`)
  headers.set('Content-Type', 'application/json')
  headers.set('Prefer', 'return=representation')

  const verseMap = new Map<string, string>()

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/verses`, {
      method: 'POST',
      headers,
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

    if (!response.ok) {
      const error = await response.text()
      console.error(`  Insert response NOT ok. Status: ${response.status}, Error: ${error}`)
      if (error.includes('duplicate')) {
        console.log('  Verses already exist in database, fetching IDs...')
        let fetchedCount = 0
        for (const verse of verses) {
          const fetchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/verses?vedabase_url=eq.${encodeURIComponent(verse.vedabase_url)}&select=id`,
            { method: 'GET', headers }
          )
          if (fetchRes.ok) {
            const existing = (await fetchRes.json()) as any
            if (existing.length > 0) {
              verseMap.set(verse.vedabase_url, existing[0].id)
              fetchedCount++
            }
          } else {
            console.error(`    Fetch failed for ${verse.chapter}.${verse.verse}: ${fetchRes.status}`)
          }
        }
        console.log(`  Fetched ${fetchedCount}/${verses.length} verse IDs`)
      } else {
        throw new Error(`Verse insertion failed: ${error}`)
      }
    } else {
      const data = (await response.json()) as any
      console.log(`  Insert OK, extracted ${Array.isArray(data) ? data.length : 0} verse IDs`)
      if (Array.isArray(data)) {
        data.forEach((verse: any) => {
          verseMap.set(verse.vedabase_url, verse.id)
        })
      }
    }
  } catch (error) {
    console.error('Error in insertVerses:', error)
  }

  return verseMap
}

async function insertChunksBatch(chunks: Array<any>): Promise<number> {
  const headers = new Headers()
  headers.set('apikey', SUPABASE_SERVICE_KEY || '')
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_KEY}`)
  headers.set('Content-Type', 'application/json')
  headers.set('Prefer', 'return=minimal')

  let successCount = 0

  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100)

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/verse_chunks`, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      })

      if (response.ok) {
        successCount += batch.length
      }

      if ((i + batch.length) % 500 === 0) {
        console.log(`  Wrote ${Math.min(i + batch.length, chunks.length)}/${chunks.length} chunks...`)
      }
    } catch (error) {
      console.error(`Error writing batch at ${i}:`, error)
    }
  }

  return successCount
}

async function ingestBhagavadGita(): Promise<void> {
  const allVerses: ParsedVerse[] = []
  const allChunksData: Array<{ verse: ParsedVerse; chunks: string[] }> = []
  let successCount = 0
  let failureCount = 0

  console.log('Starting Bhagavad-gita ingestion (batch mode)...\n')

  const bgVerseCount: Record<number, number> = {
    1: 47, 2: 72, 3: 43, 4: 42, 5: 29, 6: 47, 7: 30, 8: 28, 9: 34, 10: 42,
    11: 55, 12: 20, 13: 34, 14: 27, 15: 20, 16: 24, 17: 28, 18: 78,
  }

  // Phase 1: Parse verses
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
      }
    }
  }

  console.log(`\n✓ Parsing: ${successCount} verses, ${failureCount} failures`)
  const totalChunks = allChunksData.reduce((sum, item) => sum + item.chunks.length, 0)
  console.log(`Generated ${totalChunks} chunks\n`)

  // Phase 2: Insert verses
  console.log('Writing verses to Supabase...')
  const verseIdMap = await insertVerses(allVerses)
  console.log(`  ${verseIdMap.size} verses mapped\n`)

  // Phase 3: Generate embeddings in batches and insert
  console.log('Generating embeddings and writing chunks...')
  const allChunksToInsert: Array<any> = []
  const batchTexts: string[] = []
  let batchVerseData: Array<any> = []

  for (const { verse, chunks } of allChunksData) {
    const verseId = verseIdMap.get(verse.vedabase_url)
    if (!verseId) continue

    for (const chunkText of chunks) {
      batchTexts.push(chunkText)
      batchVerseData.push({ verse, verseId, chunkText })

      if (batchTexts.length === 100) {
        try {
          const embeddings = await generateEmbeddingsBatch(batchTexts)
          for (let i = 0; i < embeddings.length; i++) {
            const { verse: v, verseId: vid, chunkText: ct } = batchVerseData[i]
            allChunksToInsert.push({
              verse_id: vid,
              book: v.book,
              canto: v.canto,
              chapter: v.chapter,
              verse: v.verse,
              vedabase_url: v.vedabase_url,
              chunk_text: ct,
              embedding: embeddings[i],
            })
          }
          console.log(`  Generated embeddings for ${allChunksToInsert.length}/${totalChunks} chunks...`)
        } catch (error) {
          console.error('Error generating batch embeddings:', error)
        }

        batchTexts.length = 0
        batchVerseData.length = 0
        await sleep(3000)
      }
    }
  }

  // Handle remaining texts
  if (batchTexts.length > 0) {
    try {
      const embeddings = await generateEmbeddingsBatch(batchTexts)
      for (let i = 0; i < embeddings.length; i++) {
        const { verse: v, verseId: vid, chunkText: ct } = batchVerseData[i]
        allChunksToInsert.push({
          verse_id: vid,
          book: v.book,
          canto: v.canto,
          chapter: v.chapter,
          verse: v.verse,
          vedabase_url: v.vedabase_url,
          chunk_text: ct,
          embedding: embeddings[i],
        })
      }
      console.log(`  Generated embeddings for all chunks`)
    } catch (error) {
      console.error('Error generating final batch:', error)
    }
  }

  console.log(`\nInserting ${allChunksToInsert.length} chunks to database...`)
  const inserted = await insertChunksBatch(allChunksToInsert)

  console.log('\n=== INGESTION SUMMARY ===')
  console.log(`Verses: ${verseIdMap.size}`)
  console.log(`Chunks written: ${inserted}`)

  if (allChunksToInsert.length >= 2) {
    console.log('\n=== 2 RANDOM CHUNKS (raw, unmodified) ===\n')
    const idx1 = Math.floor(Math.random() * allChunksToInsert.length)
    const idx2 = Math.floor(Math.random() * allChunksToInsert.length)

    console.log(`CHUNK 1 (index ${idx1}):`)
    console.log(JSON.stringify(allChunksToInsert[idx1], null, 2))
    console.log(`\nCHUNK 2 (index ${idx2}):`)
    console.log(JSON.stringify(allChunksToInsert[idx2], null, 2))
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
