import Anthropic from '@anthropic-ai/sdk'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set')
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const MODEL_SAFETY_CLASSIFIER = 'claude-haiku-4-5-20251001'
export const MODEL_QUERY_TRANSFORM = 'claude-haiku-4-5-20251001'
export const MODEL_GENERATION = 'claude-sonnet-4-6-20250514'
