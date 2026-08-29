import { NextRequest } from 'next/server'
import { z } from 'zod'
import { classifySafety } from '@/lib/ai/safety'
import { transformQuery } from '@/lib/ai/query-transform'
import { retrieveVerses } from '@/lib/ai/retrieval'
import { generateAndVerify } from '@/lib/ai/verification'

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

interface StreamMessage {
  type: 'message' | 'citations' | 'error' | 'done'
  data?: any
}

function streamJSON(messages: StreamMessage[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let messageIndex = 0

  return new ReadableStream({
    async start(controller) {
      try {
        for (const msg of messages) {
          const json = JSON.stringify(msg) + '\n'
          controller.enqueue(encoder.encode(json))
          // Small delay to allow client to process
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
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

    // STEP 3: SAFE/SENSITIVE - Full RAG pipeline
    const isSensitive = safety.classification === 'sensitive'

    try {
      // Step 3a: Query transformation
      const transformation = await transformQuery(message, isSensitive)

      // Step 3b: Retrieval
      const retrievedVerses = await retrieveVerses(transformation.search_queries, 12)

      // Step 3c: Generation + Verification
      const { response, verification } = await generateAndVerify(
        message,
        transformation.vedic_concepts,
        retrievedVerses,
        isSensitive,
        1, // 1 retry if fabrication detected
      )

      // Build streaming response
      const streamMessages: StreamMessage[] = [
        {
          type: 'message',
          data: {
            content: response.message,
            citations: response.citations,
          },
        },
        {
          type: 'done',
          data: {
            verified: verification.isValid,
            groundedCitations: verification.groundedCitations,
          },
        },
      ]

      return new Response(streamJSON(streamMessages), {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Safety-Flag': safety.classification,
          'X-Grounded': verification.isValid ? 'true' : 'false',
        },
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('RAG pipeline error:', errorMsg)

      const streamMessages: StreamMessage[] = [
        {
          type: 'error',
          data: {
            message:
              'I encountered an issue retrieving relevant teachings. Could you rephrase your question or provide more context? This helps me find the most relevant guidance for your situation.',
            error: errorMsg,
          },
        },
      ]

      return new Response(streamJSON(streamMessages), {
        status: 200,
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'X-Safety-Flag': safety.classification,
          'X-Error': 'true',
        },
      })
    }
  } catch (error) {
    console.error('Chat error:', error)
    return new Response(
      JSON.stringify({
        type: 'error',
        data: {
          message: 'Failed to process chat message',
          error: error instanceof Error ? error.message : String(error),
        },
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
