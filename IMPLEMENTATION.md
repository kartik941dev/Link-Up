# LinkUp — Technical Implementation Specification & Developer Guide

This document defines the technical architecture, directory structure, data schemas, API contracts, inter-service communication protocols, and development workflows for **LinkUp**.

---

## 1. Directory Structure

The repository is organized as a modular monorepo containing three core services:

```
LinkUp/
├── backend/                       # Node.js + Express + TypeScript service
│   ├── migrations/                # Database SQL migration files
│   │   ├── 001_init_schema.sql
│   │   ├── 002_add_vector_index.sql
│   │   └── 003_graph_edges.sql
│   ├── src/
│   │   ├── cli/                   # DB CLI utilities
│   │   │   ├── migrate.ts
│   │   │   ├── health.ts
│   │   │   └── reindex.ts
│   │   ├── config.ts              # Typed environment configuration
│   │   ├── extractors/            # Ingestion parsers
│   │   │   ├── pdfExtractor.ts
│   │   │   ├── docxExtractor.ts
│   │   │   └── urlExtractor.ts
│   │   ├── middleware/            # Express middlewares
│   │   │   ├── auth.ts
│   │   │   ├── upload.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── rateLimiter.ts
│   │   ├── routes/                # API routers
│   │   │   ├── auth.routes.ts
│   │   │   ├── cards.routes.ts
│   │   │   ├── tags.routes.ts
│   │   │   ├── search.routes.ts
│   │   │   ├── graph.routes.ts
│   │   │   ├── arrange.routes.ts
│   │   │   └── rag.routes.ts
│   │   ├── services/              # Business logic
│   │   │   ├── cardService.ts
│   │   │   ├── tagService.ts
│   │   │   └── mlClient.ts
│   │   ├── types/                 # Shared TypeScript interfaces
│   │   │   ├── card.ts
│   │   │   ├── user.ts
│   │   │   └── api.ts
│   │   ├── utils/                 # Utilities
│   │   │   ├── db.ts
│   │   │   ├── validators.ts
│   │   │   └── sanitize.ts
│   │   └── server.ts              # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/                      # React 19 + Vite + TypeScript application
│   ├── public/                    # Static assets & icons
│   ├── src/
│   │   ├── assets/                # Images & styles
│   │   ├── components/            # UI components
│   │   │   ├── auth/              # Login, Signup, ProtectedRoute
│   │   │   ├── cards/             # CardCanvas, CardItem, CardActions
│   │   │   ├── chat/              # ChatDrawer, ChatMessage, CitationBadge
│   │   │   ├── common/            # Navbar, Sidebar, Modal, Button, Input
│   │   │   ├── graph/             # KnowledgeGraphView, NodeDetail
│   │   │   ├── modals/            # NoteModal, PdfModal, DocxModal, UrlModal
│   │   │   └── search/            # SearchBar, SearchResults, FilterPills
│   │   ├── context/               # Global state
│   │   │   ├── AuthContext.tsx
│   │   │   └── CardContext.tsx
│   │   ├── hooks/                 # Custom React hooks
│   │   │   ├── useCards.ts
│   │   │   ├── useTags.ts
│   │   │   ├── useSearch.ts
│   │   │   └── useGraph.ts
│   │   ├── pages/                 # Route pages
│   │   │   ├── HomePage.tsx       # Main canvas dashboard
│   │   │   ├── LoginPage.tsx      # Sign in
│   │   │   ├── SignupPage.tsx     # Sign up
│   │   │   ├── GraphPage.tsx      # Knowledge Graph interactive view
│   │   │   ├── SmartArrangePage.tsx # Thematic cluster arrangement
│   │   │   └── ChatPage.tsx       # Full Agentic RAG chat interface
│   │   ├── types/                 # Frontend TypeScript models
│   │   ├── utils/                 # Axios client & helpers
│   │   │   ├── api.ts
│   │   │   └── formatters.ts
│   │   ├── App.tsx                # App routes configuration
│   │   ├── index.css              # Glassmorphic global design system
│   │   └── main.tsx               # Root entry
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
│
├── ml-service/                    # Python + FastAPI ML & Semantic service
│   ├── routers/                   # FastAPI route modules
│   │   ├── embed.py
│   │   ├── search.py
│   │   ├── graph.py
│   │   ├── arrange.py
│   │   └── rag.py
│   ├── services/                  # ML & Algorithmic services
│   │   ├── model_loader.py        # Sentence transformer singleton
│   │   ├── vector_store.py        # pgvector operations
│   │   ├── graph_builder.py       # Graph topology & PageRank
│   │   ├── clusterer.py           # Community detection
│   │   ├── agentic_rag.py         # Multi-hop RAG orchestration
│   │   └── verifier.py            # Hallucination self-verification
│   ├── utils/                     # Helper modules
│   │   ├── llm_client.py          # Groq Llama 3.1 client
│   │   └── logger.py
│   ├── config.py                  # Pydantic BaseSettings config
│   ├── main.py                    # FastAPI application root
│   ├── requirements.txt
│   └── .env.example
│
├── IMPLEMENTATION.md              # Technical implementation details
├── PHASES.md                      # 6-phase master plan
├── REQUIREMENTS.md                # System requirements specification
└── README.md                      # Quickstart and overview
```

---

## 2. Complete Database DDL Schema

Below is the authoritative PostgreSQL DDL executed across migrations:

```sql
-- Extension Setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cards Table
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

-- Indexes for Optimal Query Performance
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_user ON graph_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_card_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_card_id);

-- Full-Text Search GIN Index
CREATE INDEX IF NOT EXISTS idx_cards_fts ON cards 
USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(extracted_text, '')));

-- Vector Similarity HNSW Index
CREATE INDEX IF NOT EXISTS idx_cards_embedding_hnsw ON cards 
USING hnsw (embedding vector_cosine_ops);
```

---

## 3. Core API Specifications

### 3.1 Authentication APIs (`/api/auth`)

#### `POST /api/auth/signup`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      "email": "user@example.com",
      "created_at": "2026-10-15T00:00:00.000Z"
    }
  }
  ```

#### `POST /api/auth/signin`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      "email": "user@example.com"
    }
  }
  ```

#### `GET /api/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**: User profile object.

---

### 3.2 Ingestion & Cards APIs (`/api/cards`)

#### `POST /api/cards` (Create Note)
- **Request Body**:
  ```json
  {
    "title": "React 19 Server Actions Guide",
    "content": "# Guide\n\nServer actions provide...",
    "tags": ["React", "Frontend", "WebDev"]
  }
  ```
- **Response `201 Created`**: Full Card entity.

#### `POST /api/cards/ingest/pdf`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `file` (PDF file, max 25MB), `tags` (JSON string array)
- **Extraction Behavior**: Runs `pdf-parse`, extracts text, page count, creates card, generates embedding.

#### `POST /api/cards/ingest/docx`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `file` (DOCX file, max 25MB), `tags` (JSON string array)
- **Extraction Behavior**: Runs `mammoth`, extracts clean text, creates card, generates embedding.

#### `POST /api/cards/ingest/social-link`
- **Request Body**:
  ```json
  {
    "url": "https://arxiv.org/abs/2301.00234",
    "tags": ["AI", "Research"]
  }
  ```
- **Extraction Behavior**: Scrapes OpenGraph tags (`og:title`, `og:description`, `og:image`), cleans readable text, creates card, generates embedding.

---

### 3.3 Search & Retrieval APIs (`/api/search` & `/api/rag`)

#### `GET /api/search?q=transformers&mode=hybrid&limit=20`
- **Response `200 OK`**:
  ```json
  {
    "query": "transformers",
    "mode": "hybrid",
    "total": 3,
    "results": [
      {
        "id": "card-uuid-1",
        "title": "Attention Is All You Need Paper Summary",
        "snippet": "...introduces the Transformer architecture based entirely on self-attention...",
        "content_type": "pdf",
        "similarity_score": 0.89,
        "match_type": "hybrid",
        "tags": ["Deep Learning", "Transformers"]
      }
    ]
  }
  ```

#### `POST /api/rag/query`
- **Request Body**:
  ```json
  {
    "query": "What are the advantages of multi-head attention described in my notes?"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "answer": "Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions [Card: f81d4fae-7dec-11d0 - Attention Summary].",
    "citations": [
      {
        "card_id": "f81d4fae-7dec-11d0",
        "title": "Attention Summary",
        "excerpt": "Multi-head attention allows the model to jointly attend to information..."
      }
    ],
    "verification": {
      "grounded": true,
      "confidence": 0.96,
      "unsupported_claims": []
    }
  }
  ```

---

## 4. Environment Variables Specification

### Backend (`backend/.env`)
```ini
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://username:password@localhost:5432/linkup?sslmode=disable
JWT_SECRET=linkup_super_secure_jwt_secret_key_change_in_production_2026
JWT_EXPIRATION=24h
CORS_ORIGIN=http://localhost:5173
API_URL=http://localhost:5000
ML_SERVICE_URL=http://localhost:8000
```

### Frontend (`frontend/.env`)
```ini
VITE_API_URL=http://localhost:5000/api
VITE_ML_API_URL=http://localhost:8000
```

### ML Service (`ml-service/.env`)
```ini
PORT=8000
ENV=development
DATABASE_URL=postgresql://username:password@localhost:5432/linkup?sslmode=disable
BACKEND_URL=http://localhost:5000
MODEL_NAME=all-MiniLM-L6-v2
MODEL_DEVICE=cpu
LLM_API_KEY=gsk_your_groq_api_key_here
```

---

## 5. Coding Standards & Guidelines

1. **Security First**:
   - Every database query for cards, tags, or graph edges MUST include `user_id = $1`.
   - Never log or return `password_hash` in API responses.
2. **Error Handling**:
   - All async route handlers must pass errors to `next(err)` or use an async wrapper.
   - Centralized error handler formats JSON `{ "error": "Human readable message", "code": 400 }`.
3. **Design System & Aesthetics**:
   - Dark mode default (`#0b0f19` background).
   - Glassmorphic panels with subtle gradients, frosted borders (`rgba(255, 255, 255, 0.08)`), and soft drop shadows.
   - Vibrant accent colors for visual distinction (`#6366f1` Indigo, `#38bdf8` Sky, `#10b981` Emerald, `#f59e0b` Amber).
   - Micro-animations on hover, transitions on card creation, skeleton loaders for async states.
