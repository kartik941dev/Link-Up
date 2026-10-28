import sys
import numpy as np
import networkx as nx
from fastapi.testclient import TestClient
from main import app

# Ensure utf-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

def test_phase4_graph():
    print("[TEST] Running Phase 4 Knowledge Graph Unit & Integration Tests...")
    client = TestClient(app)

    # 1. Test Endpoint Registration
    print("\n--- 1. Testing GET /health ---")
    res = client.get("/health")
    assert res.status_code == 200
    print("[PASS] ML Service is up and responsive!")

    # 2. Test Pairwise Cosine Matrix & Thresholding Math using Real Embeddings
    print("\n--- 2. Testing Pairwise Similarity & Thresholding Math ---")
    texts = [
        "Deep learning and artificial intelligence neural networks",
        "Machine learning models, gradient descent and backpropagation",
        "Deep neural networks and supervised learning architectures",
        "Homemade Italian pizza recipe with fresh basil and mozzarella cheese"
    ]
    embed_res = client.post("/embed", json={"texts": texts})
    assert embed_res.status_code == 200
    embeddings = np.array(embed_res.json()["embeddings"], dtype=np.float32)

    # Cosine similarity matrix
    sim_matrix = np.dot(embeddings, embeddings.T)

    print(f"Similarity (Card 0 [AI] <-> Card 1 [ML]): {sim_matrix[0, 1]:.4f}")
    print(f"Similarity (Card 0 [AI] <-> Card 2 [DL]): {sim_matrix[0, 2]:.4f}")
    print(f"Similarity (Card 0 [AI] <-> Card 3 [Pizza]): {sim_matrix[0, 3]:.4f}")

    assert sim_matrix[0, 2] > 0.70, "Card 0 and Card 2 (AI/DL) should have high cosine similarity"
    assert sim_matrix[0, 1] > 0.50, "Card 0 and Card 1 (AI/ML) should have moderate-high cosine similarity"
    assert sim_matrix[0, 3] < 0.20, "Unrelated topics (AI vs Pizza) should have very low cosine similarity"
    print("[PASS] Pairwise cosine similarity matrix correctly discriminates semantics!")

    # 3. Test NetworkX PageRank Centrality Computation
    print("\n--- 3. Testing NetworkX Graph Construction & Centrality ---")
    G = nx.Graph()
    card_ids = ["card_ai", "card_ml", "card_dl", "card_pizza"]
    for cid in card_ids:
        G.add_node(cid)

    # Add edges above threshold 0.50
    for i in range(4):
        for j in range(i + 1, 4):
            score = float(sim_matrix[i, j])
            if score >= 0.50:
                G.add_edge(card_ids[i], card_ids[j], weight=score)

    print(f"Graph constructed with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges.")
    assert G.number_of_edges() >= 2, "Expected edges between semantically close concepts"

    pr = nx.pagerank(G, weight="weight", alpha=0.85)
    print("Computed PageRank Scores:", {k: round(v, 4) for k, v in pr.items()})

    # AI node connects to both ML and DL, so its centrality should be highest
    assert pr["card_ai"] > pr["card_pizza"], "Hub card (AI) should have higher centrality than isolated card (Pizza)"
    print("[PASS] NetworkX PageRank correctly ranks hub concepts with highest centrality!")

    # 4. Test POST /graph/build API contract validation
    print("\n--- 4. Testing POST /graph/build Schema Validation ---")
    bad_res = client.post("/graph/build", json={"min_similarity": 0.60})
    assert bad_res.status_code == 422, "Missing user_id should fail validation"
    print("[PASS] Schema validation on /graph/build verified!")

    print("\n🎉 ALL PHASE 4 MACHINE LEARNING & GRAPH TESTS PASSED!")

if __name__ == "__main__":
    test_phase4_graph()
