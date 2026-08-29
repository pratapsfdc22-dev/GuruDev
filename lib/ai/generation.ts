import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { RetrievedVerse, formatVerseRef } from './retrieval'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return client
}

export const CitationSchema = z.object({
  ref: z.string().describe('Verse reference e.g. "Bg. 2.47"'),
  url: z.string().url().describe('Full vedabase.io URL'),
  excerpt: z.string().describe('Quote excerpt from verse/purport, <15 words'),
})

export const GenerationResponseSchema = z.object({
  message: z.string().describe('Guru Dev response grounded in retrieved verses'),
  citations: z
    .array(CitationSchema)
    .describe('Structured citations from retrieved verses, only those actually cited in message'),
})

// Re-export for use in other modules
export { GenerationResponseSchema as GenerationResponseSchemaExport }

export type Citation = z.infer<typeof CitationSchema>
export type GenerationResponse = z.infer<typeof GenerationResponseSchema>

const GENERATION_SYSTEM_PROMPT = `You are Guru Dev, a spiritual wisdom guide who answers life questions using Vedic scriptures.

CORE RULES (non-negotiable):
1. CITE VERSES: Every substantive answer must cite specific verses by reference (e.g., "Bg. 2.47", "SB 1.2.6"). Include the vedabase.io URL for each verse.
2. NO FABRICATION: If retrieval returns nothing relevant, say so honestly and ask a clarifying question. Never invent verses, translations, or teachings.
3. SHORT EXCERPTS: Display only <15-word quotes from any verse/purport. Always link to vedabase.io for the full text. (Copyright © Bhaktivedanta Book Trust.) Excerpts MUST be a single contiguous span of text from the source — no internal ellipsis (...) joining non-adjacent parts. If the best quote is not contiguous, pick a different contiguous phrase instead, even if shorter.
4. UNIVERSAL FRAMING: Present teachings as universal wisdom transcending religion. Never proselytize or ask users to adopt practices. Show HOW the verse applies to their situation.
5. GROUNDING: All citations MUST come from the retrieved verses provided. Never cite verses outside the retrieval set.

TONE:
- Compassionate, non-judgmental, deeply thoughtful
- Respectful of the user's struggle
- Clear connection between ancient wisdom and modern life
- Never diagnostic or clinical

CRITICAL: You MUST respond with ONLY valid JSON. No markdown, no explanation, just JSON.
Format:
{
  "message": "Your thoughtful response with citations marked as [Ref] when citing.",
  "citations": [
    {"ref": "Bg. 2.47", "url": "https://vedabase.io/...", "excerpt": "exact quote <15 words"},
    {"ref": "SB 1.15", "url": "https://vedabase.io/...", "excerpt": "exact quote <15 words"}
  ]
}

Only include citations actually mentioned in the message. No other text before or after JSON.`

const SENSITIVE_ADDITION = `\n\nIMPORTANT: This user is experiencing distress. Prioritize verses and teachings that emphasize resilience, hope, divine care, and transformation. Frame guidance with extra compassion and care.`

export async function generateResponse(
  userMessage: string,
  vedasicConcepts: string[],
  retrievedVerses: RetrievedVerse[],
  isSensitive: boolean = false,
): Promise<GenerationResponse> {
  const systemPrompt =
    GENERATION_SYSTEM_PROMPT + (isSensitive ? SENSITIVE_ADDITION : '')

  const versesContext = retrievedVerses
    .map(v => {
      const ref = formatVerseRef(v)
      return `[${ref}] (${v.vedabase_url})\n${v.chunk_text}`
    })
    .join('\n\n---\n\n')

  const userPrompt = `User question: "${userMessage}"

Vedic concepts to emphasize: ${vedasicConcepts.join(', ')}

Retrieved verses to draw from:
${versesContext || '(No relevant verses found)'}

Provide a compassionate, grounded response. Only cite verses from the retrieved set above. If no verses are relevant, acknowledge this and ask a clarifying question.`

  const response = await getClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    let jsonStr = text.trim()

    // Extract from markdown code blocks if present
    let match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      jsonStr = match[1].trim()
    }

    // Find JSON object: first { to last }
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error(`No JSON object found in response: ${text.substring(0, 200)}`)
    }

    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)

    let parsed: any
    try {
      parsed = JSON.parse(jsonStr)
    } catch (e) {
      throw new Error(`Invalid JSON: ${jsonStr.substring(0, 200)}`)
    }

    const validated = GenerationResponseSchema.parse(parsed)

    // Verify all citations are from retrieved verses
    const retrievedRefs = new Set(retrievedVerses.map(v => formatVerseRef(v)))

    const invalidCitations = validated.citations.filter(c => !retrievedRefs.has(c.ref))
    if (invalidCitations.length > 0) {
      console.warn(
        `Warning: Response cited verses not in retrieval set: ${invalidCitations.map(c => c.ref).join(', ')}`,
      )
      // Filter out invalid citations
      validated.citations = validated.citations.filter(c => retrievedRefs.has(c.ref))
    }

    return validated
  } catch (error) {
    throw new Error(`Failed to parse generation response: ${error instanceof Error ? error.message : String(error)}`)
  }
}
