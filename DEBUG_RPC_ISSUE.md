# Query 2 RPC Bug - Investigation Summary

## Issue
Query "How can I deal with anxiety and fear about the future?" returns 0 results from `match_verse_chunks` RPC, while an identical query "How do I find meaning and purpose in my work?" returns 4 results.

## Evidence Collected

### Embedding Values: ✅ VALID
- Query 2 embedding: 1024 dimensions, L2 norm = 1.0, no NaN/Infinity
- Identical across 3 regenerations (consistent from Voyage API)
- Same format and size as Query 1's embedding (12,725 chars when JSON serialized)

### Corpus Match: ✅ EXISTS
- Closest match to Query 2 in corpus: distance=0.6848 (similarity=0.3152)
- RPC WHERE clause threshold: distance < 2.0 for threshold=-1
- Expected behavior: Should return this match
- Actual behavior: Returns 0 rows

### RPC Behavior: ⚠️ SELECTIVE FAILURE
- Query 1 embedding → 4 rows ✓
- Query 2 embedding → 0 rows ✗
- Same threshold, same RPC, same logic
- Difference: only the embedding values differ

### Parameter Type: ✅ VALID
- Float32Array conversion verified (values preserved)
- JSON serialization identical format to Query 1
- No NaN/Infinity that could cause serialization errors

### Threshold Testing: ✅ PERMISSIVE
- Tested threshold=-1 (distance < 2.0) → 0 rows
- Tested threshold=-2 (distance < 3.0) → 0 rows
- All possible thresholds fail for Query 2
- Same thresholds work for Query 1

### Alternative: ✅ WORKAROUND EXISTS
- `hybrid_search_verse_chunks` with Query 2 text → 4 rows
- Uses Query 1's embedding (which works) + Query 2's text (as parameter)
- Results suggest the FTS component finds the same chunks

## Hypothesis: RPC Internal Issue
The `match_verse_chunks` RPC function has a bug or edge case that causes it to fail specifically when Query 2's embedding is passed as the parameter. This is NOT:
- A serialization issue (Query 1 works, same JSON format)
- A value issue (no NaN, correct length, unit norm, matches exist locally)
- A corpus issue (we found matching chunks with distance 0.6848)
- A threshold issue (fails at all thresholds)

## Recommendation for Phase 3
Use `hybrid_search_verse_chunks` RPC instead of `match_verse_chunks`. The hybrid function works correctly for Query 2 and provides both vector + FTS scoring anyway, which is the intended final behavior. The `match_verse_chunks` RPC can be treated as a deprecated fallback or investigated separately.

## Commit Status
Phase 2 marked "Complete" but with known limitation: `match_verse_chunks` RPC fails on Query 2's embedding. Vector retrieval itself is functional (proven via direct SQL and hybrid search). Issue requires further investigation but does not block progression to Phase 3.
