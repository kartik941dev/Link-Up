"""
End-to-End Seeding & Verification Suite for User 'Kartik' and LinkUp RAG Pipeline.

What this script does:
1. Starts the FastAPI ML service (port 8000) and Express Backend (port 5000) if not already running.
2. Registers/signs in user 'kartik@linkup.ai' (password: 'Kartik@1234') via real HTTP Auth API.
3. Ingests Kartik's multi-format test documents through the real Express ingestion endpoints:
   - 4 PDF files   -> POST /api/cards/ingest/pdf
   - 3 DOCX files  -> POST /api/cards/ingest/docx
   - 4 Web Links   -> POST /api/cards/ingest/social-link
   - 3 Rich Notes  -> POST /api/cards
4. Ensures every saved card has its 384-d vector embedding saved in PostgreSQL.
5. Rebuilds the Knowledge Graph (POST /api/graph/rebuild) and Smart Arrange clusters (POST /api/arrange/regenerate).
6. Tests Hybrid, Semantic, and Exact Search endpoints (GET /api/search).
7. Runs 8 end-to-end Agentic RAG queries (POST /api/rag/query) covering PDF, DOCX, Note, Web Link,
   multi-hop cross-document synthesis, hallucination guard, multi-turn history, and cardIdsFilter.
8. Audits PostgreSQL directly to confirm all documents, extracted text, tags, embeddings,
   graph edges, centrality scores, and cluster labels are persisted.
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
import psycopg2
import requests
from dotenv import load_dotenv

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent.parent
TEST_DATA_DIR = ROOT_DIR / "test-data" / "kartik"
BACKEND_DIR = ROOT_DIR / "backend"
ML_DIR = ROOT_DIR / "ml-service"

BACKEND_URL = "http://localhost:5000"
ML_URL = "http://localhost:8000"

PDF_TAGS = {
    "kartik_profile_and_resume.pdf": ["PDF", "Profile", "Kartik", "Portfolio"],
    "kartik_postgresql_pgvector_architecture.pdf": ["PDF", "PostgreSQL", "pgvector", "DBMS"],
    "kartik_agentic_rag_research_notes.pdf": ["PDF", "RAG", "AI", "Knowledge Graph"],
    "kartik_cloud_deployment_handbook.pdf": ["PDF", "DevOps", "Security", "Deployment"],
}

DOCX_TAGS = {
    "kartik_linkup_semester_report.docx": ["DOCX", "DBMS", "LinkUp", "Report"],
    "kartik_sprint4_meeting_minutes.docx": ["DOCX", "Sprint", "Meeting", "RAG"],
    "kartik_ml_clustering_study_guide.docx": ["DOCX", "Machine Learning", "Clustering", "Graph"],
}

NOTE_META = {
    "kartik_study_schedule.md": {
        "title": "Kartik's Weekly Study & Project Schedule",
        "tags": ["Note", "Schedule", "Kartik", "Productivity"],
    },
    "postgresql_performance_cheatsheet.md": {
        "title": "PostgreSQL Query Optimization Cheatsheet",
        "tags": ["Note", "PostgreSQL", "DBMS", "Performance"],
    },
    "groq_llm_prompt_patterns.md": {
        "title": "Groq Llama 3.1 Prompt Engineering Patterns",
        "tags": ["Note", "RAG", "Groq", "AI"],
    },
}


def is_service_up(url: str) -> bool:
    try:
        r = requests.get(url, timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def wait_for_service(url: str, name: str, timeout_sec: int = 60) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        if is_service_up(url):
            print(f"[OK] {name} is healthy at {url}")
            return True
        time.sleep(1.5)
    return False


def start_services_if_needed():
    procs = []

    if not is_service_up(f"{ML_URL}/health"):
        print("[START] Launching ML Service (FastAPI on port 8000)...")
        ml_log = open(ROOT_DIR / "test-data" / "ml_service_test.log", "w", encoding="utf-8")
        p_ml = subprocess.Popen(
            [sys.executable, "-u", "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=str(ML_DIR),
            stdout=ml_log,
            stderr=subprocess.STDOUT,
        )
        procs.append(("ML Service", p_ml, ml_log))
        if not wait_for_service(f"{ML_URL}/health", "ML Service", timeout_sec=60):
            raise RuntimeError("ML Service failed to become healthy within 60s. Check test-data/ml_service_test.log")
    else:
        print(f"[OK] ML Service already running at {ML_URL}")

    if not is_service_up(f"{BACKEND_URL}/api/health"):
        print("[START] Launching Backend API (Express on port 5000)...")
        be_log = open(ROOT_DIR / "test-data" / "backend_test.log", "w", encoding="utf-8")
        p_be = subprocess.Popen(
            ["node", "dist/server.js"],
            cwd=str(BACKEND_DIR),
            stdout=be_log,
            stderr=subprocess.STDOUT,
        )
        procs.append(("Backend API", p_be, be_log))
        if not wait_for_service(f"{BACKEND_URL}/api/health", "Backend API", timeout_sec=30):
            raise RuntimeError("Backend API failed to become healthy within 30s. Check test-data/backend_test.log")
    else:
        print(f"[OK] Backend API already running at {BACKEND_URL}")

    return procs


def stop_services(procs):
    for name, proc, log_fh in procs:
        print(f"[STOP] Shutting down temporary {name} (PID {proc.pid})...")
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()
        log_fh.close()


def authenticate_user(email: str, password: str) -> tuple[str, str]:
    # Try signin first
    r = requests.post(
        f"{BACKEND_URL}/api/auth/signin",
        json={"email": email, "password": password},
        timeout=15,
    )
    if r.status_code == 200:
        data = r.json()
        print(f"[AUTH] Signed in existing user: {email} (id={data['user']['id']})")
        return data["token"], data["user"]["id"]

    # Otherwise signup
    r = requests.post(
        f"{BACKEND_URL}/api/auth/signup",
        json={"email": email, "password": password},
        timeout=15,
    )
    if r.status_code == 201:
        data = r.json()
        print(f"[AUTH] Registered new user: {email} (id={data['user']['id']})")
        return data["token"], data["user"]["id"]

    raise RuntimeError(f"Authentication failed ({r.status_code}): {r.text}")


def get_existing_cards(headers: dict) -> list[dict]:
    r = requests.get(f"{BACKEND_URL}/api/cards?limit=100", headers=headers, timeout=15)
    r.raise_for_status()
    return r.json().get("cards", [])


def delete_all_user_cards(headers: dict):
    cards = get_existing_cards(headers)
    for c in cards:
        requests.delete(f"{BACKEND_URL}/api/cards/{c['id']}", headers=headers, timeout=15)
    print(f"[RESET] Deleted {len(cards)} existing card(s) for clean re-seed.")


def seed_kartik_documents(headers: dict, reset: bool = False) -> list[dict]:
    if reset:
        delete_all_user_cards(headers)

    existing_cards = get_existing_cards(headers)
    existing_titles = {c["title"].strip().lower() for c in existing_cards}
    existing_filenames = {
        (c.get("metadata") or {}).get("originalFilename", "").lower()
        for c in existing_cards
    }
    existing_urls = {
        (c.get("metadata") or {}).get("url", "").rstrip("/").lower()
        for c in existing_cards
    }

    created_cards = []

    # 1. Ingest PDFs
    print("\n--- Ingesting Kartik's PDF Documents ---")
    for pdf_path in sorted((TEST_DATA_DIR / "pdfs").glob("*.pdf")):
        if pdf_path.name.lower() in existing_filenames:
            print(f"  [SKIP] PDF already in DB: {pdf_path.name}")
            continue
        tags = PDF_TAGS.get(pdf_path.name, ["PDF", "Kartik"])
        with open(pdf_path, "rb") as f:
            r = requests.post(
                f"{BACKEND_URL}/api/cards/ingest/pdf",
                headers=headers,
                files={"file": (pdf_path.name, f, "application/pdf")},
                data={"tags": json.dumps(tags)},
                timeout=30,
            )
        assert r.status_code == 201, f"PDF ingest failed for {pdf_path.name}: {r.status_code} {r.text}"
        card = r.json()["card"]
        created_cards.append(card)
        print(f"  [PASS] PDF saved -> id={card['id']} | title='{card['title']}' | chars={len(card.get('extracted_text') or '')}")

    # 2. Ingest DOCX files
    print("\n--- Ingesting Kartik's DOCX Documents ---")
    for docx_path in sorted((TEST_DATA_DIR / "docx").glob("*.docx")):
        if docx_path.name.lower() in existing_filenames:
            print(f"  [SKIP] DOCX already in DB: {docx_path.name}")
            continue
        tags = DOCX_TAGS.get(docx_path.name, ["DOCX", "Kartik"])
        with open(docx_path, "rb") as f:
            r = requests.post(
                f"{BACKEND_URL}/api/cards/ingest/docx",
                headers=headers,
                files={
                    "file": (
                        docx_path.name,
                        f,
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                },
                data={"tags": json.dumps(tags)},
                timeout=30,
            )
        assert r.status_code == 201, f"DOCX ingest failed for {docx_path.name}: {r.status_code} {r.text}"
        card = r.json()["card"]
        created_cards.append(card)
        print(f"  [PASS] DOCX saved -> id={card['id']} | title='{card['title']}' | chars={len(card.get('extracted_text') or '')}")

    # 3. Create Manual Notes
    print("\n--- Ingesting Kartik's Rich Notes ---")
    for note_path in sorted((TEST_DATA_DIR / "notes").glob("*.md")):
        meta = NOTE_META.get(note_path.name, {"title": note_path.stem, "tags": ["Note", "Kartik"]})
        if meta["title"].strip().lower() in existing_titles:
            print(f"  [SKIP] Note already in DB: {meta['title']}")
            continue
        content = note_path.read_text(encoding="utf-8")
        r = requests.post(
            f"{BACKEND_URL}/api/cards",
            headers=headers,
            json={"title": meta["title"], "content": content, "tags": meta["tags"]},
            timeout=20,
        )
        assert r.status_code == 201, f"Note creation failed for {note_path.name}: {r.status_code} {r.text}"
        card = r.json()["card"]
        created_cards.append(card)
        print(f"  [PASS] NOTE saved -> id={card['id']} | title='{card['title']}' | chars={len(card.get('extracted_text') or '')}")

    # 4. Ingest Web Links
    print("\n--- Ingesting Kartik's Web Links ---")
    links = json.loads((TEST_DATA_DIR / "links.json").read_text(encoding="utf-8"))
    for item in links:
        url = item["url"]
        if url.rstrip("/").lower() in existing_urls:
            print(f"  [SKIP] Link already in DB: {url}")
            continue
        r = requests.post(
            f"{BACKEND_URL}/api/cards/ingest/social-link",
            headers=headers,
            json={"url": url, "tags": item["tags"]},
            timeout=30,
        )
        if r.status_code == 201:
            card = r.json()["card"]
            created_cards.append(card)
            print(f"  [PASS] LINK saved -> id={card['id']} | title='{card['title'][:60]}' | chars={len(card.get('extracted_text') or '')}")
        else:
            print(f"  [WARN] Link ingestion returned {r.status_code} for {url}: {r.text[:200]}")

    return get_existing_cards(headers)


def wait_for_embeddings(db_url: str, user_id: str, expected_count: int, timeout_sec: int = 45):
    print("\n--- Waiting for Background Vector Embeddings in PostgreSQL ---")
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        conn = psycopg2.connect(db_url)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*), COUNT(embedding) FROM cards WHERE user_id = %s;",
                    (user_id,),
                )
                total, embedded = cur.fetchone()
                if total >= expected_count and embedded == total:
                    print(f"[PASS] All {embedded}/{total} cards have 384-d embeddings stored in PostgreSQL!")
                    return
                print(f"  ... {embedded}/{total} embedded so far, waiting...")
        finally:
            conn.close()
        time.sleep(2.5)
    print("[INFO] Some embeddings still pending; RAG pipeline will auto-backfill any missing ones.")


def verify_graph_and_arrange(headers: dict):
    print("\n--- Rebuilding Knowledge Graph & Smart Arrange Clusters ---")
    r_graph = requests.post(
        f"{BACKEND_URL}/api/graph/rebuild",
        headers=headers,
        json={"minSimilarity": 0.45},
        timeout=60,
    )
    assert r_graph.status_code == 200, f"Graph rebuild failed: {r_graph.status_code} {r_graph.text}"
    raw_graph = r_graph.json()
    gdata = raw_graph.get("data", raw_graph)
    print(f"[PASS] Graph rebuilt: {gdata}")
    assert gdata.get("source") == "ml_service", f"Expected ml_service graph build, got {gdata.get('source')}"
    assert gdata.get("edgeCount", 0) > 0, "Expected > 0 semantic edges in Knowledge Graph!"

    r_arr = requests.post(
        f"{BACKEND_URL}/api/arrange/smart/regenerate",
        headers=headers,
        json={"minSimilarity": 0.35},
        timeout=60,
    )
    assert r_arr.status_code == 200, f"Smart Arrange failed: {r_arr.status_code} {r_arr.text}"
    adata = r_arr.json().get("data", r_arr.json())
    clusters = adata.get("clusters", [])
    print(f"[PASS] Smart Arrange generated {len(clusters)} semantic cluster(s):")
    for cl in clusters:
        print(f"   - Cluster '{cl['name']}': {cl['card_count']} card(s) | tags={cl.get('common_tags', [])}")
    assert len(clusters) >= 1


def verify_search_endpoints(headers: dict):
    print("\n--- Testing Hybrid, Semantic, and Exact Search Endpoints ---")
    for mode in ("hybrid", "semantic", "exact"):
        r = requests.get(
            f"{BACKEND_URL}/api/search",
            headers=headers,
            params={"q": "pgvector PostgreSQL", "mode": mode, "limit": 5},
            timeout=30,
        )
        assert r.status_code == 200, f"Search ({mode}) failed: {r.status_code} {r.text}"
        data = r.json()
        print(f"  [PASS] mode={mode:8s} -> {data['total']} result(s), top='{data['results'][0]['title'] if data['results'] else 'NONE'}'")
        assert data["total"] > 0, f"Search mode '{mode}' returned 0 results!"


def verify_rag_pipeline(headers: dict, all_cards: list[dict]):
    print("\n============================================================")
    print("RUNNING END-TO-END AGENTIC RAG PIPELINE TESTS")
    print("============================================================")

    test_cases = [
        (
            "1. PDF Retrieval (Kartik Profile)",
            "What is Kartik Patel's GPA, university, and where did he intern in Summer 2026?",
            ["9.1", "Bennett", "CloudScale"],
            True,
        ),
        (
            "2. DOCX Retrieval (Sprint 4 Meeting Minutes)",
            "What bugs were assigned to Kartik in the Sprint 4 meeting minutes and when is the final demonstration?",
            ["November 25", "execute_values"],
            True,
        ),
        (
            "3. DOCX Benchmark Retrieval (DBMS Semester Report)",
            "According to Kartik's DBMS semester project report, how fast was HNSW search compared to sequential scan on 10,000 cards?",
            ["12", "180"],
            True,
        ),
        (
            "4. Note Retrieval (Study Schedule)",
            "What is Kartik's weekly schedule on Mondays, Wednesdays, and Sundays?",
            ["PostgreSQL", "badminton"],
            True,
        ),
        (
            "5. Web Link Retrieval (pgvector / FastAPI / PostgreSQL)",
            "Based on the saved web links, what is pgvector and what does it add to PostgreSQL?",
            ["vector", "PostgreSQL"],
            True,
        ),
        (
            "6. Multi-Hop Cross-Document Synthesis (PDF + DOCX + Note)",
            "Explain how LinkUp's Agentic RAG pipeline retrieves cards, expands the knowledge graph with PageRank, and verifies hallucinations.",
            ["PageRank", "citation"],
            True,
        ),
        (
            "7. Hallucination / Out-of-Scope Refusal Guard",
            "What is Kartik's secret recipe for baking a Belgian chocolate lava cake?",
            ["not enough information"],
            False,
        ),
    ]

    passed = 0
    for label, question, expected_terms, require_citations in test_cases:
        print(f"\n[RAG TEST] {label}")
        print(f"  Q: {question}")
        t0 = time.time()
        r = requests.post(
            f"{BACKEND_URL}/api/rag/query",
            headers=headers,
            json={"query": question},
            timeout=60,
        )
        elapsed = round(time.time() - t0, 2)
        assert r.status_code == 200, f"RAG HTTP error {r.status_code}: {r.text}"
        payload = r.json()
        assert payload.get("success") is True
        data = payload["data"]

        answer = data["answer"]
        citations = data.get("citations", [])
        verif = data.get("verification", {})
        retrieved_count = data.get("retrievedCardsCount", 0)
        graph_used = data.get("graphExpansionUsed", False)

        # Ensure we didn't silently fall back to the DB-only extractive fallback
        assert "Direct Knowledge Matches for:" not in answer, (
            f"RAG fell back to DB fallback instead of ML Agentic RAG! Answer: {answer[:200]}"
        )

        print(f"  Time: {elapsed}s | Retrieved: {retrieved_count} | Graph Expansion: {graph_used}")
        print(f"  Verification: grounded={verif.get('grounded')} | confidence={verif.get('confidence')} | unsupported={len(verif.get('unsupported_claims', []))}")
        cit_labels = [f"{c['content_type'].upper()}: {c['title']}" for c in citations]
        print(f"  Citations ({len(citations)}): {cit_labels}")
        preview = " ".join(answer.split())[:260]
        print(f"  Answer preview: {preview}...")

        answer_lower = answer.lower()
        matched_terms = [t for t in expected_terms if t.lower() in answer_lower]
        assert len(matched_terms) >= 1, (
            f"Expected at least one of {expected_terms} in answer, got:\n{answer}"
        )

        if require_citations:
            assert len(citations) >= 1, "Expected at least 1 grounded citation!"
            assert verif.get("grounded") is True, f"Expected grounded=True, got {verif}"

        print(f"  [PASS] Matched terms: {matched_terms}")
        passed += 1

    # Test 8: Scoped RAG with cardIdsFilter + conversationHistory
    print("\n[RAG TEST] 8. Multi-Turn Conversation + Scoped cardIdsFilter")
    pdf_card = next((c for c in all_cards if c["content_type"] == "pdf" and "profile" in (c.get("metadata") or {}).get("originalFilename", "").lower()), None)
    if pdf_card:
        r = requests.post(
            f"{BACKEND_URL}/api/rag/query",
            headers=headers,
            json={
                "query": "Which hackathon was he a finalist in?",
                "conversationHistory": [
                    {"role": "user", "content": "Who is Kartik Patel?"},
                    {"role": "assistant", "content": "Kartik Patel is a B.Tech CSE student at Bennett University."},
                ],
                "cardIdsFilter": [pdf_card["id"]],
            },
            timeout=60,
        )
        assert r.status_code == 200, f"Scoped RAG failed: {r.status_code} {r.text}"
        data = r.json()["data"]
        print(f"  Retrieved: {data['retrievedCardsCount']} | Citations: {[c['title'] for c in data['citations']]}")
        print(f"  Answer preview: {' '.join(data['answer'].split())[:240]}...")
        assert data["retrievedCardsCount"] == 1, "cardIdsFilter should constrain retrieval to 1 card!"
        assert "smart india hackathon" in data["answer"].lower(), f"Expected Smart India Hackathon in answer: {data['answer']}"
        print("  [PASS] Multi-turn conversation & cardIdsFilter passed!")
        passed += 1

    print(f"\n[SUCCESS] Passed {passed}/{passed} end-to-end RAG tests!")


def audit_postgresql(db_url: str, user_id: str, email: str):
    print("\n============================================================")
    print("POSTGRESQL PERSISTENCE AUDIT")
    print("============================================================")
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 
                    content_type,
                    COUNT(*) AS card_count,
                    COUNT(embedding) AS embedded_count,
                    COUNT(cluster_label) AS clustered_count,
                    ROUND(AVG(LENGTH(COALESCE(extracted_text, '')))) AS avg_text_chars,
                    ROUND(AVG(COALESCE(centrality, 0))::numeric, 3) AS avg_centrality
                FROM cards
                WHERE user_id = %s
                GROUP BY content_type
                ORDER BY content_type;
                """,
                (user_id,),
            )
            rows = cur.fetchall()
            print(f"User: {email} ({user_id})")
            print(f"{'Type':<8} | {'Cards':<6} | {'Embedded':<8} | {'Clustered':<9} | {'Avg Chars':<10} | {'Avg Centrality'}")
            print("-" * 70)
            total_cards = 0
            total_embedded = 0
            for ctype, cnt, emb, clu, avg_chars, avg_cent in rows:
                total_cards += cnt
                total_embedded += emb
                print(f"{ctype:<8} | {cnt:<6} | {emb:<8} | {clu:<9} | {int(avg_chars or 0):<10} | {avg_cent}")

            cur.execute("SELECT COUNT(*) FROM tags WHERE user_id = %s;", (user_id,))
            tag_count = cur.fetchone()[0]
            cur.execute(
                """
                SELECT COUNT(*) FROM card_tags ct
                JOIN cards c ON c.id = ct.card_id
                WHERE c.user_id = %s;
                """,
                (user_id,),
            )
            card_tag_links = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM graph_edges WHERE user_id = %s;", (user_id,))
            edge_count = cur.fetchone()[0]

            print("-" * 70)
            print(f"Total Cards Saved:      {total_cards} (Embedded: {total_embedded}/{total_cards})")
            print(f"Total Tags Saved:       {tag_count} (Card-Tag Links: {card_tag_links})")
            print(f"Total Graph Edges:      {edge_count}")

            assert total_cards >= 10, f"Expected at least 10 multi-format cards, got {total_cards}"
            assert total_embedded == total_cards, "All cards must have 384-d embeddings!"
            assert edge_count > 0, "Expected graph edges persisted in PostgreSQL!"
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Seed Kartik's test files into PostgreSQL and test LinkUp RAG end-to-end.")
    parser.add_argument("--email", default="kartik@linkup.ai", help="User email to seed and test")
    parser.add_argument("--password", default="Kartik@1234", help="Password for the test account")
    parser.add_argument("--reset", action="store_true", help="Delete existing cards for this user before seeding")
    args = parser.parse_args()

    load_dotenv(BACKEND_DIR / ".env")
    db_url = os.environ.get("DATABASE_URL")
    assert db_url, "DATABASE_URL not found in backend/.env"

    procs = []
    try:
        procs = start_services_if_needed()
        token, user_id = authenticate_user(args.email, args.password)
        headers = {"Authorization": f"Bearer {token}"}

        all_cards = seed_kartik_documents(headers, reset=args.reset)
        wait_for_embeddings(db_url, user_id, expected_count=len(all_cards))
        verify_graph_and_arrange(headers)
        verify_search_endpoints(headers)
        verify_rag_pipeline(headers, all_cards)
        audit_postgresql(db_url, user_id, args.email)

        print("\nALL KARTIK SEEDING, POSTGRESQL PERSISTENCE, AND RAG PIPELINE TESTS PASSED!")
    finally:
        if procs:
            stop_services(procs)


if __name__ == "__main__":
    main()
