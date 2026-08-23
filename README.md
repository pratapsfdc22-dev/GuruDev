# Guru Dev — Phase 1 Scaffold

Virtual guru chat interface with guidance grounded in Vedic scriptures.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Copy environment variables template:
   ```bash
   cp .env.local.example .env.local
   ```

2. Add your keys to `.env.local` (see CLAUDE.md for required services):
   - Supabase credentials
   - Anthropic API key
   - Voyage AI embeddings key
   - Langfuse observability keys

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `app/` — Next.js App Router routes and layouts
- `lib/ai/` — Anthropic Claude API wrapper (Haiku + Sonnet)
- `lib/supabase/` — Supabase client and server helpers
- `components/` — Reusable React components
- `types/` — TypeScript type definitions and Zod schemas

## Build Phases

- **Phase 1** (current): Next.js scaffold, Supabase auth setup, placeholder chat UI
- **Phase 2**: Corpus ingestion (Bhagavad-gītā, Śrīmad-Bhāgavatam, Caitanya-caritāmṛta)
- **Phase 3**: Full RAG pipeline (safety → query transform → retrieve → generate → verify)
- **Phase 4**: Engagement features (check-ins, daily verses, weekly summaries via n8n)
- **Phase 5**: Hardening (eval sets, groundedness scoring, rate limiting, i18n)

## Code Conventions

- TypeScript strict mode enforced
- All inputs validated with Zod
- All Claude API calls centralized in `lib/ai/`
- No secrets in client code
- Server-side only for Supabase service role, embeddings API, and Anthropic keys
