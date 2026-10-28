# LinkUp — System & Software Requirements Specification (SRS)

## 1. Project Overview & Objectives
**LinkUp** is an AI-powered personal knowledge management and visual learning canvas platform. It unifies diverse digital content (PDF documents, DOCX files, web links, social bookmarks, rich markdown notes) into an interconnected visual canvas. It performs automated semantic parsing, vector embeddings generation, automated knowledge graph extraction, semantic clustering, and multi-hop Agentic Retrieval-Augmented Generation (RAG) with source verification.

### 1.1 Primary Goals
1. **Frictionless Ingestion**: Multi-modal ingestion of files (PDF, DOCX), web URLs, and rich text notes.
2. **Topological Knowledge Representation**: Automatic semantic connection discovery via dense embeddings and knowledge graph edges.
3. **Smart Spatial Organization**: Dynamic card canvas and community-detected thematic grouping (Smart Arrange).
4. **Agentic Knowledge Retrieval**: Grounded question answering powered by Groq Llama 3.1, self-verification against hallucinations, and precise citation links.
5. **Secure, Scalable Foundation**: Clean separation of Node.js backend, Python FastAPI ML service, and React 19 frontend on PostgreSQL + `pgvector`.

---

## 2. System Architecture Requirements

### 2.1 Multi-Tier Architecture
The platform is organized into three microservices and a shared PostgreSQL vector-enabled database:
1. **Frontend Client**:
   - Technology: React 19, Vite, TypeScript, React Router v7, Vanilla CSS / Modern Glassmorphism.
   - Role: User interface, canvas visualization, ingestion triggers, graph interaction, chat assistant.
2. **Backend Application Server**:
   - Technology: Node.js, Express, TypeScript, Multer, `pg` (node-postgres), JWT, bcryptjs.
   - Role: User authentication, document parsing (PDF/DOCX/URL scraping), database transactions, API gateway to ML service, rate limiting.
3. **ML & Semantic Microservice**:
   - Technology: Python 3.10-3.12, FastAPI, PyTorch (CPU), `sentence-transformers` (`all-MiniLM-L6-v2`), Groq SDK.
   - Role: Dense vector generation, cosine vector search, graph topological calculation, community clustering, Agentic RAG reasoning, self-verification.
4. **Database Tier**:
   - Technology: PostgreSQL 14+ with `pgvector` extension enabled.
   - Role: Relational entity persistence (users, cards, tags, card_tags, graph_edges) and vector storage.

---

## 3. Functional Requirements (FR)

### FR-1: Authentication & User Management
- **FR-1.1**: Email & password signup with validation (valid email format, minimum 8 characters).
- **FR-1.2**: Password hashing using `bcryptjs` with minimum salt factor of 10.
- **FR-1.3**: Stateless JWT generation with configurable expiry (e.g., 24 hours).
- **FR-1.4**: Authenticated session restoration (`GET /api/auth/me`).
- **FR-1.5**: Secure logout and client-side token management.
- **FR-1.6**: Multi-tenant data isolation: all cards, tags, and graph edges are scoped strictly to `user_id`.

### FR-2: Multi-Source Content Ingestion
- **FR-2.1 Text Cards**: Support direct text/markdown note creation with title, raw content, and custom tags.
- **FR-2.2 PDF Ingestion**:
  - Accept `.pdf` file uploads up to 25MB via multipart form data.
  - Extract text and structural metadata using `pdf-parse`.
  - Store extracted clean text, page counts, and source filename in metadata.
- **FR-2.3 DOCX Ingestion**:
  - Accept `.docx` file uploads up to 25MB.
  - Parse body text and headings using `mammoth`.
  - Retain document structure and extract clean raw content.
- **FR-2.4 Web & Social Link Ingestion**:
  - Accept valid HTTP/HTTPS URLs.
  - Fetch target page and extract OpenGraph tags (`og:title`, `og:description`, `og:image`, `canonical_url`).
  - Extract core article readable body text and fallback to standard HTML title/meta tags if OpenGraph tags are missing.

### FR-3: Card Management & Canvas UI
- **FR-3.1**: List cards with pagination or infinite scroll, sortable by `created_at`, `title`, or `centrality`.
- **FR-3.2**: Delete cards with cascading removal of tag associations and related graph edges.
- **FR-3.3**: Update card title, content, and attached tags.
- **FR-3.4**: Visual card display with content type indicators (`note`, `pdf`, `docx`, `link`), thumbnail preview, tag pills, and creation date.
- **FR-3.5**: Responsive grid / canvas layout with dark-mode glassmorphism aesthetics.

### FR-4: Tagging & Categorization
- **FR-4.1**: Create, edit, and delete custom tags per user.
- **FR-4.2**: Assign multiple tags to cards with many-to-many relationship (`card_tags`).
- **FR-4.3**: Fetch tags alongside card usage counts for dynamic sidebar filtering.
- **FR-4.4**: Filter cards by single or multiple tag conjunction.

### FR-5: Vector Embedding & Hybrid Search
- **FR-5.1**: Generate 384-dimensional dense embeddings for every card's title + text using `sentence-transformers` (`all-MiniLM-L6-v2`).
- **FR-5.2**: Store vector embeddings in PostgreSQL `cards.embedding` column using `pgvector`.
- **FR-5.3**: Full-Text Search (FTS) using PostgreSQL English dictionary `tsvector` indexed on `title` and `extracted_text`.
- **FR-5.4**: Semantic vector search using cosine similarity (`1 - (embedding <=> query_vector)`).
- **FR-5.5**: Hybrid search blending lexical keyword score and vector similarity score with adjustable weighting or Reciprocal Rank Fusion (RRF).

### FR-6: Knowledge Graph Construction & Topological Intelligence
- **FR-6.1**: Compute pairwise cosine similarity between user's cards.
- **FR-6.2**: Establish graph edges between cards when similarity exceeds a configurable threshold (e.g., 0.65).
- **FR-6.3**: Store directional/bidirectional edges in `graph_edges` table with weights and similarity scores.
- **FR-6.4**: Compute network centrality (PageRank or Degree Centrality) per card and update `cards.centrality`.
- **FR-6.5**: Expose graph structure via API (`GET /api/graph`) to render interactive network nodes and edges on the frontend.

### FR-7: Smart Arrange & Thematic Clustering
- **FR-7.1**: Partition user cards into semantic communities using community detection (Louvain or hierarchical clustering).
- **FR-7.2**: Generate descriptive thematic titles for each cluster using Groq LLM prompt analysis over member card titles.
- **FR-7.3**: Persist `cluster_label` on cards or return dynamic layout groupings.
- **FR-7.4**: Frontend view organizing cards into distinct thematic visual sections/swimlanes.

### FR-8: Agentic RAG Question Answering
- **FR-8.1 Multi-Hop Retrieval**: Expand user question into sub-queries, execute hybrid retrieval, and pull 1st-hop graph neighbors.
- **FR-8.2 Prompt Synthesis**: Feed relevant card snippets into Groq `llama-3.1-8b-instant` with strict grounding system prompt.
- **FR-8.3 Source Citation**: Require inline citations `[Card: <id>]` referencing exact card IDs and excerpts.
- **FR-8.4 Self-Verification Engine**: Post-generation check that verifies all stated claims against provided card context to flag hallucinations and assign a confidence score (0.0 to 1.0).
- **FR-8.5 Interactive Chat Interface**: Conversational UI displaying streaming/formatted answers, confidence indicators, and interactive citation chips that jump to or highlight relevant cards.

---

## 4. Non-Functional Requirements (NFR)

### NFR-1: Performance & Latency
- Card ingestion & text extraction completed in under 2 seconds for documents < 10MB.
- Hybrid search queries respond in < 250ms for libraries up to 10,000 cards.
- RAG question-answering end-to-end response in < 3.5 seconds using Groq LPU acceleration.
- Initial frontend page load (LCP) < 1.5 seconds on broadband connections.

### NFR-2: Security & Privacy
- Zero cross-user data leakage: every SQL query filtering on `cards`, `tags`, or `graph_edges` MUST enforce `user_id = $1`.
- Authentication secrets, database credentials, and LLM API keys loaded strictly via environment variables.
- Passwords salted with bcrypt (cost factor >= 10); plaintext passwords never stored or logged.
- Strict input sanitization against XSS, SQL injection (via parameterized queries), and SSRF on URL ingestion.
- HTTP security headers enabled via `helmet` and CORS restricted to configured frontend origin.

### NFR-3: Scalability & Reliability
- Database indexing: B-Tree index on `user_id`, GIN index on `tsvector`, and HNSW/IVFFlat index on `vector`.
- Graceful degradation: if ML service is unreachable, basic CRUD and keyword search must continue operating.
- Fault tolerance: Ingestion failures for corrupt files return descriptive error messages without crashing the server.

### NFR-4: Usability & Aesthetics
- High-aesthetic dark-mode glassmorphic interface: smooth gradients, backdrop blurs, curated color palettes, modern typography (`Inter`/`Outfit`).
- Instant visual feedback on uploads, searches, and chat interactions.
- Responsive design supporting desktop monitors, laptops, and tablets.

---

## 5. Technology Matrix

| Subsystem | Technology | Version / Specification |
|---|---|---|
| **Frontend Framework** | React | 19.x |
| **Build Tool** | Vite | 6.x |
| **Language** | TypeScript | 5.x |
| **Styling** | Vanilla CSS (Glassmorphism design tokens) | Modern CSS3 |
| **Routing** | React Router | 7.x |
| **Backend Runtime** | Node.js | >= 20.x |
| **Backend Framework** | Express | 4.x / TypeScript |
| **Database** | PostgreSQL + pgvector | 14+ / pgvector 0.5+ |
| **DB Driver** | `pg` (node-postgres) | 8.x with connection pooling |
| **Document Parsers** | `pdf-parse`, `mammoth`, `cheerio`, `axios` | Latest stable |
| **ML Runtime** | Python | 3.10 - 3.12 |
| **ML Framework** | FastAPI + Uvicorn | 0.110+ |
| **Embeddings Model** | `sentence-transformers` | `all-MiniLM-L6-v2` (384 dimensions) |
| **LLM Provider** | Groq Cloud SDK | `llama-3.1-8b-instant` |
| **Graph / Clustering** | NetworkX / Scikit-learn / SciPy | Latest stable |
