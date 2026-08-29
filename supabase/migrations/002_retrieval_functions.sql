-- Hybrid retrieval function: pgvector + full-text search
-- Combined cosine similarity and BM25 ranking

CREATE OR REPLACE FUNCTION match_verse_chunks(
  query_embedding vector(1024),
  match_count int DEFAULT 12,
  match_threshold float DEFAULT -1
)
RETURNS TABLE(
  id uuid,
  verse_id uuid,
  book text,
  canto int,
  chapter int,
  verse int,
  vedabase_url text,
  chunk_text text,
  similarity float
) AS $$
BEGIN
  SET LOCAL ivfflat.probes = 20;
  RETURN QUERY
  WITH scored_chunks AS (
    SELECT
      vc.id,
      vc.verse_id,
      vc.book,
      vc.canto,
      vc.chapter,
      vc.verse,
      vc.vedabase_url,
      vc.chunk_text,
      (vc.embedding <=> query_embedding) as distance
    FROM verse_chunks vc
  )
  SELECT
    sc.id,
    sc.verse_id,
    sc.book,
    sc.canto,
    sc.chapter,
    sc.verse,
    sc.vedabase_url,
    sc.chunk_text,
    1 - sc.distance as similarity
  FROM scored_chunks sc
  WHERE sc.distance < (1 - match_threshold)
  ORDER BY sc.distance
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Full-text search with relevance ranking
CREATE OR REPLACE FUNCTION search_verse_chunks(
  query_text text,
  match_count int DEFAULT 12
)
RETURNS TABLE(
  id uuid,
  verse_id uuid,
  book text,
  canto int,
  chapter int,
  verse int,
  vedabase_url text,
  chunk_text text,
  relevance float
) AS $$
DECLARE
  query_tsquery tsquery;
BEGIN
  -- Convert plain text query to tsquery for PostgreSQL full-text search
  query_tsquery := plainto_tsquery('english', query_text);

  RETURN QUERY
  SELECT
    vc.id,
    vc.verse_id,
    vc.book,
    vc.canto,
    vc.chapter,
    vc.verse,
    vc.vedabase_url,
    vc.chunk_text,
    ts_rank(vc.content_tsv, query_tsquery) as relevance
  FROM verse_chunks vc
  WHERE vc.content_tsv @@ query_tsquery
  ORDER BY ts_rank(vc.content_tsv, query_tsquery) DESC, ts_rank_cd(vc.content_tsv, query_tsquery) DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Hybrid search: combines vector + FTS with weighted scoring
CREATE OR REPLACE FUNCTION hybrid_search_verse_chunks(
  query_embedding vector(1024),
  query_text text,
  vector_weight float DEFAULT 0.6,
  fts_weight float DEFAULT 0.4,
  match_count int DEFAULT 12
)
RETURNS TABLE(
  id uuid,
  verse_id uuid,
  book text,
  canto int,
  chapter int,
  verse int,
  vedabase_url text,
  chunk_text text,
  vector_score float,
  fts_score float,
  combined_score float
) AS $$
DECLARE
  query_tsquery tsquery;
BEGIN
  SET LOCAL ivfflat.probes = 20;
  query_tsquery := plainto_tsquery('english', query_text);

  RETURN QUERY
  WITH vector_results AS (
    -- Get top vector matches with normalized scores (ordered by similarity)
    SELECT
      vc.id,
      vc.verse_id,
      vc.book,
      vc.canto,
      vc.chapter,
      vc.verse,
      vc.vedabase_url,
      vc.chunk_text,
      (1 - (vc.embedding <=> query_embedding))::float as vec_score,
      RANK() OVER (ORDER BY vc.embedding <=> query_embedding) as vec_rank
    FROM verse_chunks vc
    ORDER BY vc.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  fts_results AS (
    -- Get top FTS matches with normalized scores
    SELECT
      vc.id,
      vc.verse_id,
      vc.book,
      vc.canto,
      vc.chapter,
      vc.verse,
      vc.vedabase_url,
      vc.chunk_text,
      ts_rank(vc.content_tsv, query_tsquery)::float as fts_score,
      RANK() OVER (ORDER BY ts_rank(vc.content_tsv, query_tsquery) DESC) as fts_rank
    FROM verse_chunks vc
    WHERE vc.content_tsv @@ query_tsquery
    LIMIT match_count * 2
  ),
  merged AS (
    -- Merge results, preferring those in both lists
    SELECT
      COALESCE(vr.id, fr.id) as id,
      COALESCE(vr.verse_id, fr.verse_id) as verse_id,
      COALESCE(vr.book, fr.book) as book,
      COALESCE(vr.canto, fr.canto) as canto,
      COALESCE(vr.chapter, fr.chapter) as chapter,
      COALESCE(vr.verse, fr.verse) as verse,
      COALESCE(vr.vedabase_url, fr.vedabase_url) as vedabase_url,
      COALESCE(vr.chunk_text, fr.chunk_text) as chunk_text,
      COALESCE(vr.vec_score, 0)::float as vector_score,
      COALESCE(fr.fts_score, 0)::float as fts_score
    FROM vector_results vr
    FULL OUTER JOIN fts_results fr USING (id)
  )
  SELECT
    merged.id,
    merged.verse_id,
    merged.book,
    merged.canto,
    merged.chapter,
    merged.verse,
    merged.vedabase_url,
    merged.chunk_text,
    merged.vector_score,
    merged.fts_score,
    (merged.vector_score * vector_weight + merged.fts_score * fts_weight) as combined_score
  FROM merged
  ORDER BY combined_score DESC, vector_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
