# LinkUp — 6-Phase Implementation Roadmap & Phase Master Guide

This master document details the complete 6-Phase roadmap for building **LinkUp**. Every phase contains exhaustive specifications: prerequisites, target files, database schemas, API contracts, frontend interfaces, background services, and rigorous verification checklists.

---

## 🗺 Phase Overview Matrix

| Phase | Phase Name | Primary Focus | Key Deliverables | Status |
|---|---|---|---|:---:|
| **Phase 1** | **Project Foundation, Database Architecture & Core Auth** | Monorepo structure, PostgreSQL + pgvector setup, Express backend, React 19 frontend shell, JWT Auth | Database migrations, backend auth API, frontend login/signup/auth context | ✅ **Completed** |
| **Phase 2** | **Card Management & Multi-Source Ingestion Engine** | Card CRUD, Tagging system, Document & Web extractors (PDF, DOCX, URL), Canvas UI | Multer ingestion pipeline, extractors, card canvas grid, upload modals | ✅ **Completed** |
| **Phase 3** | **Python ML Service, Vector Embeddings & Hybrid Search** | FastAPI microservice, `all-MiniLM-L6-v2` embeddings, pgvector search, FTS + Semantic hybrid search | ML `/embed` & `/search/vector`, backend hybrid search API, frontend search bar | ✅ **Completed** |
| **Phase 4** | **Knowledge Graph Construction & Topological Intelligence** | Semantic similarity thresholding, graph edge extraction, PageRank centrality, Graph visualizer | Graph builder, `graph_edges` store, centrality calculator, interactive network graph UI | ✅ **Completed** |
| **Phase 5** | **Smart Arrange & Semantic Clustering** | Graph community detection (Louvain / clustering), LLM cluster topic naming, Canvas re-layout | ML `/arrange/smart-arrange`, Smart Arrange UI with thematic rows & swimlanes | ✅ **Completed** |
| **Phase 6** | **Agentic RAG System, Hallucination Verification & Hardening** | Multi-hop RAG pipeline with Groq Llama 3.1, citation mapping, self-verification, production hardening | RAG query engine, AI chat assistant interface, rate limiting, security auditing | ✅ **Completed** |

---

## 📌 Phase 1: Project Foundation, Database Architecture & Core Auth System

### 1.1 Objective
Establish the full project workspace, configure the PostgreSQL database with `pgvector`, build the Node.js + Express + TypeScript backend framework, initialize the React 19 + Vite frontend shell, and implement full JWT authentication with secure session handling.

### 1.2 Prerequisites & Environment
- Node.js (v20+ recommended)
- PostgreSQL instance (Neon cloud or local PostgreSQL 14+) with `vector` extension support.
- Environment variables configured in `backend/.env` and `frontend/.env`.

### 1.3 Detailed Step-by-Step Tasks
1. **Workspace & Directory Scaffolding**:
   - Initialize root configuration and scripts (`package.json`, `.gitignore`).
   - Create directories: `backend/`, `frontend/`, `ml-service/`.
2. **Database Migrations Engine**:
   - Install `pg` (node-postgres), `dotenv`, `typescript`, `@types/pg`.
   - Create migration runner: `backend/src/cli/migrate.ts` and `backend/src/cli/health.ts`.
   - Write Migration `001_init_schema.sql`:
     - Enable `uuid-ossp` and `vector` extensions.
     - Create `users` table (`id` UUID PK, `email` VARCHAR UNIQUE, `password_hash` VARCHAR, `created_at`, `updated_at`).
     - Create `cards` table (`id` UUID PK, `user_id` FK -> users, `title` VARCHAR, `content_type` VARCHAR, `raw_content` TEXT, `extracted_text` TEXT, `metadata` JSONB, `embedding` vector(384), `concept_embedding` vector(384), `semantic_metadata` JSONB, `centrality` FLOAT DEFAULT 0.0, `cluster_label` VARCHAR, `created_at`, `updated_at`).
     - Create `tags` table (`id` UUID PK, `user_id` FK -> users, `name` VARCHAR, `created_at`, UNIQUE(`user_id`, `name`)).
     - Create `card_tags` junction table (`card_id` FK, `tag_id` FK, PRIMARY KEY (`card_id`, `tag_id`)).
     - Create `graph_edges` table (`id` UUID PK, `user_id` FK, `source_card_id` FK, `target_card_id` FK, `weight` FLOAT, `similarity_score` FLOAT, `edge_type` VARCHAR, `reason` VARCHAR, `created_at`).
     - Create `migrations` table (`id` SERIAL PK, `name` VARCHAR UNIQUE, `executed_at` TIMESTAMP).
     - Add performance indexes: B-Tree on `user_id`, Full-Text Search GIN index on `to_tsvector('english', coalesce(title, '') || ' ' || coalesce(extracted_text, ''))`.
3. **Backend Service Core (`backend/`)**:
   - Setup `backend/tsconfig.json`, `backend/package.json`.
   - Create `backend/src/config.ts` for strictly typed environment variables.
   - Create `backend/src/utils/db.ts` managing the `pg.Pool` connection pool with SSL handling.
   - Implement `backend/src/middleware/auth.ts`: JWT bearer token verification, attaching `req.user`.
   - Implement `backend/src/middleware/errorHandler.ts`: centralized error formatting.
   - Implement `backend/src/routes/auth.routes.ts`:
     - `POST /api/auth/signup`: Validates input, hashes password with `bcryptjs` (salt factor 10), inserts user, returns JWT and user profile.
     - `POST /api/auth/signin`: Verifies email and password, returns JWT and user profile.
     - `GET /api/auth/me`: Authenticated endpoint returning current user details.
   - Assemble `backend/src/server.ts` with CORS, JSON body parser, and health check route `/api/health`.
4. **Frontend Architecture (`frontend/`)**:
   - Initialize Vite + React 19 + TypeScript app.
   - Install React Router v7 (`react-router-dom`), `lucide-react`, `axios`.
   - Implement design tokens in `frontend/src/index.css` (Glassmorphism, dark palette `#0f172a`, `#1e293b`, accents `#6366f1`, `#38bdf8`, blurred cards, modern typography).
   - Create `frontend/src/utils/api.ts` configured with Axios interceptors for automatic JWT Authorization header injection and 401 handling.
   - Create `AuthContext` (`frontend/src/context/AuthContext.tsx`) for global user state (user, token, login, signup, logout, loading state).
   - Build UI pages:
     - `LoginPage.tsx`: Glassmorphic login card with validation and error messaging.
     - `SignupPage.tsx`: Registration form with instant feedback.
     - `DashboardShell.tsx`: Navigation bar, profile badge, logout action, navigation tabs.
   - Setup `frontend/src/App.tsx` with React Router protected route guards (`ProtectedRoute`).

### 1.4 Phase 1 Deliverables & Verification
- [x] Database migrations execute cleanly via `npm run db:migrate`.
- [x] `npm run db:health` confirms valid connection and schema creation.
- [x] Backend starts without error on port 5000 (`http://localhost:5000/api/health` returns status `ok`).
- [x] User can register a new account through the frontend UI or API.
- [x] User can sign in, receive JWT token stored in `localStorage`, and access protected dashboard.
- [x] Page reload preserves active authenticated session via `GET /api/auth/me`.

---

## 📌 Phase 2: Card Management & Multi-Source Content Ingestion Engine

### 2.1 Objective
Implement the complete knowledge card lifecycle (create, read, update, delete, tag) and the multi-source ingestion pipeline capable of parsing text notes, PDF documents, Microsoft Word files (`.docx`), and web/social URLs into structured knowledge cards with rich metadata.

### 2.2 Prerequisites
- Phase 1 completed (working database, backend auth, frontend shell).

### 2.3 Detailed Step-by-Step Tasks
1. **Document & Content Extractors (`backend/src/extractors/`)**:
   - **PDF Extractor (`pdfExtractor.ts`)**:
     - Utilizes `pdf-parse` to extract plain text and document info (page count, author, title).
     - Cleans whitespace and extracts snippet preview.
   - **DOCX Extractor (`docxExtractor.ts`)**:
     - Utilizes `mammoth` to extract clean text while preserving paragraph structure.
     - Extracts heading elements and word count.
   - **URL & Social Extractor (`urlExtractor.ts`)**:
     - Uses `axios` with browser headers and `cheerio` to fetch HTML.
     - Scrapes OpenGraph tags: `og:title`, `og:description`, `og:image`, `og:site_name`, `og:url`.
     - Scrapes Twitter Card meta tags as fallback.
     - Extracts readable article text using main content selectors (`article`, `main`, `#content`, `p`).
     - Protects against SSRF by validating against private IP ranges (`127.0.0.1`, `localhost`, `10.x.x.x`, `192.168.x.x`).
2. **File Upload Middleware (`backend/src/middleware/upload.ts`)**:
   - Configure `multer` for memory storage or secure temporary disk storage with file size limit (25MB).
   - Validate MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
3. **Card & Tag Business Logic & APIs (`backend/src/routes/` & `backend/src/services/`)**:
   - `GET /api/cards`: Lists user's cards with optional filtering by tags, search keyword, and pagination.
   - `POST /api/cards`: Create text/markdown note card.
   - `POST /api/cards/ingest/pdf`: Multipart upload for PDF file, extracts content, saves card.
   - `POST /api/cards/ingest/docx`: Multipart upload for DOCX file, extracts content, saves card.
   - `POST /api/cards/ingest/social-link`: Ingests URL, parses OpenGraph and readable body text, saves card.
   - `GET /api/cards/:id`: Get single card detail including tags and metadata.
   - `PUT /api/cards/:id`: Update card title, content, or tags.
   - `DELETE /api/cards/:id`: Remove card and cascade delete associations.
   - `GET /api/tags`: Get all user tags with card counts (`SELECT t.*, COUNT(ct.card_id) FROM tags t...`).
   - `POST /api/tags`: Create new tag.
   - `DELETE /api/tags/:id`: Delete tag.
4. **Frontend Card Canvas & Ingestion Modals (`frontend/src/`)**:
   - **Card Component (`components/CardItem.tsx`)**:
     - Glassmorphic card styling with content type badge (Note, PDF, DOCX, Link).
     - Title, date, content preview snippet, thumbnail (for URLs/PDFs), and tag chips.
     - Quick actions: View details, Edit, Delete, Copy link/text.
   - **Card Grid Canvas (`components/CardCanvas.tsx`)**:
     - Responsive masonry / grid layout.
     - Empty state with quick ingestion triggers.
   - **Ingestion Modal Suite (`components/modals/`)**:
     - `CreateNoteModal.tsx`: Rich note input with title, markdown editor, and tag selector.
     - `UploadPdfModal.tsx`: Drag-and-drop file uploader with upload progress and preview.
     - `UploadDocxModal.tsx`: Drag-and-drop DOCX file uploader.
     - `IngestUrlModal.tsx`: URL input with instant OpenGraph live preview card before saving.
   - **Tag Sidebar / Filter Bar (`components/TagFilterBar.tsx`)**:
     - Tag filter pills with card counts, allow multi-selection filtering.
   - **Card Detail Modal (`components/modals/CardDetailModal.tsx`)**:
     - Full screen / large modal showing complete extracted text, metadata JSON, tags, and source link.

### 2.4 Phase 2 Deliverables & Verification
- [x] Users can create rich text cards with custom tags.
- [x] Users can upload a PDF; backend extracts text and page count; card displays on canvas.
- [x] Users can upload a DOCX file; text is accurately extracted and displayed.
- [x] Users can paste a web URL (e.g. news article, blog, documentation); OpenGraph title, description, and image are retrieved and rendered.
- [x] Tag filtering dynamically updates the visible cards on the canvas.
- [x] Cards can be edited and deleted with instantaneous UI updates.

---

## 📌 Phase 3: Python ML Service, Vector Embeddings & Hybrid Search

### 3.1 Objective
Construct the Python FastAPI machine learning microservice (`ml-service`), load the `sentence-transformers` embedding model (`all-MiniLM-L6-v2`), generate 384-dimensional dense vectors for all ingested cards, and implement hybrid search blending PostgreSQL full-text search (FTS) with vector similarity.

### 3.2 Prerequisites
- Phase 1 & Phase 2 completed.
- Python 3.10-3.12 installed.

### 3.3 Detailed Step-by-Step Tasks
1. **ML Service Scaffolding (`ml-service/`)**:
   - Create `ml-service/requirements.txt`: `fastapi`, `uvicorn[standard]`, `sentence-transformers`, `torch`, `pydantic`, `psycopg2-binary` or `asyncpg`, `python-dotenv`, `numpy`.
   - Setup `ml-service/config.py`: Port (8000), Model name (`all-MiniLM-L6-v2`), Device (`cpu` or `cuda`), Database URL.
   - Build singleton model loader (`ml-service/services/model_loader.py`) to keep the transformer model loaded in memory for fast inference.
2. **Embedding & Vector Search Endpoints**:
   - `GET /health`: Returns service health, model load status, and device info.
   - `POST /embed`: Accepts single text string or list of text strings, generates 384d normalized vector embeddings.
   - `POST /search/vector`: Accepts query text or vector, connects to PostgreSQL `pgvector`, runs cosine similarity query (`ORDER BY embedding <=> $1 LIMIT $2`), returns ranked card IDs with similarity scores.
3. **Backend-to-ML Integration Hook (`backend/src/services/mlClient.ts`)**:
   - Create ML HTTP client with automatic retry and error handling.
   - Automatically trigger embedding generation upon card creation or file ingestion:
     - Combine `title` + `extracted_text`.
     - Call ML `/embed`.
     - Update `cards.embedding = $1` in PostgreSQL.
   - Provide database CLI command `npm run cards:reindex` to backfill embeddings for any existing cards.
4. **Hybrid Search Engine (`backend/src/routes/search.routes.ts`)**:
   - Implement hybrid search combining:
     - **Full-Text Search (FTS)**: `ts_rank_cd(to_tsvector('english', title || ' ' || extracted_text), plainto_tsquery('english', $1))`
     - **Vector Semantic Search**: `1 - (cards.embedding <=> query_vector)`
   - Score Fusion: Compute weighted score `final_score = (alpha * vector_score) + ((1 - alpha) * text_score)`.
   - Return matched cards with match type badges (`semantic`, `exact`, `hybrid`), similarity percentage, and highlighted text excerpts.
5. **Frontend Search Bar & Results Experience (`frontend/src/`)**:
   - Real-time debounced search bar in top navigation.
   - Search mode toggle: `All (Hybrid)`, `Semantic Only`, `Exact Text Only`.
   - Visual result previews showing relevance score percentage badge and matched keyword highlights.
   - Seamless return to full canvas upon clearing search.

### 3.4 Phase 3 Deliverables & Verification
- [x] ML Service boots on port 8000 and `/health` reports model loaded.
- [x] Calling `/embed` returns a valid 384-dimensional float array.
- [x] Adding a new card in the backend automatically populates `embedding` in PostgreSQL.
- [x] Semantic query (e.g. searching "machine learning algorithms" for a card titled "Random Forests & Gradient Boosting") retrieves the card even without exact keyword matches.
- [x] Keyword query retrieves exact matches via PostgreSQL FTS.
- [x] Frontend search bar returns instantaneous hybrid results with score badges.

---

## 📌 Phase 4: Knowledge Graph Construction & Topological Intelligence

### 4.1 Objective
Transform isolated knowledge cards into an interconnected Knowledge Graph by calculating pairwise cosine similarity, extracting semantic conceptual edges, computing PageRank network centrality, and visualizing the knowledge network on an interactive canvas.

### 4.2 Prerequisites
- Phase 1, 2, and 3 completed (cards populated with dense embeddings).

### 4.3 Detailed Step-by-Step Tasks
1. **Graph Construction Engine (`ml-service/services/graph_builder.py` & `routers/graph.py`)**:
   - Endpoint `POST /graph/build`:
     - Fetch all card embeddings for a specific `user_id`.
     - Compute pairwise cosine similarity matrix using NumPy / PyTorch.
     - Filter pairs by threshold (e.g. similarity >= 0.65, configurable).
     - Generate edge type classifications: `semantic_similarity`, `topic_cluster`, `direct_reference`.
     - Store resulting edges in `graph_edges` table (`source_card_id`, `target_card_id`, `weight`, `similarity_score`, `edge_type`).
2. **Topological Intelligence & Centrality**:
   - Build NetworkX graph representation from `graph_edges`.
   - Compute PageRank centrality score for each card.
   - Update `cards.centrality` column with normalized PageRank scores (0.0 to 1.0).
   - High-centrality cards represent "hub concepts" or key knowledge nodes.
3. **Backend Graph Endpoints (`backend/src/routes/graph.routes.ts`)**:
   - `POST /api/graph/rebuild`: Triggers graph recalculation for the authenticated user (also invoked optionally in the background upon new card ingestion).
   - `GET /api/graph`: Returns nodes (cards with title, type, centrality, tags) and links (edges with weight, similarity, reason).
   - `GET /api/graph/neighbors/:cardId`: Returns immediate 1st-hop and 2nd-hop connected neighbor cards.
   - `GET /api/graph/export`: Supports exporting graph dataset in JSON (`nodes` & `links`) or zipped/joined CSV (`nodes.csv`, `edges.csv`).
4. **Interactive Knowledge Graph UI & Dual Download (`frontend/src/components/graph/`)**:
   - Build `KnowledgeGraphView.tsx` utilizing interactive Canvas / Force-directed layout engine:
     - Node styling: Size proportional to PageRank centrality, color-coded by content type (PDF, DOCX, Note, Web Link).
     - Edge styling: Thickness and glowing opacity based on similarity weight.
     - Interactivity: Pan, zoom, node drag, neighbor highlighting on hover, and card preview drawer on click.
     - Filter Toolbar: Real-time similarity threshold slider ($0.5$ to $0.95$), search node filter, and manual "Rebuild Graph" action.
   - **Dual Export / Download Suite**:
     - 🖼️ **Image Export**: One-click download of the visual graph as high-resolution **PNG** and crisp vector **SVG** (including theme backgrounds and node labels).
     - 📊 **Data Export**: One-click download of graph data as structured **JSON** (`graph.json`) or **CSV** (`nodes.csv` & `edges.csv`) for import into external tools (Gephi, Obsidian, Cytoscape).

### 4.4 Phase 4 Deliverables & Verification
- [x] Rebuilding graph populates `graph_edges` table with valid similarity edges.
- [x] Card centrality values are updated in PostgreSQL reflecting connected hub cards.
- [x] `GET /api/graph` returns valid `{ nodes, links }` JSON payload.
- [x] User can switch from Canvas Grid View to Knowledge Graph View.
- [x] Interactive graph renders smoothly, supports zooming, dragging, and node click inspections.
- [x] User can download the visual graph diagram as a high-resolution PNG image.
- [x] User can download the complete graph structure as JSON and CSV datasets.

---

## 📌 Phase 5: Smart Arrange & Semantic Clustering

### 5.1 Objective
Implement automated semantic clustering to eliminate information clutter. The platform partitions cards into cohesive thematic groups (communities) and leverages Groq LLM to automatically generate human-meaningful titles for each cluster, rendering them into a structured visual swimlane layout.

### 5.2 Prerequisites
- Phase 1 through 4 completed.
- Groq API Key (`LLM_API_KEY`) configured in `ml-service/.env`.

### 5.3 Detailed Step-by-Step Tasks
1. **Graph Community Detection & Clustering Algorithm (`ml-service/services/clusterer.py`)**:
   - Implement community detection over the user's knowledge graph (Louvain modularity algorithm or Scikit-learn agglomerative clustering on embeddings).
   - Group card IDs into discrete cluster bins ($C_1, C_2, \dots, C_k$).
   - Identify unclustered outlier cards into an "Uncategorized Notes" cluster.
2. **LLM Thematic Naming Engine (`ml-service/utils/llm_client.py`)**:
   - For each cluster, collect card titles, extracted keywords, and summary snippets.
   - Send prompt to Groq (`llama-3.1-8b-instant`):
     ```
     Given the following card titles and summaries belonging to a semantic group:
     [Title 1, Title 2, Title 3...]
     Provide a concise, professional 2-to-4 word thematic title for this cluster (e.g. "Cloud Architecture", "Deep Learning Research").
     ```
   - Store or return the generated cluster titles.
3. **Smart Arrange Endpoints**:
   - `POST /arrange/smart-arrange` (ML Service): Executes clustering and LLM naming, returns clusters with member cards.
   - `GET /api/arrange/smart` (Backend): Authenticated gateway endpoint with optional caching.
4. **Smart Arrange Frontend View (`frontend/src/pages/SmartArrangePage.tsx`)**:
   - Visual layout organizing cards into distinct thematic sections/swimlanes.
   - Section header showing:
     - AI-generated cluster title with badge indicator (`AI Generated Theme`).
     - Card count in cluster.
     - Common tags shared in cluster.
   - Horizontal scroll or responsive grid for each thematic row.
   - "Regenerate Arrangement" action button with smooth loading state.
   - Filter/Focus on specific cluster.

### 5.4 Phase 5 Deliverables & Verification
- [x] Calling smart arrange endpoint successfully groups cards into coherent clusters.
- [x] Groq LLM generates concise, relevant titles for each cluster.
- [x] Frontend displays the Smart Arrange view with organized thematic sections.
- [x] Users can interact with cards directly from the arranged view (open, edit, inspect).

---

## 📌 Phase 6: Agentic RAG System, Hallucination Verification & End-to-End Hardening

### 6.1 Objective
Construct the Agentic Retrieval-Augmented Generation (RAG) assistant that queries user knowledge across both vector search and graph topology, answers complex questions with strict inline citations, performs automated self-verification to prevent hallucinations, and conducts end-to-end security and production hardening.

### 6.2 Prerequisites
- Phase 1 through 5 completed.
- Working Groq API key and fully indexed card corpus.

### 6.3 Detailed Step-by-Step Tasks
1. **Multi-Hop Agentic Retrieval Engine (`ml-service/services/agentic_rag.py`)**:
   - **Query Deconstruction & Intent Analysis**: Parse user question to determine intent and required domain context.
   - **Hybrid Candidate Retrieval**: Retrieve top-$k$ cards using vector similarity search + keyword matching.
   - **Graph Traversal Context Expansion**: Pull 1st-hop graph neighbors of the top retrieved cards to gather associative context that simple vector search misses.
   - **Re-ranking & Deduplication**: Rank context cards by fused similarity and centrality score; assemble structured prompt context.
2. **Groq Llama 3.1 Prompt Synthesis & Strict Citation Enforcement**:
   - Format prompt with system grounding rules:
     - Answer ONLY using the provided knowledge cards.
     - For every claim made, append exact citation markup: `[Card: <card_id> - <card_title>]`.
     - Explicitly state if the answer cannot be determined from the available cards.
   - Call Groq `llama-3.1-8b-instant` for low-latency streaming or synchronous completion.
3. **Automated Hallucination Verification Engine (`ml-service/services/verifier.py`)**:
   - Pass the synthesized answer and source card excerpts into a secondary verification prompt:
     ```
     Verify each statement in the following response against the provided context.
     Determine:
     1. Is every claim directly supported by the context? (true/false)
     2. Confidence score between 0.0 and 1.0.
     3. Identify any unsupported claims or hallucinations.
     Return strict JSON.
     ```
   - Calculate final confidence score and attach verification metadata to response.
4. **Backend RAG Gateway (`backend/src/routes/rag.routes.ts`)**:
   - `POST /api/rag/query`: Accepts question, conversation history, optional card filter.
   - Forwards request to ML service, maps card citations to full card metadata, returns answer, citations array, and verification status.
5. **Frontend AI Chat Assistant (`frontend/src/components/chat/` & `pages/ChatPage.tsx`)**:
   - Modern conversational UI with dark glassmorphism styling.
   - Rich Markdown answer rendering with syntax highlighting for code snippets.
   - Interactive Citation Badges:
     - Clickable pill badges embedded within answer text.
     - Clicking badge reveals preview modal of the cited source card.
   - Confidence Indicator: Visual badge showing verification confidence (e.g., `98% Grounded`, `Verified Sources`).
   - Quick prompt suggestions ("Summarize my notes on...", "What are the key concepts in...").
6. **Production Hardening, Security & System Polish**:
   - Security: Enable `helmet`, configure CORS origins, setup `express-rate-limit` on auth and ingestion routes.
   - Database Optimization: Verify `pgvector` HNSW indexes and FTS GIN indexes.
   - Error Handling: Graceful fallbacks if Groq API rate limits are hit (informative user messaging).
   - End-to-End Verification: Complete walkthrough testing of all 6 phases.

### 6.4 Phase 6 Deliverables & Verification
- [x] Asking a question about ingested documents returns a synthesized, grounded answer.
- [x] Response includes valid inline citations referencing specific cards.
- [x] Clicking a citation badge highlights or opens the exact source card modal.
- [x] Verification engine produces a confidence score and flags unsupported statements.
- [x] Rate limiting and security middleware protect APIs from abuse.
- [x] Complete system runs cleanly across frontend, backend, and ML service.

---

## 🚦 Instructions for Beginning Development

> **Important Workflow Protocol**:
> 1. The project must be implemented strictly **phase by phase**.
> 2. The user will specify which phase to begin (typically starting with **Phase 1**).
> 3. Each phase must be fully implemented, tested, and verified against its deliverables before advancing to the subsequent phase.
