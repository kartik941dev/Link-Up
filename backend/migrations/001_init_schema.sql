-- Migration 001: Initial Schema for LinkUp
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Try enabling pgvector; if not installed on a local PG instance without pgvector, provide grace
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "vector";
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension could not be loaded directly. Ensure pgvector is compiled or using Neon/Supabase.';
END $$;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cards Table
-- Note: If vector type exists, embedding will be vector(384); fallback or custom type handled
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
        CREATE TABLE IF NOT EXISTS cards (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(512) NOT NULL,
            content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('note', 'pdf', 'docx', 'link')),
            raw_content TEXT,
            extracted_text TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            embedding vector(384),
            concept_embedding vector(384),
            semantic_metadata JSONB DEFAULT '{}'::jsonb,
            centrality FLOAT DEFAULT 0.0,
            cluster_label VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        CREATE TABLE IF NOT EXISTS cards (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(512) NOT NULL,
            content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('note', 'pdf', 'docx', 'link')),
            raw_content TEXT,
            extracted_text TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            embedding JSONB,
            concept_embedding JSONB,
            semantic_metadata JSONB DEFAULT '{}'::jsonb,
            centrality FLOAT DEFAULT 0.0,
            cluster_label VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- 3. Tags Table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_tag UNIQUE(user_id, name)
);

-- 4. Card Tags Junction Table
CREATE TABLE IF NOT EXISTS card_tags (
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, tag_id)
);

-- 5. Graph Edges Table
CREATE TABLE IF NOT EXISTS graph_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    target_card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    weight FLOAT NOT NULL DEFAULT 0.0,
    similarity_score FLOAT NOT NULL DEFAULT 0.0,
    edge_type VARCHAR(100) DEFAULT 'semantic_similarity',
    reason VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_edge UNIQUE(source_card_id, target_card_id)
);

-- 6. Migrations Tracking Table
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Optimal Performance
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_user ON graph_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_card_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_card_id);

-- Full-Text Search GIN Index
CREATE INDEX IF NOT EXISTS idx_cards_fts ON cards 
USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(extracted_text, '')));
