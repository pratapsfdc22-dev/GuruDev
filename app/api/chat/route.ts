import { NextRequest } from 'next/server'
import { z } from 'zod'
import { classifySafety } from '@/lib/ai/safety'

const ChatRequestSchema = z.object({
  message: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    }),
  ),
})

const CRISIS_RESPONSE = `I hear that you're going through something very difficult right now. Your wellbeing matters deeply, and you don't have to face this alone.

Please reach out to someone who can help:

**National Suicide Prevention Lifeline (US)**
📞 Call or text 988 (available 24/7)
🌐 suicidepreventionlifeline.org

**Crisis Text Line (US)**
💬 Text "HOME" to 741741

**International Association for Suicide Prevention**
🌐 iasp.info/resources/Crisis_Centres/ (resources worldwide)

**If you're in immediate danger**, please:
- Call emergency services (911 in the US)
- Go to your nearest emergency room
- Tell someone you trust what you're going through

I'm not able to provide mental health support, but the trained counselors at these services are here for you. They can listen without judgment and help you find a path forward.

You deserve support and care. Please reach out today.`

const HELPLINE_REGION_MAP: Record<string, string> = {
  US: '📞 Call 988 or text 988',
  UK: '📞 Call 116 123 (Samaritans)',
  CA: '📞 Call 1-833-456-4566 (Canada Suicide Prevention Service)',
  AU: '📞 Call 13 11 14 (Lifeline Australia)',
  IN: '📞 Call +91-9152987821 (iCall)',
}

function streamText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        for (let i = 0; i < text.length; i++) {
          const char = text[i]
          controller.enqueue(encoder.encode(char))
          await new Promise((resolve) => setTimeout(resolve, 5))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    const { message, messages } = ChatRequestSchema.parse(body)

    // STEP 1: Safety classification (BEFORE anything else)
    const safety = await classifySafety(message)

    // STEP 2: CRISIS PATH - Completely isolated, cannot fall through
    if (safety.classification === 'crisis') {
      return new Response(streamText(CRISIS_RESPONSE), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Safety-Flag': 'crisis',
        },
      })
    }

    // STEP 3: SENSITIVE or SAFE - Proceed to RAG pipeline
    // TODO: Phase 3 - Implement full RAG pipeline
    // - Query transformation (Haiku)
    // - Retrieval (hybrid search)
    // - Generation (Sonnet) with safety flag
    // - Verification
    const placeholderText = `[Safety: ${safety.classification}] Guru Dev pipeline not yet connected. Phase 3 will implement query transformation, retrieval, generation, and verification.`

    return new Response(streamText(placeholderText), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Safety-Flag': safety.classification,
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response('Failed to process chat message', {
      status: 400,
    })
  }
}
