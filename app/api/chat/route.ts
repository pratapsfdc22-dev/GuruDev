import { NextRequest } from 'next/server'
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

const placeholderText =
  'Guru Dev pipeline not yet connected. Phase 3 will implement the full RAG pipeline with safety classification, query transformation, retrieval, generation, and verification.'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    ChatRequestSchema.parse(body)

    const encoder = new TextEncoder()

    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < placeholderText.length; i++) {
            const char = placeholderText[i]
            controller.enqueue(encoder.encode(char))
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response('Failed to process chat message', {
      status: 400,
    })
  }
}
