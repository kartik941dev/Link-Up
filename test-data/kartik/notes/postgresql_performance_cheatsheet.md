# PostgreSQL Query Optimization Cheatsheet

1. Always run `EXPLAIN (ANALYZE, BUFFERS)` before and after adding indexes to confirm index scans replace sequential scans.
2. Use GIN indexes on `to_tsvector('english', coalesce(title, '') || ' ' || coalesce(extracted_text, ''))` for fast full-text search.
3. For pgvector tables, use cosine distance `<=>` with normalized embeddings from `all-MiniLM-L6-v2` (384 dimensions).
4. Avoid returning huge `extracted_text` columns in list endpoints; use `SUBSTRING(COALESCE(extracted_text, raw_content, ''), 1, 280) AS snippet`.
5. Always use parameterized queries (`$1`, `$2` in Node `pg`, `%s` in Python `psycopg2`) to prevent SQL injection.
