# Guru Dev — Project Spec for Claude Code

## What this app is
Guru Dev is a consumer web app: a "virtual guru" chat interface that answers real-life
questions (stress, purpose, relationships, work, habits, daily reflection) with guidance
grounded strictly in the Vedic scriptures documented at https://vedabase.io/ —
primarily Bhagavad-gītā As It Is, Śrīmad-Bhāgavatam, and Śrī Caitanya-caritāmṛta.

Positioning: universal wisdom, beyond any religion. Guru Dev never proselytizes and
never asks users to adopt religious practices. It presents what a verse teaches and how
it applies to the user's situation.

## Non-negotiable product rules
1. GROUNDING: Every substantive answer must cite specific verses (e.g. "Bg. 2.47",
   "SB 1.2.6") retrieved from the corpus, each with its vedabase.io URL.
2. NO FABRICATION: If retrieval returns nothing relevant, Guru Dev says so honestly and
   asks a clarifying question. It never invents verses, translations, or teachings.
3. COPYRIGHT: Display only short excerpts (verse reference + brief translation excerpt,
   <15 words quoted from any purport) and always link to the vedabase.io page for full
   text. Full purport text may be stored privately for retrieval but is never shown
   verbatim at length in the UI. (Translations/purports are © Bhaktivedanta Book Trust.)
4. SAFETY: This app serves people who may be depressed or in crisis. A safety classifier
   runs BEFORE the Guru Dev persona on every user message. On crisis signals (self-harm,
   suicide, harm to others, acute distress), the app responds with a compassionate,
   non-scriptural supportive message plus region-appropriate helpline resources, and
   gently encourages professional help. Guru Dev never diagnoses, never uses clinical
   labels, and the UI carries a persistent "spiritual guidance, not medical or mental
   health care" disclosure (onboarding + settings + footer).
5. DIALOGUE: Guru Dev engages in multi-turn conversation, remembers context within a
   conversation, and draws on the user's check-in history (with consent) to personalize.

## Tech stack (already provisioned — do not substitute)
- Frontend + API: Next.js 14+ (App Router, TypeScript, Tailwind) deployed on Vercel
- Auth + relational data + vector store: Supabase (Auth + Postgres + RLS + pgvector).
  Embeddings are generated server-side via an embeddings API (e.g. Voyage AI or the
  Anthropic-recommended provider) and stored in a pgvector column — no separate
  vector DB service. Corpus is small enough (~20k verses) that pgvector on Postgres
  performs well; hybrid search = pgvector similarity + Postgres full-text search
  (tsvector) combined, not a dedicated sparse index.
- LLM: Anthropic Claude API — claude-haiku-4-5 for the safety classifier and query
  transformation; claude-sonnet-4-6 for Guru Dev responses. API key lives in
  .env.local / Vercel env vars only. NEVER export ANTHROPIC_API_KEY in the shell.
- Workflows: n8n (cloud) for scheduled daily check-ins, verse-of-the-day, weekly
  reflection summaries, and corpus ingestion runs
- Observability: Langfuse — trace every pipeline call; log retrieval set, final answer,
  and a groundedness score (all cited verses ∈ retrieved set)

## Data model (Supabase)
- profiles: user_id, display_name, timezone, checkin_time, locale, consent flags
- conversations: id, user_id, title, created_at
- messages: id, conversation_id, role, content, cited_verses jsonb, safety_flag,
  created_at
- checkins: id, user_id, date, mood (1-5 + free text), day_plan, yesterday_reflection
- verses (canonical registry): id, book, canto, chapter, verse, vedabase_url,
  sanskrit, transliteration, translation_excerpt
- verse_chunks: id, verse_id (fk), book, canto, chapter, verse, vedabase_url,
  chunk_text, embedding (vector), content_tsv (generated tsvector column for
  full-text search). This is the retrieval table — purport chunks live here, not
  in `verses`. Index embedding with pgvector's HNSW or IVFFlat, and content_tsv
  with a GIN index.
- RLS: users access only their own rows. verses and verse_chunks are public-read
  reference data (no per-user ownership); writes are service-role only.

## RAG pipeline (per message)
1. Safety classifier (Haiku): {safe | sensitive | crisis}. crisis → safety response
   path, skip steps 2-5. sensitive → proceed but prepend extra-care instructions.
2. Query transformation (Haiku): map the life problem to Vedic concepts + search
   queries (e.g. "anxious about layoffs" → "fear, duty without attachment to results,
   equanimity, Bg chapter 2").
3. Retrieval: hybrid search against Supabase Postgres — pgvector cosine similarity
   (top-k=12) combined with Postgres full-text search (tsvector) over the same
   verse_chunks table, merged/reranked to a final top 6; filter by book if the
   user asked about a specific text.
4. Generation (Sonnet): system prompt enforces grounding rules above; output includes
   structured citations [{ref, url, excerpt}].
5. Verification: reject/regenerate if any cited ref is not in the retrieved set.
   Log everything to Langfuse.

## Ingestion pipeline (one-off + refresh via n8n)
- Respect robots.txt and rate limits; identify the crawler honestly.
- Parse verse pages into: sanskrit, transliteration, synonyms, translation, purport.
- Chunk purports ~500 tokens with verse-level metadata {book, canto, chapter, verse,
  vedabase_url}. Generate an embedding per chunk via the embeddings API and write
  chunk + embedding + metadata into Supabase's verse_chunks table; write canonical
  registry rows into the verses table in the same run.
- SCOPE: ingest the full corpus — Bhagavad-gītā As It Is, Śrīmad-Bhāgavatam (all
  18 cantos), and Śrī Caitanya-caritāmṛta — rather than staging book-by-book.
  Licensing is handled outside this build; the app still only ever displays short
  excerpts (<15 words) plus a vedabase.io link in the UI regardless (see rule #3),
  independent of licensing status.

## Daily engagement (n8n)
- At user's checkin_time: send check-in prompt (email first; push later).
  Questions rotate: "How do you feel today?", "What's your plan for today?",
  "How did yesterday go?"
- Check-in answers are stored and summarized; Guru Dev references them next session
  ("Yesterday you mentioned feeling restless…").
- Daily verse: one verse + one-line application, linked to vedabase.io.
- Weekly: reflection summary generated from the week's check-ins (grounded, cited).

## Build phases (work through these in order; keep commits small)
Phase 1 — Scaffold: Next.js app, Supabase auth, schema + RLS, basic chat UI streaming
          from a placeholder route. Deploy to Vercel from day one.
Phase 2 — Corpus: ingestion script covering the full corpus (Bhagavad-gītā,
          Śrīmad-Bhāgavatam, Caitanya-caritāmṛta), verse_chunks table with
          pgvector embeddings + full-text index, verses registry, retrieval
          endpoint with test harness. Build and validate against Bhagavad-gītā
          first (fastest feedback loop on chunking/retrieval quality, ~700
          verses), then run the same script across the rest of the corpus.
Phase 3 — Pipeline: safety classifier → query transform → retrieve → generate →
          verify. Langfuse tracing on every step. Citation cards in the chat UI
          (verse ref, short excerpt, "Read full purport →" link).
Phase 4 — Engagement: check-in flow + n8n schedules + verse of the day + weekly
          summary. Personalization from check-in history (with consent toggle).
Phase 5 — Hardening: eval set in Langfuse (50 question→expected-verse pairs spanning
          all three texts), groundedness scoring, rate limiting, abuse handling,
          i18n groundwork.

## Coding conventions
- TypeScript strict; zod-validate all API inputs and LLM structured outputs.
- All Claude calls behind a single lib/ai/ module (model names, retries, tracing
  in one place).
- No secrets in client code. Server routes only for Supabase service role, the
  embeddings API, and Anthropic keys.
- Tests: unit tests for the verifier (citation ∈ retrieval set) and the safety
  router; snapshot tests for citation rendering.
