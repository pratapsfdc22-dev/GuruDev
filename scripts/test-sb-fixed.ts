import * as fs from 'fs'

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

function extractSanskritFromDevanagariSection(html: string): string {
  // Look for the Devanagari section header followed by verse text
  // This is more reliable than regex matching across the whole HTML
  const devanagariMatch = html.match(/hidden">Devanagari<\/h2>(.*?)<\/div>\s*<\/div>\s*<\/div>\s*<div class="av-/)
  
  if (devanagariMatch) {
    const section = devanagariMatch[1]
    return cleanHtmlTextPreservingLineBreaks(section)
  }
  
  return ''
}

function truncateToWords(text: string, wordLimit: number): string {
  const words = text.split(/\s+/)
  return words.slice(0, wordLimit).join(' ')
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

// Test with SB HTML
const html = fs.readFileSync('/tmp/vedabase-sb-raw.html', 'utf-8')

const sanskrit = extractSanskritFromDevanagariSection(html)

// Get transliteration from first substantial <em> tag
const emMatches = html.match(/<em>([^<]{50,400})<\/em>/g)
let transliteration = ''
if (emMatches) {
  for (const match of emMatches) {
    const content = match.replace(/<\/?em>/g, '')
    if (content.includes('<br') || content.split(/\s+/).length > 10) {
      transliteration = cleanHtmlText(content)
      break
    }
  }
}

// Translation
const translationMatch = html.match(/<strong>(.*?)<\/strong>/)
const translationFull = translationMatch ? cleanHtmlText(translationMatch[1]) : ''
const translation_excerpt = truncateToWords(translationFull, 15)

console.log('=== SB 1.1.1 EXTRACTION (FIXED) ===\n')
console.log('Sanskrit (multi-line):\n' + sanskrit)
console.log('\n' + '='.repeat(60) + '\n')
console.log('Transliteration:\n' + transliteration)
console.log('\n' + '='.repeat(60) + '\n')
console.log('Translation excerpt (15 words):\n' + translation_excerpt)
console.log('\n' + '='.repeat(60) + '\n')
console.log('Line counts:')
console.log(`  Sanskrit lines: ${sanskrit.split('\n').length}`)
console.log(`  Transliteration lines: ${transliteration.split('\n').length}`)
