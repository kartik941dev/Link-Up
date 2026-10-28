import sys
from fastapi.testclient import TestClient
from main import app
from services.verifier import hallucination_verifier
from services.agentic_rag import agentic_rag

# Ensure utf-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

def test_phase6_rag():
    print("[TEST] Running Phase 6 Agentic RAG & Hallucination Verification Tests...")
    client = TestClient(app)

    # 1. Health check & router verification
    print("\n--- 1. Testing GET /health ---")
    res = client.get("/health")
    assert res.status_code == 200
    print("[PASS] ML Service is up and responsive!")

    # 2. Test Hallucination Verifier Unit Logic
    print("\n--- 2. Testing Hallucination Self-Verification ---")
    mock_cards = [
        {
            "id": "11111111-2222-3333-4444-555555555555",
            "title": "PostgreSQL Vector Search with pgvector",
            "snippet": "pgvector adds vector similarity search capabilities using cosine, L2, and inner product distances."
        },
        {
            "id": "66666666-7777-8888-9999-000000000000",
            "title": "HNSW Index Performance",
            "snippet": "Hierarchical Navigable Small World (HNSW) indexes provide fast approximate nearest neighbor search."
        }
    ]

    grounded_answer = (
        "PostgreSQL supports vector similarity search using the pgvector extension with cosine and L2 distances "
        "[Card: 11111111-2222-3333-4444-555555555555 - PostgreSQL Vector Search with pgvector]. "
        "HNSW indexes provide approximate nearest neighbor query performance [Card: 66666666-7777-8888-9999-000000000000 - HNSW Index Performance]."
    )

    verif1 = hallucination_verifier.verify_answer(
        query="What index does pgvector use?",
        answer=grounded_answer,
        context_cards=mock_cards
    )
    print("Verification result (Grounded):", verif1)
    assert verif1["grounded"] is True
    assert verif1["confidence"] >= 0.70
    print("[PASS] Grounded answer verified with high confidence score!")

    hallucinated_answer = (
        "Quantum computing processors from IBM use superconducting qubits operating at near absolute zero temperatures. "
        "They utilize Shor's quantum factoring algorithm for cryptographic encryption."
    )

    verif2 = hallucination_verifier.verify_answer(
        query="Explain quantum computing",
        answer=hallucinated_answer,
        context_cards=mock_cards
    )
    print("Verification result (Hallucinated):", verif2)
    assert verif2["grounded"] is False or len(verif2.get("unsupported_claims", [])) > 0
    print("[PASS] Hallucination engine correctly detected unsupported claims!")

    # 3. Test Citation Extraction
    print("\n--- 3. Testing Citation Attribution Engine ---")
    citations = agentic_rag._extract_citations(grounded_answer, mock_cards)
    print("Extracted Citations:", [c["title"] for c in citations])
    assert len(citations) >= 1
    assert any("PostgreSQL" in c["title"] for c in citations)
    print("[PASS] Inline citations parsed accurately!")

    # 4. Test POST /rag/query Schema Validation
    print("\n--- 4. Testing POST /rag/query Validation ---")
    bad_req = client.post("/rag/query", json={"query": "test"})
    assert bad_req.status_code == 422, "Missing user_id must fail validation"
    print("[PASS] Schema validation on /rag/query verified!")

    print("\n🎉 ALL PHASE 6 MACHINE LEARNING & RAG TESTS PASSED!")

if __name__ == "__main__":
    test_phase6_rag()
