export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          display_name: string | null
          timezone: string | null
          checkin_time: string | null
          locale: string | null
          consent_personalization: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          display_name?: string | null
          timezone?: string | null
          checkin_time?: string | null
          locale?: string | null
          consent_personalization?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          timezone?: string | null
          checkin_time?: string | null
          locale?: string | null
          consent_personalization?: boolean
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string | null
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          cited_verses: Array<{
            ref: string
            url: string
            excerpt: string
          }> | null
          safety_flag: 'safe' | 'sensitive' | 'crisis' | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          cited_verses?: Array<{
            ref: string
            url: string
            excerpt: string
          }> | null
          safety_flag?: 'safe' | 'sensitive' | 'crisis' | null
          created_at?: string
        }
        Update: Record<string, never>
      }
      checkins: {
        Row: {
          id: string
          user_id: string
          date: string
          mood: number | null
          mood_text: string | null
          day_plan: string | null
          yesterday_reflection: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          mood?: number | null
          mood_text?: string | null
          day_plan?: string | null
          yesterday_reflection?: string | null
          created_at?: string
        }
        Update: {
          mood?: number | null
          mood_text?: string | null
          day_plan?: string | null
          yesterday_reflection?: string | null
        }
      }
      verses: {
        Row: {
          id: string
          book: string
          canto: number | null
          chapter: number
          verse: number
          vedabase_url: string
          sanskrit: string | null
          transliteration: string | null
          translation_excerpt: string | null
          created_at: string
        }
        Insert: {
          id?: string
          book: string
          canto?: number | null
          chapter: number
          verse: number
          vedabase_url: string
          sanskrit?: string | null
          transliteration?: string | null
          translation_excerpt?: string | null
          created_at?: string
        }
        Update: Record<string, never>
      }
      verse_chunks: {
        Row: {
          id: string
          verse_id: string
          book: string
          canto: number | null
          chapter: number
          verse: number
          vedabase_url: string
          chunk_text: string
          embedding: number[] | null
          content_tsv: unknown | null
          created_at: string
        }
        Insert: {
          id?: string
          verse_id: string
          book: string
          canto?: number | null
          chapter: number
          verse: number
          vedabase_url: string
          chunk_text: string
          embedding?: number[] | null
          content_tsv?: unknown | null
          created_at?: string
        }
        Update: Record<string, never>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
