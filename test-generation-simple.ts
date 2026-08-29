import * as fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf-8')
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

import { generateResponse, GenerationResponse } from './lib/ai/generation'
import { RetrievedVerseSchema } from './lib/ai/retrieval'

async function test(): Promise<void> {
  // Fake retrieved verses
  const verses = [
    {
      id: '123',
      verse_id: '456',
      book: 'Bhagavad-gita',
      canto: null,
      chapter: 2,
      verse: 47,
      vedabase_url: 'https://vedabase.io/en/library/bg/2/47/',
      chunk_text:
        "Your right is to work only, but never to its fruits; let not the fruits of action be your motive, nor let your attachment be to inaction.",
      similarity_score: 0.95,
    },
    {
      id: '124',
      verse_id: '457',
      book: 'Bhagavad-gita',
      canto: null,
      chapter: 18,
      verse: 66,
      vedabase_url: 'https://vedabase.io/en/library/bg/18/66/',
      chunk_text:
        'Abandon all varieties of religion and just surrender unto Me. I shall deliver you from all sinful reactions. Do not fear.',
      similarity_score: 0.88,
    },
  ]

  const userMessage = 'How can I deal with anxiety about the future?'
  const concepts = ['fear', 'equanimity', 'duty']

  console.log('Generating response...\n')

  try {
    const response = await generateResponse(userMessage, concepts, verses, false)

    console.log('✓ Response generated successfully\n')
    console.log('Message:')
    console.log(response.message)
    console.log('\nCitations:')
    response.citations.forEach((c, i) => {
      console.log(`${i + 1}. [${c.ref}]`)
      console.log(`   "${c.excerpt}"`)
      console.log(`   ${c.url}`)
    })
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

test()
