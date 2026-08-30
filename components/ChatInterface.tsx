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
    <div className="flex flex-col h-full w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingContent && (
          <div className="text-center py-16 space-y-4">
            <div className="space-y-2">
              <p className="text-slate-100 text-lg font-serif">Welcome to Guru Dev</p>
              <p className="text-slate-400 text-sm">
                Ask any question about stress, purpose, relationships, work, or daily life
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-2xl p-4 rounded-lg break-words ${
                msg.role === 'user'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-slate-800 text-slate-50'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Citation cards */}
              {msg.cited_verses && msg.cited_verses.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700 space-y-3">
                  <p className="text-xs font-semibold text-slate-400">📚 Sources</p>
                  {msg.cited_verses.map((cite, cIdx) => (
                    <div
                      key={cIdx}
                      className="p-3 bg-slate-700 rounded border border-slate-600 hover:border-yellow-500 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-slate-100">
                            {cite.ref}
                          </p>
                          <p className="text-xs text-slate-300 mt-1 italic">
                            "{cite.excerpt}"
                          </p>
                        </div>
                        <a
                          href={cite.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 px-3 py-1 text-xs font-medium text-yellow-400 hover:text-yellow-300 bg-yellow-900/30 rounded hover:bg-yellow-900/50 transition"
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
            <div className="max-w-2xl p-4 rounded-lg bg-slate-800 text-slate-50 break-words">
              <p className="whitespace-pre-wrap">{streamingContent}</p>

              {streamingCitations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700 space-y-3">
                  <p className="text-xs font-semibold text-slate-400">📚 Sources</p>
                  {streamingCitations.map((cite, cIdx) => (
                    <div
                      key={cIdx}
                      className="p-3 bg-slate-700 rounded border border-slate-600"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-slate-100">
                            {cite.ref}
                          </p>
                          <p className="text-xs text-slate-300 mt-1 italic">
                            "{cite.excerpt}"
                          </p>
                        </div>
                        <a
                          href={cite.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 px-3 py-1 text-xs font-medium text-yellow-400 bg-yellow-900/30 rounded"
                        >
                          Read →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <span className="inline-block w-2 h-5 bg-slate-600 ml-1 animate-pulse" />
            </div>
          </div>
        )}

        {isLoading && !streamingContent && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-4 rounded-lg animate-pulse">
              <p className="text-slate-400">Guru Dev is thinking...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-slate-800 bg-slate-900"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your question..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:opacity-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg hover:shadow-yellow-600/50"
          >
            {isLoading ? 'Streaming...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
