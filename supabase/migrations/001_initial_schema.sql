-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  timezone TEXT,
  checkin_time TIME,
  locale TEXT DEFAULT 'en',
  consent_personalization BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  cited_verses JSONB,
  safety_flag TEXT CHECK (safety_flag IS NULL OR safety_flag IN ('safe', 'sensitive', 'crisis')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Check-ins table
CREATE TABLE checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mood INT CHECK (mood IS NULL OR (mood >= 1 AND mood <= 5)),
  mood_text TEXT,
  day_plan TEXT,
  yesterday_reflection TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verses canonical registry (public-read, service-role writes only)
CREATE TABLE verses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book TEXT NOT NULL,
  canto INT,
  chapter INT NOT NULL,
  verse INT NOT NULL,
  vedabase_url TEXT NOT NULL UNIQUE,
  sanskrit TEXT,
  transliteration TEXT,
  translation_excerpt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verse chunks with embeddings and full-text search (public-read, service-role writes only)
CREATE TABLE verse_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verse_id UUID NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
  book TEXT NOT NULL,
  canto INT,
  chapter INT NOT NULL,
  verse INT NOT NULL,
  vedabase_url TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1024),
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_checkins_user_id ON checkins(user_id);
CREATE INDEX idx_checkins_date ON checkins(date DESC);
CREATE INDEX idx_verses_book_chapter_verse ON verses(book, chapter, verse);
CREATE INDEX idx_verse_chunks_verse_id ON verse_chunks(verse_id);
CREATE INDEX idx_verse_chunks_embedding ON verse_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_verse_chunks_content_tsv ON verse_chunks USING gin(content_tsv);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE verses ENABLE ROW LEVEL SECURITY;
ALTER TABLE verse_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Profiles
CREATE POLICY "Users can read/update their own profile"
  ON profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: Conversations
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: Messages
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- RLS Policies: Check-ins
CREATE POLICY "Users can view their own check-ins"
  ON checkins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create check-ins"
  ON checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own check-ins"
  ON checkins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: Verses (public-read, service-role only writes)
CREATE POLICY "Verses are public-read"
  ON verses FOR SELECT
  USING (true);

-- RLS Policies: Verse chunks (public-read, service-role only writes)
CREATE POLICY "Verse chunks are public-read"
  ON verse_chunks FOR SELECT
  USING (true);
