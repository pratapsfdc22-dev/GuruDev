import * as fs from 'fs'
import * as path from 'path'

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
  purport_preview: string
}

const OUTPUT_DIR = path.join(process.cwd(), 'scripts/corpus-data')
const USER_AGENT =
  'GuruDev-Ingestion/1.0 (Vedabase corpus ingestion; contact pratapsfdc22@gmail.com)'

// Rate limiting: 500ms between requests
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
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

function cleanHtmlText(text: string): string {
  // Replace line break tags with spaces BEFORE removing tags
  text = text.replace(/<br\s*\/?>/g, ' ')
  text = text.replace(/\\u003cbr\s*\/?\\u003e/g, ' ')
  // Replace closing/opening tag pairs with space
  text = text.replace(/<\/[^>]+><[^>]+>/g, ' ')
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')
  // Remove escaped quotes
  text = text.replace(/\\"/g, '')
  // Replace HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&rsquo;/g, "'")
  text = text.replace(/&lsquo;/g, "'")
  // Collapse multiple whitespace to single space
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

function cleanHtmlTextPreservingLineBreaks(text: string): string {
  // Replace line break tags with newlines (preserve structure)
  text = text.replace(/<br\s*\/?>/g, '\n')
  text = text.replace(/\\u003cbr\s*\/?\\u003e/g, '\n')
  // Replace closing/opening tag pairs with space
  text = text.replace(/<\/[^>]+><[^>]+>/g, ' ')
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')
  // Remove escaped quotes
  text = text.replace(/\\"/g, '')
  // Replace HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&rsquo;/g, "'")
  text = text.replace(/&lsquo;/g, "'")
  // Collapse multiple spaces (but preserve newlines)
  text = text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).join('\n')
  return text
}

function truncateToWords(text: string, wordLimit: number): string {
  const words = text.split(/\s+/)
  return words.slice(0, wordLimit).join(' ')
}

async function parseVersePage(url: string): Promise<ParsedVerse | null> {
  try {
    const html = await fetchWithRateLimit(url)

    // Extract chapter and verse from URL: https://vedabase.io/en/library/bg/2/47/
    const urlMatch = url.match(/\/bg\/(\d+)\/(\d+)\/$/)
    if (!urlMatch) {
      console.warn(`Could not extract chapter/verse from URL: ${url}`)
      return null
    }

    const chapter = parseInt(urlMatch[1], 10)
    const verse = parseInt(urlMatch[2], 10)

    // Extract complete Sanskrit (both lines, from first line through double daṇḍa)
    // Use line-break-preserving version to maintain 2-line śloka structure
    const sanskritRegex = /([ऀ-ॿ०-९\s।]+।[^॥]*?[ऀ-ॿ०-९\s।]+॥)/
    const sanskritMatch = html.match(sanskritRegex)
    const sanskrit = sanskritMatch ? cleanHtmlTextPreservingLineBreaks(sanskritMatch[1]) : ''

    // Extract transliteration (from <em> tag containing the full verse)
    const translitMatch = html.match(/(<em>karmaṇy.*?akarmaṇi<\/em>)/i)
    const transliteration = translitMatch ? cleanHtmlText(translitMatch[1]) : ''

    // Extract synonyms
    const synonymsMatch = html.match(/<h2[^>]*>Synonyms<\/h2>(.*?)(?=<\/div>.*?<h2|<div class="av-)/)
    let synonymsRaw = synonymsMatch ? synonymsMatch[1] : ''
    synonymsRaw = synonymsRaw.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, '')
    const synonyms = cleanHtmlText(synonymsRaw)

    // Extract full translation
    const translationMatch = html.match(/<strong>(.*?)<\/strong>/)
    const translationFull = translationMatch ? cleanHtmlText(translationMatch[1]) : ''

    // Extract translation excerpt (capped at 15 words, hard cut, no ellipsis)
    const translation_excerpt = truncateToWords(translationFull, 15)

    // Extract purport
    const purportMatch = html.match(/<div class="av-purport">(.*?)(?=<div class="av-|$)/s)
    const purportRaw = purportMatch ? purportMatch[1] : ''
    const purportText = cleanHtmlText(purportRaw)
    const purport_preview = purportText.substring(0, 500) + (purportText.length > 500 ? '...' : '')

    const parsed: ParsedVerse = {
      book: 'Bhagavad-gita',
      canto: null,
      chapter,
      verse,
      vedabase_url: url,
      sanskrit,
      transliteration,
      synonyms,
      translation_excerpt,
      purport_preview,
    }

    return parsed
  } catch (error) {
    console.error(`Error parsing ${url}:`, error)
    return null
  }
}

async function ingestBhagavadGita(): Promise<void> {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const verses: ParsedVerse[] = []

  // For Phase 2 validation, fetch a small subset: 3 sample verses to check parsing
  const sampleVerses = [
    { chapter: 1, verse: 1 },
    { chapter: 2, verse: 47 },
    { chapter: 3, verse: 3 },
  ]

  console.log('Starting Bhagavad-gita sample ingestion...')
  console.log(`Fetching ${sampleVerses.length} sample verses for validation`)

  for (const { chapter, verse } of sampleVerses) {
    const url = `https://vedabase.io/en/library/bg/${chapter}/${verse}/`
    console.log(`Fetching: ${url}`)

    const parsed = await parseVersePage(url)
    if (parsed) {
      verses.push(parsed)
      console.log(`✓ Parsed Bg ${chapter}.${verse}`)
    } else {
      console.log(`✗ Failed to parse Bg ${chapter}.${verse}`)
    }
  }

  // Write sample verses to JSON
  const outputFile = path.join(OUTPUT_DIR, 'bhagavad-gita-sample.json')
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(outputFile, JSON.stringify(verses, null, 2))
  console.log(`\n✓ Wrote ${verses.length} sample verses to ${outputFile}`)

  // Log sample for inspection
  if (verses.length > 0) {
    console.log('\n=== SAMPLE VERSES ===')
    verses.forEach((v, i) => {
      console.log(`\nVerse ${i + 1}: Bg ${v.chapter}.${v.verse}`)
      console.log(`  Sanskrit: ${v.sanskrit}`)
      console.log(`  Transliteration: ${v.transliteration}`)
      console.log(`  Translation excerpt (${v.translation_excerpt.split(/\s+/).length} words): ${v.translation_excerpt}`)
    })
  }
}

// Run ingestion
ingestBhagavadGita()
  .then(() => {
    console.log('\n✓ Ingestion complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('✗ Ingestion failed:', error)
    process.exit(1)
  })
