-- Accent-insensitive full-text search (Vietnamese: "dien toan dam may" finds "điện toán đám mây").
-- Prisma can't model these objects, so they live only in this migration.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Lowercased, accent-free text. unaccent() is only STABLE, so wrap it (with an explicit dictionary) to make it
-- usable in index expressions. 'đ' is mapped explicitly so it doesn't depend on the unaccent rules file.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT lower(public.unaccent('public.unaccent', replace(replace($1, 'đ', 'd'), 'Đ', 'D'))) $$;

-- Weighted document: title (A) > excerpt (B) > body (C).
CREATE OR REPLACE FUNCTION search_doc(title text, excerpt text, body text) RETURNS tsvector
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT setweight(to_tsvector('simple', f_unaccent(coalesce(title, ''))), 'A')
           || setweight(to_tsvector('simple', f_unaccent(coalesce(excerpt, ''))), 'B')
           || setweight(to_tsvector('simple', f_unaccent(coalesce(body, ''))), 'C') $$;

CREATE INDEX "Post_search_idx" ON "Post" USING gin (search_doc("title", "excerpt", "bodyMd"));
CREATE INDEX "Post_title_trgm_idx" ON "Post" USING gin (f_unaccent("title") gin_trgm_ops);
CREATE INDEX "Note_search_idx" ON "Note" USING gin (search_doc(NULL, NULL, "bodyMd"));
