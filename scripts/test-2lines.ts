import * as fs from 'fs'

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

// Test
const html = fs.readFileSync('/tmp/vedabase-raw.html', 'utf-8')
const sanskritRegex = /([ऀ-ॿ०-९\s।]+।[^॥]*?[ऀ-ॿ०-९\s।]+॥)/
const sanskritMatch = html.match(sanskritRegex)
const sanskrit = sanskritMatch ? cleanHtmlTextPreservingLineBreaks(sanskritMatch[1]) : ''

console.log('=== SANSKRIT (2 lines preserved) ===')
console.log(sanskrit)
console.log('\n=== JSON representation ===')
console.log(JSON.stringify(sanskrit, null, 2))
