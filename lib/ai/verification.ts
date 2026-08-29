import { GenerationResponse, generateResponse, GenerationResponseSchema } from './generation'
import { RetrievedVerse, formatVerseRef } from './retrieval'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

export const VerificationResultSchema = z.object({
  isValid: z.boolean(),
  fabricatedCitations: z.array(z.string()),
  groundedCitations: z.array(z.string()),
})

export type VerificationResult = z.infer<typeof VerificationResultSchema>

export function verifyResponse(
  response: GenerationResponse,
  retrievedVerses: RetrievedVerse[],
): VerificationResult {
  const retrievedRefs = new Set(retrievedVerses.map(v => formatVerseRef(v)))

  const fabricatedCitations: string[] = []
  const groundedCitations: string[] = []

  for (const citation of response.citations) {
    if (retrievedRefs.has(citation.ref)) {
      groundedCitations.push(citation.ref)
    } else {
      fabricatedCitations.push(citation.ref)
    }
  }

  return {
    isValid: fabricatedCitations.length === 0,
    fabricatedCitations,
    groundedCitations,
  }
}

const STRICT_GENERATION_SYSTEM_PROMPT = `You are Guru Dev, a spiritual wisdom guide. You MUST follow these rules absolutely:

CRITICAL GROUNDING RULES:
1. ONLY cite verses from the provided retrieval set. Do NOT cite any verses outside this set.
2. Every citation MUST be a verse reference (e.g., "Bg. 2.47", "SB 1.15") that appears in the retrieval context.
3. If you cite a verse ref that is NOT in the provided list, your response FAILS.
4. If no verses are relevant, say so honestly. Do NOT fabricate or cite verses.
5. Excerpt MUST be a single contiguous span of text from the source — no internal ellipsis (...) joining non-adjacent parts. Pick contiguous phrases only, even if shorter than 15 words.

OUTPUT FORMAT (MUST be valid JSON, nothing else):
{
  "message": "Your response citing only retrieved verses",
  "citations": [
    {"ref": "Bg. 2.47", "url": "https://vedabase.io/en/library/bg/2/47/", "excerpt": "quote <15 words"}
  ]
}

TONE: Compassionate, grounded, clear. Universal wisdom framing only.`

export async function generateAndVerify(
  userMessage: string,
  vedicConcepts: string[],
  retrievedVerses: RetrievedVerse[],
  isSensitive: boolean = false,
  maxRetries: number = 1,
): Promise<{ response: GenerationResponse; verification: VerificationResult }> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let response: GenerationResponse

      if (attempt === 0) {
        // First attempt: normal generation
        response = await generateResponse(userMessage, vedicConcepts, retrievedVerses, isSensitive)
      } else {
        // Retry: use strict prompt that emphasizes not fabricating citations
        response = await generateResponseStrict(
          userMessage,
          vedicConcepts,
          retrievedVerses,
          isSensitive,
        )
      }

      const verification = verifyResponse(response, retrievedVerses)

      if (verification.isValid) {
        return { response, verification }
      }

      lastError = new Error(
        `Invalid citations detected: ${verification.fabricatedCitations.join(', ')}`,
      )

      // Continue to next attempt/retry
      console.warn(
        `[Attempt ${attempt + 1}] Fabricated citations found: ${verification.fabricatedCitations.join(', ')}. Retrying...`,
      )
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[Attempt ${attempt + 1}] Generation error: ${lastError.message}`)
    }
  }

  throw new Error(
    `Verification failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message}`,
  )
}

let strictClient: Anthropic | null = null

function getStrictClient(): Anthropic {
  if (!strictClient) {
    strictClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return strictClient
}

async function generateResponseStrict(
  userMessage: string,
  vedicConcepts: string[],
  retrievedVerses: RetrievedVerse[],
  isSensitive: boolean = false,
): Promise<GenerationResponse> {
  function getClient(): Anthropic {
    return getStrictClient()
  }

  const versesContext = retrievedVerses
    .map(v => {
      const { formatVerseRef: fmt } = require('./retrieval')
      const ref = fmt(v)
      return `[${ref}] (${v.vedabase_url})\n${v.chunk_text}`
    })
    .join('\n\n---\n\n')

  const userPrompt = `User: "${userMessage}"

Vedic concepts: ${vedicConcepts.join(', ')}

ALLOWED verses to cite (ONLY these):
${retrievedVerses.map(v => `- ${formatVerseRef(v)}: ${v.vedabase_url}`).join('\n')}

Verse texts:
${versesContext || '(No verses available)'}

Generate a grounded response. ONLY cite verses from the ALLOWED list above. If a verse is not in the list, do NOT cite it.`

  const response = await getClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2048,
    system: STRICT_GENERATION_SYSTEM_PROMPT + (isSensitive ? '\n\nNote: User is experiencing distress. Emphasize hope and resilience.' : ''),
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

    let match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      jsonStr = match[1].trim()
    }

    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error(`No JSON found: ${text.substring(0, 100)}`)
    }

    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
    const parsed = JSON.parse(jsonStr)
    return GenerationResponseSchema.parse(parsed)
  } catch (error) {
    throw new Error(`Failed to parse strict generation: ${error instanceof Error ? error.message : String(error)}`)
  }
}
