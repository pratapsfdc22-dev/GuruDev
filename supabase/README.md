# Supabase Schema

## Running the Migration

To set up the database schema:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
5. Paste into the SQL editor
6. Click **Run**

## What Gets Created

### Tables
- **profiles** — User metadata (display name, timezone, check-in preferences, consent flags)
- **conversations** — Chat conversation threads per user
- **messages** — Individual messages with optional citations and safety flags
- **checkins** — Daily mood/reflection check-ins for personalization
- **verses** — Canonical registry of all scripture verses (Bg, SB, CC)
- **verse_chunks** — Purport chunks with pgvector embeddings + full-text search

### Indexes
- Conversation/message indexes for fast retrieval
- pgvector IVFFLAT index on embeddings for semantic search
- GIN index on tsvector for full-text search across verse text
- Indexes on date, verse reference, and foreign keys

### Extensions
- `pgvector` for semantic search with embeddings
- `uuid-ossp` for UUID generation

### Row Level Security (RLS)
- Users access only their own data (conversations, messages, check-ins)
- Verses and verse_chunks are public-read (available to all authenticated users)
- Service role can write to verses/verse_chunks (for ingestion)
- All inserts/updates are restricted to the authenticated user

## Service Role Key

The `SUPABASE_SERVICE_ROLE_KEY` is required for:
- Ingesting verses into the `verses` table
- Creating verse chunks with embeddings into `verse_chunks`
- Bypassing RLS for administrative operations

**Never expose this key to the client.** It should only be used in server-side code.
