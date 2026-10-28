import sys
import numpy as np
from fastapi.testclient import TestClient
from main import app
from utils.llm_client import llm_client
from services.clusterer import smart_clusterer

# Ensure utf-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

def test_phase5_clustering():
    print("[TEST] Running Phase 5 Smart Arrange & Semantic Clustering Unit Tests...")
    client = TestClient(app)

    # 1. Health check & router mount verification
    print("\n--- 1. Testing GET /health ---")
    res = client.get("/health")
    assert res.status_code == 200
    print("[PASS] ML Service is up and responsive!")

    # 2. Test LLM / Heuristic Cluster Naming Engine
    print("\n--- 2. Testing Cluster Naming Engine ---")
    ml_titles = [
        "Convolutional Neural Networks for Image Classification",
        "Deep Residual Learning and ResNet Architectures",
        "Backpropagation and Gradient Descent Optimization"
    ]
    title1 = llm_client.generate_cluster_title(ml_titles, common_tags=["Deep Learning", "Vision"])
    print(f"Generated Cluster Title 1: '{title1}'")
    assert len(title1.strip()) > 0
    assert len(title1.split()) <= 6

    web_titles = [
        "React 19 Server Actions and Component Lifecycle",
        "Vite Build Optimization and Asset Bundling",
        "CSS Grid Layout and Glassmorphism Styling"
    ]
    title2 = llm_client.generate_cluster_title(web_titles, common_tags=["Frontend", "React"])
    print(f"Generated Cluster Title 2: '{title2}'")
    assert len(title2.strip()) > 0
    print("[PASS] Thematic cluster naming engine functions successfully!")

    # 3. Test Louvain / Semantic Clustering Logic with Mock Embeddings
    print("\n--- 3. Testing Semantic Clustering Math & Partitioning ---")
    texts = [
        "Deep learning transformer models and attention mechanisms",
        "Neural network training with backpropagation and PyTorch",
        "PostgreSQL relational database schema indexing and SQL queries",
        "Database normalization, ACID transactions and foreign keys",
        "Classic Italian Margherita pizza recipe with fresh dough and tomatoes"
    ]
    embed_res = client.post("/embed", json={"texts": texts})
    assert embed_res.status_code == 200
    embeddings = np.array(embed_res.json()["embeddings"], dtype=np.float32)

    # Check pairwise cosine similarities
    sim_matrix = np.dot(embeddings, embeddings.T)
    print(f"Sim(DL 0, DL 1): {sim_matrix[0, 1]:.3f} (Expected high)")
    print(f"Sim(DB 2, DB 3): {sim_matrix[2, 3]:.3f} (Expected high)")
    print(f"Sim(DL 0, Pizza 4): {sim_matrix[0, 4]:.3f} (Expected low)")
    print(f"Sim(DB 2, Pizza 4): {sim_matrix[2, 4]:.3f} (Expected low)")

    assert sim_matrix[0, 1] > 0.30, "DL concepts should cluster closely"
    assert sim_matrix[2, 3] > 0.30, "DB concepts should cluster closely"
    assert sim_matrix[0, 4] < 0.15, "DL and Pizza should not cluster"
    print("[PASS] Semantic vector space cleanly separates thematic clusters!")

    # 4. Test POST /arrange/smart-arrange schema validation
    print("\n--- 4. Testing POST /arrange/smart-arrange Validation ---")
    bad_req = client.post("/arrange/smart-arrange", json={})
    assert bad_req.status_code == 422, "Missing user_id should return 422 Unprocessable Entity"
    print("[PASS] Schema validation on /arrange/smart-arrange works correctly!")

    print("\n🎉 ALL PHASE 5 MACHINE LEARNING & CLUSTERING TESTS PASSED!")

if __name__ == "__main__":
    test_phase5_clustering()
