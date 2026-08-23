'use client'

import { useState, useRef, useEffect } from 'react'
import type { Message } from '@/types'

export function ChatInterface(): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

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
      let accumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulatedContent += chunk
        setStreamingContent(accumulatedContent)
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: accumulatedContent,
        cited_verses: [],
      }

      setMessages((prev) => [...prev, assistantMessage])
      setStreamingContent('')
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Error: Failed to get response from Guru Dev',
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
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl p-4 rounded-lg break-words ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-50'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.cited_verses && msg.cited_verses.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600 space-y-2">
                  {msg.cited_verses.map((cite, cIdx) => (
                    <a
                      key={cIdx}
                      href={cite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs underline opacity-80 hover:opacity-100"
                    >
                      {cite.ref}: "{cite.excerpt}"
                    </a>
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

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
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
