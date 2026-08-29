import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return client
}

const QueryTransformSchema = z.object({
  vedic_concepts: z.array(z.string()).describe('Core Vedic concepts related to the life problem'),
  search_queries: z.array(z.string()).describe('Search queries optimized for verse retrieval'),
  relevant_books: z.array(z.enum(['Bhagavad-gita', 'Srimad-Bhagavatam', 'Caitanya-caritamrita', 'Sri Caitanya-caritamrita'])).optional().describe('Specific texts most relevant to this query'),
})

export type QueryTransformation = z.infer<typeof QueryTransformSchema>

const QUERY_TRANSFORM_SYSTEM_PROMPT = `You are a Vedic knowledge mapper for a spiritual guidance system. Your job is to analyze a user's real-life problem and:

1. Identify core Vedic concepts that directly address their situation
2. Generate optimized search queries for retrieving relevant verses from the Bhagavad-gita, Srimad-Bhagavatam, and Sri Caitanya-caritamrita
3. Suggest which texts are most relevant (if clear)

Guidelines:
- Map life problems to Vedic philosophical principles (duty/dharma, detachment, service, surrender, karma, etc.)
- Generate 3-5 concise search queries that will effectively retrieve relevant verses
- Search queries should be specific enough to retrieve relevant content but broad enough to catch similar verses
- Consider the user's emotional state (from safety classification if available)
- Be inclusive: a problem can have multiple valid interpretations

Examples:
- "I'm anxious about losing my job" → concepts: ["fear", "attachment", "duty without attachment to results", "equanimity"] → queries: ["fear and anxiety", "duty work without attachment", "equanimity in loss"]
- "How do I find meaning in my relationships?" → concepts: ["service", "love", "relationships", "interdependence"] → queries: ["relationships and love", "service to others", "meaning in connection"]
- "I feel depressed and hopeless" → concepts: ["despair", "faith", "purpose", "transformation"] → queries: ["overcoming despair", "finding purpose", "spiritual transformation"]

IMPORTANT: Respond ONLY with a JSON object in this format, with NO additional text before or after:
{"vedic_concepts": ["concept1", "concept2"], "search_queries": ["query1", "query2"], "relevant_books": ["Bhagavad-gita"]}`

const SENSITIVE_ADDITION =
  '\n\nIMPORTANT: This user is showing signs of emotional distress. Please prioritize concepts and verses that emphasize hope, support, and interconnection. Include concepts related to transformation, resilience, and divine care.'

export async function transformQuery(
  message: string,
  isSensitive: boolean = false,
): Promise<QueryTransformation> {
  const systemPrompt =
    QUERY_TRANSFORM_SYSTEM_PROMPT + (isSensitive ? SENSITIVE_ADDITION : '')

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: message,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    let jsonStr = text.trim()

    // Try to extract from markdown code blocks
    let match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      jsonStr = match[1].trim()
    }

    // Find JSON object: first { to last }
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error(`No valid JSON object found in response`)
    }

    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)

    const parsed = JSON.parse(jsonStr)
    return QueryTransformSchema.parse(parsed)
  } catch (error) {
    throw new Error(`Failed to parse query transformation response: ${text}`)
  }
}
