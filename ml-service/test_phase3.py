import sys
import numpy as np
from fastapi.testclient import TestClient
from main import app

# Ensure utf-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

def run_tests():
    print("[TEST] Running Phase 3 Machine Learning Service Tests...")
    client = TestClient(app)

    # 1. Test Health Endpoint (supports lazy loading)
    print("\n--- 1. Testing GET /health ---")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    data = res.json()
    print("Health response:", data)
    assert data["status"] == "ok"
    assert data["model"]["dimension"] == 384
    assert isinstance(data["model"]["loaded"], bool)
    print("[PASS] GET /health verified!")

    # 2. Test POST /embed (Single Text)
    print("\n--- 2. Testing POST /embed (Single Text) ---")
    sample_text = "Transformers architecture with self-attention mechanism for natural language processing."
    res = client.post("/embed", json={"text": sample_text})
    assert res.status_code == 200, f"Embed failed: {res.text}"
    embed_data = res.json()
    embedding = embed_data["embedding"]
    assert len(embedding) == 384, f"Expected 384 dimensions, got {len(embedding)}"
    norm = np.linalg.norm(embedding)
    print(f"Generated single embedding: length={len(embedding)}, L2 norm={norm:.4f}")
    assert np.isclose(norm, 1.0, atol=1e-3), "Embedding should be normalized to unit length"

    # Verify model is now loaded in health check
    res_after = client.get("/health")
    assert res_after.json()["model"]["loaded"] is True, "Model should be loaded after embedding request"
    print("[PASS] POST /embed (Single Text) & post-load health verified!")

    # 3. Test POST /embed (Batch)
    print("\n--- 3. Testing POST /embed (Batch) ---")
    batch_texts = [
        "Convolutional neural networks for computer vision",
        "Recipe for homemade Italian pizza dough",
        "Gradient descent optimization in machine learning"
    ]
    res = client.post("/embed", json={"texts": batch_texts})
    assert res.status_code == 200, f"Batch embed failed: {res.text}"
    batch_data = res.json()
    embeddings = batch_data["embeddings"]
    assert len(embeddings) == 3
    for emb in embeddings:
        assert len(emb) == 384
    print(f"Generated {len(embeddings)} batch embeddings successfully!")
    print("[PASS] POST /embed (Batch) verified!")

    # 4. Semantic Similarity Validation
    print("\n--- 4. Semantic Similarity Discrimination Test ---")
    v_cnn = np.array(embeddings[0])
    v_pizza = np.array(embeddings[1])
    v_gd = np.array(embeddings[2])

    sim_ai = float(np.dot(v_cnn, v_gd))
    sim_unrelated = float(np.dot(v_cnn, v_pizza))

    print(f"Similarity (CNN vs Gradient Descent): {sim_ai:.4f}")
    print(f"Similarity (CNN vs Pizza Dough): {sim_unrelated:.4f}")

    assert sim_ai > sim_unrelated, "AI concepts should have higher similarity than pizza"
    assert sim_ai > 0.25 and sim_ai > 5 * sim_unrelated, "Related AI concepts should be significantly more similar than unrelated pizza dough"
    print("[PASS] Semantic similarity discrimination verified!")

    print("\n==========================================")
    print("[SUCCESS] ALL PHASE 3 VERIFICATION TESTS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    run_tests()
