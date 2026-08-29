import * as fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf-8')
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

import { transformQuery } from './query-transform'

interface TestCase {
  name: string
  message: string
  isSensitive: boolean
  expectedConceptKeywords: string[]
}

const testCases: TestCase[] = [
  {
    name: 'Work purpose',
    message: 'How do I find meaning and purpose in my work?',
    isSensitive: false,
    expectedConceptKeywords: ['meaning', 'purpose', 'duty', 'work'],
  },
  {
    name: 'Job anxiety',
    message: 'I am anxious about the possibility of losing my job',
    isSensitive: false,
    expectedConceptKeywords: ['fear', 'anxiety', 'attachment', 'loss'],
  },
  {
    name: 'Relationship conflict',
    message: 'How should I handle conflict in my relationships?',
    isSensitive: false,
    expectedConceptKeywords: ['conflict', 'relationships', 'communication'],
  },
  {
    name: 'Finding detachment',
    message: 'What does it mean to let go of attachments?',
    isSensitive: false,
    expectedConceptKeywords: ['attachment', 'detachment', 'letting go'],
  },
  {
    name: 'Depression (sensitive)',
    message: 'I have been feeling depressed and cannot find joy in anything',
    isSensitive: true,
    expectedConceptKeywords: ['depression', 'despair', 'purpose', 'hope', 'resilience'],
  },
]

async function runTests(): Promise<void> {
  console.log('='.repeat(80))
  console.log('QUERY TRANSFORMATION TEST SUITE')
  console.log('='.repeat(80))
  console.log()

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    try {
      console.log(`Testing: ${testCase.name}`)
      console.log(`Message: "${testCase.message}"`)
      console.log(`Sensitive: ${testCase.isSensitive}`)

      const result = await transformQuery(testCase.message, testCase.isSensitive)

      console.log(`\nVedic Concepts: ${result.vedic_concepts.join(', ')}`)
      console.log(`Search Queries: ${result.search_queries.join(' | ')}`)
      if (result.relevant_books) {
        console.log(`Relevant Books: ${result.relevant_books.join(', ')}`)
      }

      // Check if expected keywords appear in concepts or queries
      const allText = [
        ...result.vedic_concepts,
        ...result.search_queries,
        ...(result.relevant_books || []),
      ]
        .join(' ')
        .toLowerCase()

      const foundKeywords = testCase.expectedConceptKeywords.filter(kw =>
        allText.includes(kw.toLowerCase()),
      )

      if (foundKeywords.length >= Math.ceil(testCase.expectedConceptKeywords.length * 0.6)) {
        console.log(`✓ PASS: Found ${foundKeywords.length}/${testCase.expectedConceptKeywords.length} expected keywords`)
        passed++
      } else {
        console.log(
          `✗ FAIL: Only found ${foundKeywords.length}/${testCase.expectedConceptKeywords.length} expected keywords`,
        )
        console.log(`  Expected at least one of: ${testCase.expectedConceptKeywords.join(', ')}`)
        console.log(`  Found: ${foundKeywords.join(', ')}`)
        failed++
      }

      // Check array properties
      if (result.vedic_concepts.length === 0 || result.search_queries.length === 0) {
        console.log(`✗ FAIL: Missing vedic_concepts or search_queries`)
        failed++
      } else {
        console.log(`✓ PASS: Arrays populated correctly`)
        passed++
      }

      console.log()
    } catch (error) {
      console.log(`✗ ERROR: ${error instanceof Error ? error.message : String(error)}`)
      failed++
      console.log()
    }
  }

  console.log('='.repeat(80))
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${testCases.length * 2} checks`)
  console.log('='.repeat(80))

  process.exit(failed > 0 ? 1 : 0)
}

runTests()
