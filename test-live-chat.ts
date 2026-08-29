import * as fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf-8')
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

// Import all pipeline functions directly (simulating what the route does)
import { classifySafety } from './lib/ai/safety'
import { transformQuery } from './lib/ai/query-transform'
import { retrieveVerses } from './lib/ai/retrieval'
import { generateAndVerify } from './lib/ai/verification'

async function testLiveChat(): Promise<void> {
  const userMessage = 'How do I find meaning in my work?'

  console.log('================================================================================')
  console.log('LIVE CHAT TEST - END-TO-END THROUGH ACTUAL PIPELINE')
  console.log('================================================================================')
  console.log()
  console.log('USER INPUT:')
  console.log(`"${userMessage}"`)
  console.log()

  try {
    // Step 1: Safety classification
    console.log('[Step 1] Classifying safety...')
    const safety = await classifySafety(userMessage)
    console.log(`Classification: ${safety.classification}`)
    console.log()

    // Step 2: Query transformation
    console.log('[Step 2] Transforming query...')
    const transformation = await transformQuery(userMessage, safety.classification === 'sensitive')
    console.log(`Vedic concepts: ${transformation.vedic_concepts.join(', ')}`)
    console.log(`Search queries: ${transformation.search_queries.join(' | ')}`)
    console.log()

    // Step 3: Retrieval
    console.log('[Step 3] Retrieving verses...')
    const retrievedVerses = await retrieveVerses(transformation.search_queries, 12)
    console.log(`Retrieved ${retrievedVerses.length} verses`)
    console.log()

    // Step 4: Generation + Verification
    console.log('[Step 4] Generating response with verification...')
    const { response, verification } = await generateAndVerify(
      userMessage,
      transformation.vedic_concepts,
      retrievedVerses,
      safety.classification === 'sensitive',
      1,
    )

    console.log(`Verification: ${verification.isValid ? 'PASS' : 'FAIL'}`)
    console.log(`Grounded citations: ${verification.groundedCitations.join(', ')}`)
    console.log()

    // ============================================================================
    // RAW API RESPONSE (NDJSON format)
    // ============================================================================
    console.log('================================================================================')
    console.log('RAW API RESPONSE (NDJSON format as sent from /api/chat)')
    console.log('================================================================================')
    console.log()

    const messageLine = JSON.stringify({
      type: 'message',
      data: {
        content: response.message,
        citations: response.citations,
      },
    })

    const doneLine = JSON.stringify({
      type: 'done',
      data: {
        verified: verification.isValid,
        groundedCitations: verification.groundedCitations,
      },
    })

    console.log(messageLine)
    console.log(doneLine)
    console.log()

    // ============================================================================
    // RENDERED UI OUTPUT (as ChatInterface would display it)
    // ============================================================================
    console.log('================================================================================')
    console.log('RENDERED UI OUTPUT (as ChatInterface would display)')
    console.log('================================================================================')
    console.log()

    console.log('USER MESSAGE:')
    console.log(`> ${userMessage}`)
    console.log()

    console.log('GURU DEV RESPONSE:')
    console.log('-'.repeat(80))
    console.log(response.message)
    console.log('-'.repeat(80))
    console.log()

    console.log('CITATION CARDS:')
    console.log()
    response.citations.forEach((citation, idx) => {
      console.log(`[Citation ${idx + 1}]`)
      console.log(`Reference: ${citation.ref}`)
      console.log(`Excerpt: "${citation.excerpt}"`)
      console.log(`URL: ${citation.url}`)
      console.log()
    })

    console.log('================================================================================')
    console.log('✓ LIVE CHAT TEST COMPLETE')
    console.log('================================================================================')
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

testLiveChat()
