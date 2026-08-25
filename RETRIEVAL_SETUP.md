# Retrieval Setup & Testing

## Phase 2.5: Hybrid Search Functions

To enable semantic + keyword search in Supabase, you must apply the retrieval functions migration.

### Apply Migration

**Option 1: Supabase SQL Editor (recommended)**
1. Go to Supabase Dashboard → Your Project → SQL Editor
2. Click "New Query"
3. Copy the entire contents of `/supabase/migrations/002_retrieval_functions.sql`
4. Click "Run"
5. Verify: You should see three functions created:
   - `match_verse_chunks()` — pgvector cosine similarity
   - `search_verse_chunks()` — Full-text search (tsvector)
   - `hybrid_search_verse_chunks()` — Combined (60% vector, 40% FTS)

**Option 2: Supabase CLI**
```bash
supabase migration up
```

### Test the Retrieval Harness

Once functions are deployed:

```bash
set -a && source .env.local && set +a && npx tsx scripts/retrieval-test-harness.ts
```

This runs 5 test queries:
1. "How do I find meaning and purpose in my work?"
2. "How can I deal with anxiety and fear about the future?"
3. "What is my duty when I disagree with authority?"
4. "How should I handle conflict in relationships?"
5. "What does it mean to let go of attachments?"

Output shows:
- **Score**: Combined relevance (higher = better match)
- **Source**: 📊 vector only, 🔍 FTS only, 🔀 both methods
- **Excerpt**: First 120 chars of matched chunk

### Interpreting Results

Good retrieval should:
- ✅ Return verses directly addressing the query topic
- ✅ Score relevant verses higher than tangential ones
- ✅ Include both direct keyword matches (FTS) and semantic matches (vector)
- ✅ Rank SB verses for dharma/duty questions, BG for philosophy

Red flags:
- ❌ Only returns first chapter verses (Bg 1.1, Bg 1.2) for all queries
- ❌ Returns verses with no relevance (e.g., battle descriptions for work/purpose)
- ❌ Scores don't distinguish between good and poor matches

### Example Query Test

```
Query: "How can I deal with anxiety and fear about the future?"

Expected top results:
- Bg 2.11-12 (steady mind, equanimity)
- Bg 2.14 (sense control, equanimity in pleasure/pain)
- Bg 15.5 (knowledge of eternal self removes fear)
- SB 1.2.6 (surrender to Lord removes fear)

Actual results (before vector fix):
- Bg 1.1 ✗ (battle setup, no anxiety content)
- Bg 1.2 ✗ (Dhritarashtra's blindness)
- Bg 1.4 ✗ (military obstacles)
```

### Debugging

If retrieval is poor:

1. **Check function was created**: 
   ```bash
   psql $DATABASE_URL -c "\df hybrid_search_verse_chunks"
   ```

2. **Test function directly**:
   ```bash
   npx tsx scripts/test-hybrid-search-raw.ts "your test query"
   ```

3. **Verify embeddings exist**:
   ```sql
   SELECT COUNT(*) FROM verse_chunks WHERE embedding IS NOT NULL;
   -- Should return 19,358
   ```

4. **Check tsvector index**:
   ```sql
   SELECT COUNT(*) FROM verse_chunks WHERE content_tsv IS NOT NULL;
   -- Should return 19,358
   ```

### Next: Phase 3

Once retrieval is working well (top results are semantically relevant), proceed to Phase 3:
- Safety classifier (Haiku)
- Query transformation (Haiku)
- Retrieval (this harness)
- Generation (Sonnet)
- Verification (citations in retrieved set)
