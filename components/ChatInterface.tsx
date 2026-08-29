'use client'

import { useState, useRef, useEffect } from 'react'
import type { Message } from '@/types'

interface Citation {
  ref: string
  url: string
  excerpt: string
}

interface ChatResponse {
  type: 'message' | 'citations' | 'error' | 'done'
  data?: {
    content?: string
    citations?: Citation[]
    message?: string
    error?: string
    verified?: boolean
    groundedCitations?: string[]
  }
}

export function ChatInterface(): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, streamingCitations])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setStreamingContent('')
    setStreamingCitations([])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, messages: [...messages, userMessage] }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedContent = ''
      let citations: Citation[] = []
      let hasError = false
      let errorMessage = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        // Process complete NDJSON lines
        const lines = buffer.split('\n')
        buffer = lines[lines.length - 1] // Keep incomplete line in buffer

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim()
          if (!line) continue

          try {
            const parsed: ChatResponse = JSON.parse(line)

            if (parsed.type === 'message' && parsed.data?.content) {
              accumulatedContent = parsed.data.content
              setStreamingContent(accumulatedContent)

              if (parsed.data.citations) {
                citations = parsed.data.citations
                setStreamingCitations(citations)
              }
            } else if (parsed.type === 'error' && parsed.data?.message) {
              hasError = true
              errorMessage = parsed.data.message
              setStreamingContent(errorMessage)
            } else if (parsed.type === 'done') {
              // Response complete
            }
          } catch (e) {
            console.error('Error parsing NDJSON line:', line, e)
          }
        }
      }

      // Add assistant message to history
      if (!hasError) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: accumulatedContent,
          cited_verses: citations,
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        const assistantMessage: Message = {
          role: 'assistant',
          content: errorMessage || 'Error: Failed to generate response',
        }
        setMessages((prev) => [...prev, assistantMessage])
      }

      setStreamingContent('')
      setStreamingCitations([])
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response from Guru Dev'}`,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingContent && (
          <div className="text-center text-gray-500 py-8">
            <p>Start a conversation with Guru Dev</p>
            <p className="text-xs mt-2 text-gray-400">
              Ask any question about stress, purpose, relationships, work, or daily life
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-2xl p-4 rounded-lg break-words ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-50'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Citation cards */}
              {msg.cited_verses && msg.cited_verses.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-300 dark:border-gray-600 space-y-3">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">📚 Sources</p>
                  {msg.cited_verses.map((cite, cIdx) => (
                    <div
                      key={cIdx}
                      className="p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                            {cite.ref}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                            "{cite.excerpt}"
                          </p>
                        </div>
                        <a
                          href={cite.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                        >
                          Read →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-2xl p-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-50 break-words">
              <p className="whitespace-pre-wrap">{streamingContent}</p>

              {streamingCitations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-300 dark:border-gray-600 space-y-3">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">📚 Sources</p>
                  {streamingCitations.map((cite, cIdx) => (
                    <div
                      key={cIdx}
                      className="p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                            {cite.ref}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                            "{cite.excerpt}"
                          </p>
                        </div>
                        <a
                          href={cite.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded"
                        >
                          Read →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <span className="inline-block w-2 h-5 bg-gray-500 ml-1 animate-pulse" />
            </div>
          </div>
        )}

        {isLoading && !streamingContent && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg animate-pulse">
              <p className="text-gray-600 dark:text-gray-400">Guru Dev is thinking...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your question..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Streaming...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
