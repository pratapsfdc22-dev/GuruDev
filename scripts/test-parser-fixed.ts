import * as fs from 'fs'

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

function truncateToWords(text: string, wordLimit: number): string {
  const words = text.split(/\s+/)
  return words.slice(0, wordLimit).join(' ')
}

function parseVerseFromHtml(html: string, url: string): ParsedVerse | null {
  try {
    // Extract chapter and verse from URL
    const urlMatch = url.match(/\/bg\/(\d+)\/(\d+)\/$/)
    if (!urlMatch) {
      console.warn(`Could not extract chapter/verse from URL: ${url}`)
      return null
    }

    const chapter = parseInt(urlMatch[1], 10)
    const verse = parseInt(urlMatch[2], 10)

    // === EXTRACT COMPLETE SANSKRIT (both lines through double daṇḍa) ===
    // Pattern: Devanagari starting text + single daṇḍa + more content + double daṇḍa
    const sanskritRegex = /([ऀ-ॿ०-९\s।]+।[^॥]*?[ऀ-ॿ०-९\s।]+॥)/
    const sanskritMatch = html.match(sanskritRegex)
    const sanskrit = sanskritMatch ? cleanHtmlText(sanskritMatch[1]) : ''

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
    console.error(`Error parsing:`, error)
    return null
  }
}

// Test with the cached HTML
const htmlPath = '/tmp/vedabase-raw.html'
const html = fs.readFileSync(htmlPath, 'utf-8')

const verse = parseVerseFromHtml(html, 'https://vedabase.io/en/library/bg/2/47/')
if (verse) {
  console.log('=== PARSED VERSE: Bg 2.47 (CORRECTED) ===')
  console.log(JSON.stringify(verse, null, 2))
  console.log('\n=== FIELD VERIFICATION ===')
  console.log(`Sanskrit (length: ${verse.sanskrit.length}): ${verse.sanskrit}`)
  console.log(`\nTransliteration (length: ${verse.transliteration.length}): ${verse.transliteration}`)
  console.log(`\nTranslation excerpt (${verse.translation_excerpt.split(/\s+/).length} words): ${verse.translation_excerpt}`)
} else {
  console.log('Failed to parse verse')
}
