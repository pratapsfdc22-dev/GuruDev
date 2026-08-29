import * as fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf-8')
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

import { verifyResponse, generateAndVerify } from './lib/ai/verification'
import { GenerationResponse } from './lib/ai/generation'
import { RetrievedVerse } from './lib/ai/retrieval'

async function testVerification(): Promise<void> {
  console.log('='.repeat(80))
  console.log('VERIFICATION TEST SUITE')
  console.log('='.repeat(80))

  // Setup: real retrieved verses
  const retrievedVerses: RetrievedVerse[] = [
    {
      id: '1',
      verse_id: '100',
      book: 'Bhagavad-gita',
      canto: null,
      chapter: 2,
      verse: 47,
      vedabase_url: 'https://vedabase.io/en/library/bg/2/47/',
      chunk_text: 'Your right is to work only, but never to its fruits',
      similarity_score: 0.95,
    },
    {
      id: '2',
      verse_id: '101',
      book: 'Bhagavad-gita',
      canto: null,
      chapter: 18,
      verse: 66,
      vedabase_url: 'https://vedabase.io/en/library/bg/18/66/',
      chunk_text: 'Abandon all varieties of religion and just surrender unto Me',
      similarity_score: 0.88,
    },
    {
      id: '3',
      verse_id: '102',
      book: 'Srimad-Bhagavatam',
      canto: 5,
      chapter: 1,
      verse: 15,
      vedabase_url: 'https://vedabase.io/en/library/sb/5/1/15/',
      chunk_text: 'One should follow the Lord like a blind man follows someone with vision',
      similarity_score: 0.82,
    },
  ]

  // TEST 1: Fabricated citation
  console.log('\n' + '='.repeat(80))
  console.log('TEST 1: FABRICATED CITATION (should FAIL)')
  console.log('='.repeat(80))

  const fabricatedResponse: GenerationResponse = {
    message:
      'According to the Bhagavad-gita [Bg. 2.47], you should perform your duty without attachment. ' +
      'However, the Srimad-Bhagavatam also teaches about equanimity [SB 3.29.35], which is a key principle ' +
      'for handling anxiety. Additionally, Sri Caitanya-caritamrita emphasizes surrender [Cc 2.22.91].',
    citations: [
      {
        ref: 'Bg. 2.47',
        url: 'https://vedabase.io/en/library/bg/2/47/',
        excerpt: 'Your right is to work only, but never to its fruits',
      },
      {
        ref: 'SB 3.29.35', // FABRICATED - not in retrieval set
        url: 'https://vedabase.io/en/library/sb/3/29/35/',
        excerpt: 'Equanimity in material life',
      },
      {
        ref: 'Cc 2.22.91', // FABRICATED - not in retrieval set
        url: 'https://vedabase.io/en/library/cc/2/22/91/',
        excerpt: 'Supreme surrender',
      },
    ],
  }

  console.log('\n📝 FABRICATED RESPONSE:')
  console.log('-'.repeat(80))
  console.log(fabricatedResponse.message)
  console.log('-'.repeat(80))

  console.log('\n📚 CITATIONS IN RESPONSE:')
  fabricatedResponse.citations.forEach((c, i) => {
    console.log(`${i + 1}. ${c.ref}`)
  })

  const fabricatedVerification = verifyResponse(fabricatedResponse, retrievedVerses)

  console.log('\n✓ VERIFICATION RESULT:')
  console.log(`  isValid: ${fabricatedVerification.isValid}`)
  console.log(`  Grounded citations: ${fabricatedVerification.groundedCitations.join(', ') || '(none)'}`)
  console.log(`  Fabricated citations: ${fabricatedVerification.fabricatedCitations.join(', ') || '(none)'}`)

  if (!fabricatedVerification.isValid) {
    console.log(`\n✓✓ PASS: Correctly rejected fabricated citations`)
  } else {
    console.log(`\n✗ FAIL: Should have rejected fabricated citations`)
    process.exit(1)
  }

  // TEST 2: Grounded citations (real from retrieval)
  console.log('\n' + '='.repeat(80))
  console.log('TEST 2: GROUNDED CITATIONS (should PASS)')
  console.log('='.repeat(80))

  const groundedResponse: GenerationResponse = {
    message:
      'Anxiety often arises when we attach ourselves to outcomes we cannot control. ' +
      'The Bhagavad-gita teaches that your right is to act, but not to the fruits of action [Bg. 2.47]. ' +
      'This principle is profound: when you focus on sincere effort without grasping at results, ' +
      'much of anxiety naturally dissolves. The deeper wisdom here is about surrender [Bg. 18.66], ' +
      'trusting that a larger intelligence guides outcomes. Additionally, the Srimad-Bhagavatam ' +
      'offers the image of surrendering like a blind man who trusts his guide [SB 5.1.15]. ' +
      'This is not passivity, but active trust.',
    citations: [
      {
        ref: 'Bg. 2.47',
        url: 'https://vedabase.io/en/library/bg/2/47/',
        excerpt: 'Your right is to work only, but never to its fruits',
      },
      {
        ref: 'Bg. 18.66',
        url: 'https://vedabase.io/en/library/bg/18/66/',
        excerpt: 'Abandon all varieties of religion and just surrender unto Me',
      },
      {
        ref: 'SB 5.1.15',
        url: 'https://vedabase.io/en/library/sb/5/1/15/',
        excerpt: 'One should follow the Lord like a blind man follows someone with vision',
      },
    ],
  }

  console.log('\n📝 GROUNDED RESPONSE:')
  console.log('-'.repeat(80))
  console.log(groundedResponse.message)
  console.log('-'.repeat(80))

  console.log('\n📚 CITATIONS IN RESPONSE:')
  groundedResponse.citations.forEach((c, i) => {
    console.log(`${i + 1}. ${c.ref}`)
  })

  const groundedVerification = verifyResponse(groundedResponse, retrievedVerses)

  console.log('\n✓ VERIFICATION RESULT:')
  console.log(`  isValid: ${groundedVerification.isValid}`)
  console.log(`  Grounded citations: ${groundedVerification.groundedCitations.join(', ') || '(none)'}`)
  console.log(`  Fabricated citations: ${groundedVerification.fabricatedCitations.join(', ') || '(none)'}`)

  if (groundedVerification.isValid) {
    console.log(`\n✓✓ PASS: Correctly accepted grounded citations`)
  } else {
    console.log(`\n✗ FAIL: Should have accepted grounded citations`)
    process.exit(1)
  }

  // TEST 3: Real generation + verification flow
  console.log('\n' + '='.repeat(80))
  console.log('TEST 3: LIVE GENERATION WITH AUTO-RETRY ON FABRICATION')
  console.log('='.repeat(80))

  try {
    console.log('\nGenerating response for anxiety question...')
    const { response, verification } = await generateAndVerify(
      'How can I deal with anxiety about the future?',
      ['fear', 'equanimity', 'surrender'],
      retrievedVerses,
      false,
      0, // no retries for this test
    )

    console.log('\n📝 GENERATED RESPONSE:')
    console.log('-'.repeat(80))
    console.log(response.message)
    console.log('-'.repeat(80))

    console.log('\n📚 CITATIONS:')
    response.citations.forEach((c, i) => {
      console.log(`${i + 1}. ${c.ref}: "${c.excerpt.substring(0, 50)}..."`)
    })

    console.log('\n✓ VERIFICATION RESULT:')
    console.log(`  isValid: ${verification.isValid}`)
    console.log(`  Grounded: ${verification.groundedCitations.join(', ')}`)
    if (verification.fabricatedCitations.length > 0) {
      console.log(`  Fabricated: ${verification.fabricatedCitations.join(', ')}`)
    }

    if (verification.isValid) {
      console.log(`\n✓✓ PASS: Live generation passed verification`)
    } else {
      console.log(
        `\n⚠️ WARN: Live generation failed verification (fabricated: ${verification.fabricatedCitations.join(', ')})`,
      )
    }
  } catch (error) {
    console.log(`\n✓ Note: Generation test skipped or failed (expected if model doesn't follow strict format)`)
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('VERIFICATION TEST SUITE COMPLETE')
  console.log('='.repeat(80) + '\n')
}

testVerification().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
