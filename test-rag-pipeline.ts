import * as fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf-8')
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

import { transformQuery } from './lib/ai/query-transform'
import { retrieveVerses } from './lib/ai/retrieval'
import { generateResponse } from './lib/ai/generation'

async function testRAGPipeline(): Promise<void> {
  console.log('='.repeat(80))
  console.log('TESTING RAG PIPELINE: Query Transformation → Retrieval → Generation')
  console.log('='.repeat(80))

  const testQueries = [
    'How can I deal with anxiety and fear about the future?',
    'What does it mean to let go of attachments?',
  ]

  for (const userMessage of testQueries) {
    console.log('\n' + '='.repeat(80))
    console.log(`USER: "${userMessage}"`)
    console.log('='.repeat(80))

    try {
      // Step 1: Query transformation
      console.log('\n[Step 1] Transforming query...')
      const transformation = await transformQuery(userMessage, false)
      console.log(`✓ Vedic concepts: ${transformation.vedic_concepts.join(', ')}`)
      console.log(`✓ Search queries: ${transformation.search_queries.join(' | ')}`)

      // Step 2: Retrieval
      console.log('\n[Step 2] Retrieving verses...')
      const verses = await retrieveVerses(transformation.search_queries, 6)
      console.log(`✓ Retrieved ${verses.length} verses:`)
      verses.forEach((v, i) => {
        const ref = `${v.book === 'Bhagavad-gita' ? 'Bg' : v.book === 'Srimad-Bhagavatam' ? 'SB' : 'Cc'} ${v.chapter}.${v.verse}`
        console.log(`  ${i + 1}. ${ref} - "${v.chunk_text.substring(0, 60)}..."`)
      })

      if (verses.length === 0) {
        console.log('  ⚠️ No verses retrieved - generation may fail')
      }

      // Step 3: Generation
      console.log('\n[Step 3] Generating response...')
      const response = await generateResponse(
        userMessage,
        transformation.vedic_concepts,
        verses,
        false,
      )

      console.log('\n📝 GURU DEV RESPONSE:')
      console.log('-'.repeat(80))
      console.log(response.message)
      console.log('-'.repeat(80))

      console.log('\n📚 CITATIONS:')
      if (response.citations.length === 0) {
        console.log('  (No citations)')
      } else {
        response.citations.forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.ref}`)
          console.log(`     "${c.excerpt}"`)
          console.log(`     ${c.url}`)
        })
      }

      console.log('\n✓ Pipeline successful for this query')
    } catch (error) {
      console.error(
        `\n✗ Pipeline error: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('RAG PIPELINE TEST COMPLETE')
  console.log('='.repeat(80) + '\n')
  process.exit(0)
}

testRAGPipeline().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
