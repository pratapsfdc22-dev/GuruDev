import * as fs from 'fs'

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

function parseVerseFromHtml(html: string, url: string): any | null {
  try {
    const urlMatch = url.match(/\/sb\/(\d+)\/(\d+)\/(\d+)\/$/)
    if (!urlMatch) {
      console.warn(`Could not extract canto/chapter/verse from URL: ${url}`)
      return null
    }

    const canto = parseInt(urlMatch[1], 10)
    const chapter = parseInt(urlMatch[2], 10)
    const verse = parseInt(urlMatch[3], 10)

    // For SB, extract using: opening ॐ or opening Devanagari through ॥ X ॥
    // Try pattern: any Devanagari content ending with verse number
    const sanskritRegex = /([ऀ-ॿ०-९\s।]+॥\s*[\d०-९]+\s*॥)/
    const sanskritMatch = html.match(sanskritRegex)
    const sanskrit = sanskritMatch ? cleanHtmlTextPreservingLineBreaks(sanskritMatch[1]) : ''

    // For transliteration, look for <em> tags that contain the verse
    // SB verses may have different first words than BG, so look for opening @em
    const translitMatches = html.match(/<em>([^<]{50,300})<\/em>/g)
    let transliteration = ''
    if (translitMatches) {
      // Find the one that looks like a full verse (contains multiple words separated by spaces)
      for (const match of translitMatches) {
        const content = match.replace(/<\/?em>/g, '')
        if (content.includes('<br') || content.split(/\s+/).length > 10) {
          transliteration = cleanHtmlText(content)
          break
        }
      }
    }

    // Extract synonyms
    const synonymsMatch = html.match(/<h2[^>]*>Synonyms<\/h2>(.*?)(?=<\/div>.*?<h2|<div class="av-)/)
    let synonymsRaw = synonymsMatch ? synonymsMatch[1] : ''
    synonymsRaw = synonymsRaw.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, '')
    const synonyms = cleanHtmlText(synonymsRaw)

    // Extract translation
    const translationMatch = html.match(/<strong>(.*?)<\/strong>/)
    const translationFull = translationMatch ? cleanHtmlText(translationMatch[1]) : ''
    const translation_excerpt = truncateToWords(translationFull, 15)

    // Extract purport
    const purportMatch = html.match(/<div class="av-purport">(.*?)(?=<div class="av-|$)/s)
    const purportRaw = purportMatch ? purportMatch[1] : ''
    const purportText = cleanHtmlText(purportRaw)
    const purport_preview = purportText.substring(0, 500) + (purportText.length > 500 ? '...' : '')

    return {
      book: 'Srimad-Bhagavatam',
      canto,
      chapter,
      verse,
      vedabase_url: url,
      sanskrit,
      transliteration,
      synonyms,
      translation_excerpt,
      purport_preview,
    }
  } catch (error) {
    console.error(`Error parsing:`, error)
    return null
  }
}

// Test with SB HTML
const html = fs.readFileSync('/tmp/vedabase-sb-raw.html', 'utf-8')
const parsedVerse = parseVerseFromHtml(html, 'https://vedabase.io/en/library/sb/1/1/1/')

if (parsedVerse) {
  console.log('=== PARSED SB 1.1.1 ===')
  console.log(JSON.stringify(parsedVerse, null, 2))
  console.log('\n=== FIELD VERIFICATION ===')
  console.log(`Sanskrit (lines): ${parsedVerse.sanskrit.split('\n').length}`)
  console.log(`Sanskrit:\n${parsedVerse.sanskrit}`)
  console.log(`\nTransliteration (length: ${parsedVerse.transliteration.length}): ${parsedVerse.transliteration.substring(0, 100)}...`)
  console.log(`\nTranslation excerpt (${parsedVerse.translation_excerpt.split(/\s+/).length} words): ${parsedVerse.translation_excerpt}`)
} else {
  console.log('Failed to parse verse')
}
