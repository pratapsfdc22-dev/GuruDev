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

const SafetyClassificationSchema = z.object({
  classification: z.enum(['safe', 'sensitive', 'crisis']),
  reasoning: z.string(),
})

export type SafetyClassification = z.infer<typeof SafetyClassificationSchema>

const SAFETY_SYSTEM_PROMPT = `You are a safety classifier for a spiritual guidance app. Your job is to categorize incoming user messages into one of three categories:

1. **safe**: Routine questions about life, work, relationships, purpose, stress, habits, daily reflection. No distress signals. Examples: "How do I find meaning in my work?", "What should I do when I disagree with my boss?"

2. **sensitive**: Messages showing distress, worry, depression, hopelessness, or emotional pain, but no explicit crisis language. The user is struggling but not in immediate danger. Examples: "I feel so hopeless lately", "I can't cope with this anymore", "Everything feels meaningless"

3. **crisis**: Messages showing immediate risk of self-harm, suicide ideation, intent to harm others, or acute severe distress. Explicit mentions of suicide, self-injury, overdose, or statements like "I'm going to kill myself" or "I can't go on". Also includes messages from someone in severe panic, acute psychosis, or uncontrolled rage.

**Conservative bias**: When uncertain between categories, prefer the more cautious one:
- Uncertain between safe and sensitive → choose sensitive
- Uncertain between sensitive and crisis → choose crisis

Respond with a JSON object: {"classification": "safe"|"sensitive"|"crisis", "reasoning": "..."}`

export async function classifySafety(message: string): Promise<SafetyClassification> {
  const c = getClient()
  const response = await c.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: SAFETY_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: message,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    let jsonStr = text
    if (text.includes('```json')) {
      jsonStr = text.split('```json')[1].split('```')[0].trim()
    } else if (text.includes('```')) {
      jsonStr = text.split('```')[1].split('```')[0].trim()
    }
    const parsed = JSON.parse(jsonStr)
    return SafetyClassificationSchema.parse(parsed)
  } catch (error) {
    throw new Error(`Failed to parse safety classification response: ${text}`)
  }
}

export { SAFETY_SYSTEM_PROMPT }
