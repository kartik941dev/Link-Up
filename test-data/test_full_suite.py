"""
Comprehensive Automated Test Suite (pytest) covering ZIP/batch upload + Tasks 1-9 + Test Pass.

Run with:
    pytest test-data/test_full_suite.py -v
"""

import json
import os
import sys
import uuid
from pathlib import Path
import numpy as np
import pytest
import requests

ROOT_DIR = Path(__file__).resolve().parent.parent
FIXTURES_DIR = ROOT_DIR / "test-data" / "suite_fixtures"
ZIP_PATH = ROOT_DIR / "Kartik_Test_Files.zip"
ML_DIR = ROOT_DIR / "ml-service"

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5000")
ML_URL = os.environ.get("ML_URL", "http://localhost:8000")

# Add ml-service to sys.path for direct embedding unit tests
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))


@pytest.fixture(scope="module")
def test_user():
    """Creates a clean isolated test user for the full end-to-end integration test pass."""
    email = f"pytest_kartik_{uuid.uuid4().hex[:8]}@linkup.ai"
    password = "TestPassword@1234"
    res = requests.post(
        f"{BACKEND_URL}/api/auth/signup",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert res.status_code == 201, f"Signup failed: {res.status_code} {res.text}"
    data = res.json()
    return {
        "email": email,
        "password": password,
        "id": data["user"]["id"],
        "token": data["token"],
        "headers": {"Authorization": f"Bearer {data['token']}"},
    }


def _cosine(a, b) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(np.dot(va, vb) / denom) if denom > 0 else 0.0


# ------------------------------------------------------------------
# 1. Link Title & Description Cleaning (Task 1)
# ------------------------------------------------------------------
def test_01_link_title_mdn_no_repeated_words(test_user):
    url = "https://developer.mozilla.org/en-US/docs/Web/JavaScript"
    res = requests.post(
        f"{BACKEND_URL}/api/cards/ingest/social-link",
        headers=test_user["headers"],
        json={"url": url, "tags": []},
        timeout=30,
    )
    assert res.status_code == 201, f"MDN ingest failed: {res.status_code} {res.text}"
    card = res.json()["card"]
    title = card["title"]
    desc = card.get("raw_content") or (card.get("metadata") or {}).get("description", "")

    assert "MDNMDN" not in title, f"Repeated site name still in title: {title}"
    assert "Mozilla" not in title or title.count("MDN") == 1, f"Duplicated site name in title: {title}"
    assert "JavaScript" in title and "MDN" in title, f"Unexpected MDN title: {title}"
    assert not desc.lower().startswith("javascript javascript"), f"Duplicated leading words in desc: {desc}"
    assert "\n" not in desc, f"Description should be one-line: {desc}"

    # Verify duplicate URL is rejected cleanly with 409
    dup = requests.post(
        f"{BACKEND_URL}/api/cards/ingest/social-link",
        headers=test_user["headers"],
        json={"url": url, "tags": []},
        timeout=20,
    )
    assert dup.status_code == 409, f"Expected 409 duplicate URL warning, got {dup.status_code}: {dup.text}"


# ------------------------------------------------------------------
# 2. Embeddings: 384 numbers for short, long, and Hindi text (Task 4)
# ------------------------------------------------------------------
def test_02_embeddings_short_long_and_hindi():
    short_text = "PostgreSQL indexing with B-tree and pgvector."
    long_text = " ".join(
        [f"Distributed database architecture section {i} covering MVCC, WAL, and indexing." for i in range(150)]
    )
    hindi_text = "कृत्रिम बुद्धिमत्ता और मशीन लर्निंग आधुनिक डेटाबेस खोज को बेहतर बनाते हैं।"

    for label, txt in [("short", short_text), ("long", long_text), ("hindi", hindi_text)]:
        r = requests.post(f"{ML_URL}/embed", json={"text": txt}, timeout=30)
        assert r.status_code == 200, f"Embed failed for {label}: {r.text}"
        emb = r.json()["embedding"]
        assert isinstance(emb, list) and len(emb) == 384, f"{label} embedding must have 384 numbers"
        assert all(isinstance(x, (int, float)) for x in emb)
        norm = float(np.linalg.norm(emb))
        assert 0.98 <= norm <= 1.02, f"{label} embedding should be unit-normalized (norm={norm})"


# ------------------------------------------------------------------
# 3. Semantic Similarity Ordering (Task 4)
# ------------------------------------------------------------------
def test_03_similarity_deep_learning_vs_ml_vs_finance():
    texts = [
        "Deep Learning: artificial neural networks, backpropagation, convolutional layers, and gradient descent.",
        "Introduction to Machine Learning: supervised models, regression, classification, and neural networks.",
        "Personal Finance: saving money every month, household budgeting, emergency fund, and retirement.",
    ]
    r = requests.post(f"{ML_URL}/embed", json={"texts": texts}, timeout=30)
    assert r.status_code == 200
    embs = r.json()["embeddings"]
    sim_dl_ml = _cosine(embs[0], embs[1])
    sim_dl_fin = _cosine(embs[0], embs[2])
    assert sim_dl_ml > sim_dl_fin, (
        f"Expected sim(Deep Learning, ML)={sim_dl_ml:.3f} > sim(Deep Learning, Finance)={sim_dl_fin:.3f}"
    )


# ------------------------------------------------------------------
# 4. ZIP Upload + Clean Titles + Real Auto-Tags (Feature 0, Tasks 5 & 6)
# ------------------------------------------------------------------
def test_04_zip_upload_clean_titles_and_auto_tags(test_user):
    assert ZIP_PATH.exists(), f"Missing {ZIP_PATH}; run build_kartik_test_zip.py first"

    with open(ZIP_PATH, "rb") as f:
        res = requests.post(
            f"{BACKEND_URL}/api/cards/ingest/zip",
            headers=test_user["headers"],
            files={"file": ("Kartik_Test_Files.zip", f, "application/zip")},
            timeout=120,
        )
    assert res.status_code == 201, f"ZIP ingest failed: {res.status_code} {res.text}"
    body = res.json()
    cards = body["cards"]
    skipped = body["skipped"]

    # 9 valid files in ZIP should be ingested; empty_document.docx & unsupported_readme.txt should be skipped
    assert len(cards) >= 9, f"Expected >= 9 cards from ZIP, got {len(cards)}. Skipped: {skipped}"
    skipped_names = {s["filename"] for s in skipped}
    assert "empty_document.docx" in skipped_names
    assert "unsupported_readme.txt" in skipped_names

    # Verify clean titles (no .pdf/.docx extensions, no underscores) and real auto-tags (no file-type/generic tags)
    noise = {"pdf", "docx", "doc", "note", "link", "web link", "documentation", "research", "article"}
    dl_card = None
    for c in cards:
        assert not c["title"].lower().endswith((".pdf", ".docx", ".md")), f"Extension left in title: {c['title']}"
        assert "_" not in c["title"], f"Underscore left in title: {c['title']}"
        tag_names = [t["name"].lower() for t in (c.get("tags") or [])]
        assert len(tag_names) >= 2, f"Expected >= 2 content auto-tags for '{c['title']}', got {tag_names}"
        for tn in tag_names:
            assert tn not in noise, f"Noise tag '{tn}' should not appear on card '{c['title']}'"
        if "deep learning" in c["title"].lower():
            dl_card = c

    assert dl_card is not None, "Deep Learning PDF card not found in ZIP output"
    dl_tags = [t["name"].lower() for t in dl_card["tags"]]
    assert any(
        any(k in t for k in ("neural", "backpropagation", "deep", "gradient", "network"))
        for t in dl_tags
    ), f"Expected domain keywords on Deep Learning PDF, got {dl_tags}"


# ------------------------------------------------------------------
# 5. Multi-file Same-Type Batch Upload (Feature 0)
# ------------------------------------------------------------------
def test_05_multi_file_pdf_batch_upload(test_user):
    # Create a separate fresh user so files are not flagged as duplicates from test_04
    email = f"pytest_batch_{uuid.uuid4().hex[:8]}@linkup.ai"
    r_auth = requests.post(
        f"{BACKEND_URL}/api/auth/signup",
        json={"email": email, "password": "TestPassword@1234"},
        timeout=15,
    )
    assert r_auth.status_code == 201
    headers = {"Authorization": f"Bearer {r_auth.json()['token']}"}

    pdf1 = FIXTURES_DIR / "deep_learning_neural_networks.pdf"
    pdf2 = FIXTURES_DIR / "introduction_to_ml.pdf"
    with open(pdf1, "rb") as f1, open(pdf2, "rb") as f2:
        res = requests.post(
            f"{BACKEND_URL}/api/cards/ingest/pdf/batch",
            headers=headers,
            files=[
                ("files", (pdf1.name, f1, "application/pdf")),
                ("files", (pdf2.name, f2, "application/pdf")),
            ],
            timeout=60,
        )
    assert res.status_code == 201, f"Batch PDF upload failed: {res.status_code} {res.text}"
    data = res.json()
    assert len(data["cards"]) == 2


# ------------------------------------------------------------------
# 6. Validation & Error Cases (Task 9)
# ------------------------------------------------------------------
def test_06_validation_empty_docx_txt_duplicate_and_bad_urls(test_user):
    headers = test_user["headers"]

    # Empty DOCX -> 400 with "No readable text found"
    with open(FIXTURES_DIR / "empty_document.docx", "rb") as f:
        r_empty = requests.post(
            f"{BACKEND_URL}/api/cards/ingest/docx",
            headers=headers,
            files={"file": ("empty_document.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
            timeout=20,
        )
    assert r_empty.status_code == 400, f"Expected 400 for empty DOCX, got {r_empty.status_code}: {r_empty.text}"
    assert "no readable text found" in r_empty.text.lower()

    # Unsupported .txt file -> 400 clear error
    with open(FIXTURES_DIR / "unsupported_readme.txt", "rb") as f:
        r_txt = requests.post(
            f"{BACKEND_URL}/api/cards/ingest/pdf",
            headers=headers,
            files={"file": ("unsupported_readme.txt", f, "text/plain")},
            timeout=20,
        )
    assert r_txt.status_code == 400, f"Expected 400 for .txt upload, got {r_txt.status_code}: {r_txt.text}"
    assert "unsupported file type" in r_txt.text.lower()

    # Duplicate file upload -> 409 warning
    with open(FIXTURES_DIR / "deep_learning_neural_networks.pdf", "rb") as f:
        r_dup = requests.post(
            f"{BACKEND_URL}/api/cards/ingest/pdf",
            headers=headers,
            files={"file": ("deep_learning_neural_networks.pdf", f, "application/pdf")},
            timeout=20,
        )
    assert r_dup.status_code == 409, f"Expected 409 for duplicate PDF, got {r_dup.status_code}: {r_dup.text}"
    assert "duplicate" in r_dup.text.lower()

    # Invalid URL schemes (javascript:, ftp:) and unreachable URL
    for bad_url in ["javascript:alert(1)", "ftp://example.com/file.pdf", "not a valid url"]:
        r_bad = requests.post(
            f"{BACKEND_URL}/api/cards/ingest/social-link",
            headers=headers,
            json={"url": bad_url},
            timeout=15,
        )
        assert r_bad.status_code == 400, f"Expected 400 for bad URL '{bad_url}', got {r_bad.status_code}"

    r_unreach = requests.post(
        f"{BACKEND_URL}/api/cards/ingest/social-link",
        headers=headers,
        json={"url": "https://nonexistent-domain-xyz-99999.invalid/page"},
        timeout=20,
    )
    assert r_unreach.status_code == 400, f"Expected 400 for unreachable URL, got {r_unreach.status_code}"


# ------------------------------------------------------------------
# 7. Search Tests: B-tree (keyword), saving money (semantic), BLUE-HERON-47 (long PDF)
# ------------------------------------------------------------------
def test_07_search_keyword_semantic_and_long_pdf(test_user):
    headers = test_user["headers"]

    # Trigger graph rebuild (ensures embeddings are flushed & graph built)
    # Wait briefly if any background embeddings are finishing by hitting RAG/embed backfill or checking
    r_rag_warm = requests.post(
        f"{BACKEND_URL}/api/rag/query",
        headers=headers,
        json={"query": "What is a B-tree index?"},
        timeout=60,
    )
    assert r_rag_warm.status_code == 200

    # Keyword search: "B-tree" -> Database Indexing card first
    r_kw = requests.get(
        f"{BACKEND_URL}/api/search",
        headers=headers,
        params={"q": "B-tree", "mode": "exact", "limit": 5},
        timeout=20,
    )
    assert r_kw.status_code == 200
    kw_results = r_kw.json()["results"]
    assert len(kw_results) >= 1
    assert "database indexing" in kw_results[0]["title"].lower(), (
        f"Expected Database Indexing card first for 'B-tree', got '{kw_results[0]['title']}'"
    )

    # Semantic search: "saving money every month" -> Personal Finance card first
    r_sem = requests.get(
        f"{BACKEND_URL}/api/search",
        headers=headers,
        params={"q": "saving money every month", "mode": "semantic", "limit": 5},
        timeout=20,
    )
    assert r_sem.status_code == 200
    sem_results = r_sem.json()["results"]
    assert len(sem_results) >= 1
    assert "personal finance" in sem_results[0]["title"].lower(), (
        f"Expected Personal Finance card first for semantic query, got '{sem_results[0]['title']}'"
    )

    # Long PDF keyword search: "BLUE-HERON-47"
    r_long = requests.get(
        f"{BACKEND_URL}/api/search",
        headers=headers,
        params={"q": "BLUE-HERON-47", "mode": "exact", "limit": 5},
        timeout=20,
    )
    assert r_long.status_code == 200
    long_results = r_long.json()["results"]
    assert len(long_results) >= 1, "BLUE-HERON-47 was not found in long PDF!"
    assert "distributed" in long_results[0]["title"].lower()


# ------------------------------------------------------------------
# 8. Knowledge Graph Connections & Smart Arrange Stability (Tasks 4 & 7)
# ------------------------------------------------------------------
def test_08_graph_connections_and_smart_arrange(test_user):
    headers = test_user["headers"]

    r_build = requests.post(
        f"{BACKEND_URL}/api/graph/rebuild",
        headers=headers,
        json={"minSimilarity": 0.45},
        timeout=60,
    )
    assert r_build.status_code == 200

    r_g45 = requests.get(f"{BACKEND_URL}/api/graph?minSimilarity=0.45", headers=headers, timeout=20)
    assert r_g45.status_code == 200
    g45 = r_g45.json()["data"]
    id_to_title = {n["id"]: n["title"].lower() for n in g45["nodes"]}
    links45 = g45["links"]
    assert len(links45) >= 2, f"Expected related ML/DB connections at 45%, got {len(links45)}"

    # Check ML cards are linked, and Finance is NOT linked to Cooking or Deep Learning
    edge_pairs = {(id_to_title[l["source"]], id_to_title[l["target"]]) for l in links45}
    has_ml_link = any(
        ("deep learning" in a and ("machine learning" in b or "natural language" in b))
        or ("deep learning" in b and ("machine learning" in a or "natural language" in a))
        for a, b in edge_pairs
    )
    assert has_ml_link, f"Expected Deep Learning to connect to ML/NLP! Pairs: {edge_pairs}"

    has_bad_link = any(
        ("personal finance" in a and ("cooking" in b or "history" in b))
        or ("personal finance" in b and ("cooking" in a or "history" in a))
        for a, b in edge_pairs
    )
    assert not has_bad_link, f"Unrelated domains should not be linked! Pairs: {edge_pairs}"

    # Verify slider threshold change changes edge count
    r_g80 = requests.get(f"{BACKEND_URL}/api/graph?minSimilarity=0.80", headers=headers, timeout=20)
    assert len(r_g80.json()["data"]["links"]) <= len(links45)

    # Smart Arrange: Unclustered naming + deterministic Regenerate
    r_arr1 = requests.post(f"{BACKEND_URL}/api/arrange/smart/regenerate", headers=headers, json={}, timeout=60)
    assert r_arr1.status_code == 200
    clusters1 = r_arr1.json()["data"]["clusters"]
    names1 = sorted(c["name"] for c in clusters1)
    assert "Uncategorized Notes" not in names1, f"Old label 'Uncategorized Notes' still present: {names1}"

    r_arr2 = requests.post(f"{BACKEND_URL}/api/arrange/smart/regenerate", headers=headers, json={}, timeout=60)
    assert r_arr2.status_code == 200
    names2 = sorted(c["name"] for c in r_arr2.json()["data"]["clusters"])
    assert names1 == names2, f"Regenerate renamed clusters when nothing changed: {names1} vs {names2}"


# ------------------------------------------------------------------
# 9. Assistant Out-of-Scope Refusal & Dynamic Suggestions (Tasks 8 & 9)
# ------------------------------------------------------------------
def test_09_assistant_refusal_and_dynamic_suggestions(test_user):
    headers = test_user["headers"]

    # Dynamic suggestions should reflect user's own tags/clusters
    r_sug = requests.get(f"{BACKEND_URL}/api/rag/suggestions", headers=headers, timeout=15)
    assert r_sug.status_code == 200
    sug_data = r_sug.json()["data"]
    assert sug_data["hasCards"] is True
    assert len(sug_data["suggestions"]) >= 1

    # Out-of-scope question: "What is the capital of France?" -> "not found in your cards" & no "Paris"
    r_oos = requests.post(
        f"{BACKEND_URL}/api/rag/query",
        headers=headers,
        json={"query": "What is the capital of France?"},
        timeout=60,
    )
    assert r_oos.status_code == 200
    ans = r_oos.json()["data"]["answer"]
    cits = r_oos.json()["data"]["citations"]
    assert "not found in your cards" in ans.lower(), f"Expected 'not found in your cards', got: {ans}"
    assert "paris" not in ans.lower(), f"Assistant invented an answer (Paris): {ans}"
    assert len(cits) == 0, f"Expected 0 citations on out-of-scope refusal, got {cits}"


# ------------------------------------------------------------------
# 10. Delete Propagation Across Search, Graph, Clusters
# ------------------------------------------------------------------
def test_10_delete_card_removes_from_all_views(test_user):
    headers = test_user["headers"]
    r_cards = requests.get(f"{BACKEND_URL}/api/cards?limit=50", headers=headers, timeout=15)
    cards = r_cards.json()["cards"]
    cooking_card = next((c for c in cards if "cooking" in c["title"].lower() or "pasta" in c["title"].lower()), None)
    assert cooking_card is not None

    r_del = requests.delete(f"{BACKEND_URL}/api/cards/{cooking_card['id']}", headers=headers, timeout=15)
    assert r_del.status_code == 200

    # Must not appear in keyword search
    r_srch = requests.get(
        f"{BACKEND_URL}/api/search",
        headers=headers,
        params={"q": "San Marzano", "mode": "exact"},
        timeout=15,
    )
    assert all(res["id"] != cooking_card["id"] for res in r_srch.json()["results"])

    # Must not appear in graph nodes
    r_graph = requests.get(f"{BACKEND_URL}/api/graph", headers=headers, timeout=15)
    assert all(n["id"] != cooking_card["id"] for n in r_graph.json()["data"]["nodes"])

    # Must not appear in Smart Arrange clusters
    r_arr = requests.get(f"{BACKEND_URL}/api/arrange/smart", headers=headers, timeout=15)
    all_cluster_card_ids = [
        c["id"] for cl in r_arr.json()["data"]["clusters"] for c in cl["cards"]
    ]
    assert cooking_card["id"] not in all_cluster_card_ids
