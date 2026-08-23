import { z } from 'zod'

export const SafetyClassificationSchema = z.enum(['safe', 'sensitive', 'crisis'])
export type SafetyClassification = z.infer<typeof SafetyClassificationSchema>

export const CitationSchema = z.object({
  ref: z.string(),
  url: z.string().url(),
  excerpt: z.string(),
})
export type Citation = z.infer<typeof CitationSchema>

export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  cited_verses: z.array(CitationSchema).optional(),
})
export type Message = z.infer<typeof MessageSchema>
