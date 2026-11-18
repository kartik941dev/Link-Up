"""
Generates a comprehensive, realistic set of test documents for user 'Kartik':
- 4 multi-section PDF documents (via ReportLab)
- 3 formatted DOCX documents (via python-docx)
- 3 Markdown/text notes
- 1 links.json manifest of real technical web URLs

All files are written into: test-data/kartik/
"""

import html
import json
import os
from pathlib import Path
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from docx import Document

BASE_DIR = Path(__file__).resolve().parent / "kartik"
PDF_DIR = BASE_DIR / "pdfs"
DOCX_DIR = BASE_DIR / "docx"
NOTES_DIR = BASE_DIR / "notes"


def ensure_dirs():
    for d in (PDF_DIR, DOCX_DIR, NOTES_DIR):
        d.mkdir(parents=True, exist_ok=True)


def create_pdf(filename: str, title: str, author: str, sections: list[tuple[str, list[str]]]):
    output_path = PDF_DIR / filename
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=LETTER,
        rightMargin=0.85 * inch,
        leftMargin=0.85 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.85 * inch,
        title=title,
        author=author,
        pageCompression=0,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Title"],
        fontSize=18,
        spaceAfter=14,
    )
    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "BodyTextCustom",
        parent=styles["BodyText"],
        fontSize=10.5,
        leading=15,
        spaceAfter=8,
    )

    story = [Paragraph(html.escape(title), title_style), Paragraph(f"Author: {html.escape(author)}", styles["Italic"]), Spacer(1, 10)]
    for heading, paragraphs in sections:
        story.append(Paragraph(html.escape(heading), heading_style))
        for p in paragraphs:
            story.append(Paragraph(html.escape(p), body_style))

    doc.build(story)
    print(f"[PDF]  Created {output_path.relative_to(BASE_DIR.parent.parent)}")


def create_docx(filename: str, title: str, sections: list[tuple[str, list[str]]]):
    output_path = DOCX_DIR / filename
    doc = Document()
    doc.add_heading(title, level=0)
    doc.add_paragraph("Prepared by: Kartik Patel | Workspace: LinkUp Knowledge Management")

    for heading, paragraphs in sections:
        doc.add_heading(heading, level=1)
        for p in paragraphs:
            if p.startswith("- "):
                doc.add_paragraph(p[2:], style="List Bullet")
            else:
                doc.add_paragraph(p)

    doc.save(str(output_path))
    print(f"[DOCX] Created {output_path.relative_to(BASE_DIR.parent.parent)}")


def create_note(filename: str, content: str):
    output_path = NOTES_DIR / filename
    output_path.write_text(content.strip() + "\n", encoding="utf-8")
    print(f"[NOTE] Created {output_path.relative_to(BASE_DIR.parent.parent)}")


def main():
    ensure_dirs()

    # ---------------------------------------------------------
    # 1. PDF DOCUMENTS
    # ---------------------------------------------------------
    create_pdf(
        filename="kartik_profile_and_resume.pdf",
        title="Kartik Patel - Technical Profile and Project Portfolio",
        author="Kartik Patel",
        sections=[
            (
                "1. Personal Summary & Education",
                [
                    "Kartik Patel is a final-year B.Tech Computer Science and Engineering student at Bennett University (Enrollment ID: E23CSEU1724) with a cumulative GPA of 9.1 out of 10.0.",
                    "His primary academic focus areas are Database Management Systems (DBMS), Distributed Backend Engineering, Information Retrieval, and Applied Machine Learning.",
                    "During Summer 2026, Kartik completed a Backend & AI Engineering Internship at CloudScale Analytics in Bengaluru, where he built high-throughput PostgreSQL ingestion pipelines and semantic search microservices.",
                ],
            ),
            (
                "2. Flagship Project: LinkUp Intelligent Knowledge Management",
                [
                    "LinkUp is Kartik's capstone DBMS project designed to unify personal notes, PDF research papers, Word documents (DOCX), and web bookmarks into a single queryable knowledge graph.",
                    "The backend API is written in TypeScript using Node.js and Express, storing all structured data and 384-dimensional dense vector embeddings in Neon Serverless PostgreSQL with the pgvector extension.",
                    "The companion Python FastAPI ML microservice runs SentenceTransformers (all-MiniLM-L6-v2), NetworkX PageRank centrality, Louvain community detection for Smart Arrange clustering, and an Agentic RAG pipeline powered by Groq Llama 3.1 with automated hallucination verification.",
                ],
            ),
            (
                "3. Core Technical Skills & Achievements",
                [
                    "Languages: TypeScript, JavaScript, Python, SQL, C++. Frameworks: Node.js, Express, FastAPI, React, Vite.",
                    "Databases & AI: PostgreSQL, pgvector, Neon Cloud DB, Full-Text Search (GIN), SentenceTransformers, Groq LLM API, NetworkX, Scikit-learn.",
                    "Achievements: Smart India Hackathon 2025 National Finalist, Bennett University Dean's List for 5 consecutive semesters, and open-source contributor to pgvector tooling.",
                ],
            ),
        ],
    )

    create_pdf(
        filename="kartik_postgresql_pgvector_architecture.pdf",
        title="PostgreSQL Internals, Indexing and pgvector Architecture Guide",
        author="Kartik Patel",
        sections=[
            (
                "1. Relational Storage & ACID Guarantees",
                [
                    "PostgreSQL ensures full ACID compliance (Atomicity, Consistency, Isolation, Durability) through Multi-Version Concurrency Control (MVCC) and Write-Ahead Logging (WAL).",
                    "In LinkUp's PostgreSQL schema, six core tables organize knowledge data: users, cards, tags, card_tags, graph_edges, and migrations. All child records cascade cleanly on delete via foreign key constraints.",
                ],
            ),
            (
                "2. Indexing Strategies: B-Tree, GIN, and pgvector",
                [
                    "B-Tree indexes accelerate primary key lookups, user_id filtering (idx_cards_user_id), and chronological sorting on created_at DESC.",
                    "Generalized Inverted Indexes (GIN) power PostgreSQL Full-Text Search over coalesce(title, '') || ' ' || coalesce(extracted_text, '') using English stemming via to_tsvector and plainto_tsquery.",
                    "The pgvector extension introduces the vector(384) column type and cosine distance operator (<=>). Cosine similarity is computed directly inside SQL as 1 - (embedding <=> query_vector).",
                ],
            ),
            (
                "3. Connection Pooling on Neon Serverless PostgreSQL",
                [
                    "Neon Serverless PostgreSQL suspends idle compute endpoints automatically to save cost. Therefore, backend clients must configure TCP keepalives and validate pooled connections before executing queries.",
                    "In LinkUp, Node.js uses pg.Pool with max=20 connections and SSL enabled, while Python uses psycopg2 SimpleConnectionPool with keepalives_idle=30 seconds and automatic stale-connection recovery.",
                ],
            ),
        ],
    )

    create_pdf(
        filename="kartik_agentic_rag_research_notes.pdf",
        title="Agentic RAG, Graph Expansion and Hallucination Verification Notes",
        author="Kartik Patel",
        sections=[
            (
                "1. Hybrid Retrieval Pipeline",
                [
                    "Pure semantic vector search can miss exact identifiers such as course codes, function names, or dates, whereas pure keyword search misses conceptual synonyms.",
                    "LinkUp solves this using hybrid retrieval in PostgreSQL: combining pgvector cosine similarity (weight 0.75) with normalized ts_rank_cd full-text search scores (weight 0.25) to retrieve the top 8 candidate cards.",
                ],
            ),
            (
                "2. Multi-Hop Knowledge Graph Context Expansion",
                [
                    "After retrieving the primary vector candidates, the Agentic RAG engine inspects the graph_edges table to pull 1st-hop topological neighbors linked to the top 3 cards.",
                    "All candidate cards are re-ranked using a fused importance score: 0.65 * vector_similarity + 0.20 * normalized_text_rank + 0.15 * pagerank_centrality, selecting the top 6 cards as context for the LLM.",
                ],
            ),
            (
                "3. Grounded Synthesis & Hallucination Self-Verification",
                [
                    "The Groq Llama 3.1 generator receives up to 2,200 characters per retrieved card along with document type and source filename or URL, and is instructed to attach exact inline citations in the format [Card: <card_id> - <card_title>].",
                    "A second LLM judge pass (temperature 0.0) verifies every claim in the generated answer against the exact same 2,200-character source context snippets, returning a grounded boolean, a 0.0-to-1.0 confidence score, and any unsupported claims.",
                ],
            ),
        ],
    )

    create_pdf(
        filename="kartik_cloud_deployment_handbook.pdf",
        title="LinkUp Production Deployment and Security Handbook",
        author="Kartik Patel",
        sections=[
            (
                "1. Multi-Service Deployment Topology",
                [
                    "LinkUp consists of three decoupled services: the React + Vite frontend on port 5173 (deployed on Vercel), the Express TypeScript backend API on port 5000, and the Python FastAPI ML microservice on port 8000.",
                    "Both backend services connect to the same Neon Serverless PostgreSQL database so cards ingested via Express are immediately searchable by FastAPI vector and RAG endpoints.",
                ],
            ),
            (
                "2. Authentication, Password Hashing & File Upload Safety",
                [
                    "User authentication uses bcrypt with salt factor 10 for password hashing and HS256 JWT tokens with 24-hour expiration. Password reset tokens are 64-character cryptographically random hex strings valid for 15 minutes and emailed via Brevo.",
                    "PDF and DOCX uploads are handled in memory via Multer with a strict 25 MB file size limit and MIME/extension filtering. Web link ingestion enforces SSRF protection blocking localhost, loopback, and private RFC 1918 IP ranges.",
                ],
            ),
            (
                "3. Timeout and Reliability Guidelines",
                [
                    "Because cold-starting the SentenceTransformers model and running two Groq LLM passes (synthesis + verification) can take 10 to 25 seconds, HTTP timeouts between Frontend -> Backend -> ML Service must be set to at least 60 seconds for RAG queries.",
                ],
            ),
        ],
    )

    # ---------------------------------------------------------
    # 2. DOCX DOCUMENTS
    # ---------------------------------------------------------
    create_docx(
        filename="kartik_linkup_semester_report.docx",
        title="LinkUp DBMS Semester Project Final Report",
        sections=[
            (
                "Executive Overview",
                [
                    "Course: CSET301 Database Management Systems | Student: Kartik Patel | Faculty Advisor: Dr. Rajesh Sharma.",
                    "LinkUp addresses information fragmentation by ingesting notes, PDFs, DOCX files, and web articles into a unified PostgreSQL database enhanced with semantic vector embeddings and automated graph linking.",
                ],
            ),
            (
                "Database Schema & Normalization",
                [
                    "The schema is normalized to Third Normal Form (3NF) to prevent update anomalies:",
                    "- users(id UUID PK, email UNIQUE, password_hash, reset_password_token, reset_password_expires_at)",
                    "- cards(id UUID PK, user_id FK, title, content_type, raw_content, extracted_text, metadata JSONB, embedding vector(384), centrality FLOAT, cluster_label)",
                    "- tags(id UUID PK, user_id FK, name) and card_tags(card_id FK, tag_id FK) for many-to-many tagging",
                    "- graph_edges(id UUID PK, user_id FK, source_card_id FK, target_card_id FK, weight, similarity_score, edge_type, reason)",
                ],
            ),
            (
                "Benchmark Results",
                [
                    "On a benchmark dataset of 10,000 knowledge cards stored in PostgreSQL with pgvector, HNSW approximate nearest-neighbor queries completed in 12 milliseconds compared to 180 milliseconds for sequential cosine scans.",
                    "Hybrid search achieved 94% Recall@5 across mixed PDF, DOCX, Note, and Web Link queries, outperforming pure keyword search (71% Recall@5).",
                ],
            ),
        ],
    )

    create_docx(
        filename="kartik_sprint4_meeting_minutes.docx",
        title="LinkUp Sprint 4 Engineering Meeting Minutes (November 2026)",
        sections=[
            (
                "Meeting Details",
                [
                    "Date: November 18, 2026 | Lead Engineer: Kartik Patel | Reviewers: Dr. Rajesh Sharma and DBMS Lab TA.",
                    "Objective: Diagnose and resolve RAG pipeline issues and verify full end-to-end persistence in PostgreSQL ahead of the final project demonstration on November 25, 2026.",
                ],
            ),
            (
                "Bugs Identified & Assigned to Kartik",
                [
                    "- Fix psycopg2 execute_values placeholder bug in graph_builder.py and clusterer.py that prevented graph_edges and cluster_label from committing.",
                    "- Increase ML client and frontend Axios timeouts from 10s/15s to 60s so Agentic RAG queries do not fall back prematurely.",
                    "- Fix RAG database fallback query to use PostgreSQL Full-Text Search instead of matching the entire natural language question with ILIKE.",
                    "- Expand hallucination verifier context window from 350 characters to 2,200 characters so valid facts from multi-page PDFs and DOCX files are not falsely flagged.",
                    "- Fix off-by-one SQL LIMIT parameter index in search.routes.ts.",
                ],
            ),
            (
                "Next Milestone",
                [
                    "Populate Kartik's PostgreSQL workspace with multi-format test documents (PDF, DOCX, Notes, and Web Links) and execute automated end-to-end RAG verification tests.",
                ],
            ),
        ],
    )

    create_docx(
        filename="kartik_ml_clustering_study_guide.docx",
        title="Semantic Embeddings & Smart Arrange Clustering Study Guide",
        sections=[
            (
                "SentenceTransformers & Dense Vectors",
                [
                    "LinkUp uses the all-MiniLM-L6-v2 transformer model to convert card titles and extracted text into 384-dimensional unit-normalized vectors.",
                    "Because vectors are L2-normalized, the dot product between two vectors equals their exact cosine similarity in the range [-1.0, 1.0].",
                ],
            ),
            (
                "Knowledge Graph Construction & PageRank",
                [
                    "Edges are created between pairs of cards whose cosine similarity meets or exceeds the threshold (default 0.60, or 0.45 for dense topic exploration):",
                    "- Similarity >= 0.85: direct_reference",
                    "- Similarity >= 0.72: topic_cluster",
                    "- Similarity >= threshold: semantic_similarity",
                    "NetworkX computes weighted PageRank centrality (damping factor alpha = 0.85) and normalizes node importance to [0.1, 1.0].",
                ],
            ),
            (
                "Louvain Community Detection & Smart Arrange",
                [
                    "Smart Arrange builds a similarity graph (threshold 0.35) and applies Louvain community detection (seed=42) to partition cards into thematic clusters.",
                    "If no edges cross the threshold, it falls back to Agglomerative Clustering with cosine distance and average linkage. Isolated singletons are grouped under Uncategorized Notes.",
                    "Groq Llama 3.1 generates concise 2-to-4 word thematic cluster titles persisted into PostgreSQL cards.cluster_label.",
                ],
            ),
        ],
    )

    # ---------------------------------------------------------
    # 3. RICH NOTES (saved as .md reference files)
    # ---------------------------------------------------------
    create_note(
        "kartik_study_schedule.md",
        """# Kartik's Weekly Study & Project Schedule

- **Monday & Wednesday (7:00 PM - 9:00 PM)**: PostgreSQL query tuning, indexing experiments, and ER schema refinement.
- **Tuesday & Thursday (6:30 PM - 9:00 PM)**: FastAPI ML service development, SentenceTransformers benchmarking, and Agentic RAG evaluation.
- **Friday (5:00 PM - 7:30 PM)**: End-to-end testing, UI polish on React frontend, and demo dry runs for Dr. Rajesh Sharma.
- **Saturday (10:00 AM - 1:00 PM)**: Open-source contributions and writing technical documentation.
- **Sunday**: Rest, badminton practice at the Bennett University sports complex, and reading systems engineering blogs.
""",
    )

    create_note(
        "postgresql_performance_cheatsheet.md",
        """# PostgreSQL Query Optimization Cheatsheet

1. Always run `EXPLAIN (ANALYZE, BUFFERS)` before and after adding indexes to confirm index scans replace sequential scans.
2. Use GIN indexes on `to_tsvector('english', coalesce(title, '') || ' ' || coalesce(extracted_text, ''))` for fast full-text search.
3. For pgvector tables, use cosine distance `<=>` with normalized embeddings from `all-MiniLM-L6-v2` (384 dimensions).
4. Avoid returning huge `extracted_text` columns in list endpoints; use `SUBSTRING(COALESCE(extracted_text, raw_content, ''), 1, 280) AS snippet`.
5. Always use parameterized queries (`$1`, `$2` in Node `pg`, `%s` in Python `psycopg2`) to prevent SQL injection.
""",
    )

    create_note(
        "groq_llm_prompt_patterns.md",
        """# Groq Llama 3.1 Prompt Engineering Patterns for LinkUp RAG

- **Synthesis Temperature**: Use `temperature=0.2` with `max_tokens=1000` for concise, factual, markdown-structured answers.
- **Verification Temperature**: Use `temperature=0.0` with strict JSON output for the hallucination verification judge.
- **Strict Citation Format**: Enforce `[Card: <card_id> - <card_title>]` inline after every factual claim so the frontend `CitationBadge` component renders clickable pills.
- **Safe Refusal Rule**: Explicitly instruct the model to respond with *"Based on your knowledge cards, there is not enough information to answer this question."* whenever the retrieved context does not support an answer.
""",
    )

    # ---------------------------------------------------------
    # 4. WEB LINKS MANIFEST
    # ---------------------------------------------------------
    links_manifest = [
        {
            "url": "https://en.wikipedia.org/wiki/Retrieval-augmented_generation",
            "tags": ["RAG", "AI", "Research", "Web Link"],
            "description": "Wikipedia article explaining Retrieval-Augmented Generation (RAG) architecture and grounding.",
        },
        {
            "url": "https://en.wikipedia.org/wiki/PostgreSQL",
            "tags": ["PostgreSQL", "DBMS", "Database", "Web Link"],
            "description": "Wikipedia overview of PostgreSQL relational database architecture, MVCC, and extensibility.",
        },
        {
            "url": "https://fastapi.tiangolo.com/",
            "tags": ["FastAPI", "Python", "Backend", "Web Link"],
            "description": "Official FastAPI web framework documentation used for LinkUp's ML microservice.",
        },
        {
            "url": "https://github.com/pgvector/pgvector",
            "tags": ["pgvector", "PostgreSQL", "Vector Search", "Web Link"],
            "description": "Official pgvector GitHub repository for open-source vector similarity search in PostgreSQL.",
        },
    ]

    links_path = BASE_DIR / "links.json"
    links_path.write_text(json.dumps(links_manifest, indent=2) + "\n", encoding="utf-8")
    print(f"[LINK] Created {links_path.relative_to(BASE_DIR.parent.parent)}")
    print("\nAll Kartik test files generated successfully!")


if __name__ == "__main__":
    main()
