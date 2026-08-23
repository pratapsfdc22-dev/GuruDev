import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const ChatRequestSchema = z.object({
  message: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    }),
  ),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { message } = ChatRequestSchema.parse(body)

    const placeholderResponse = {
      message:
        'Phase 1 scaffold complete. Chat pipeline will be implemented in Phase 3.',
      citations: [],
    }

    return NextResponse.json(placeholderResponse)
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 400 },
    )
  }
}
