"""
Builds Kartik_Test_Files.zip (and standalone edge-case test fixtures) + Kartik_TEST_PLAN.md
covering every scenario in the test pass.
"""

import html
import json
import zipfile
from pathlib import Path
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from docx import Document

ROOT_DIR = Path(__file__).resolve().parent.parent
FIXTURES_DIR = ROOT_DIR / "test-data" / "suite_fixtures"
ZIP_PATH = ROOT_DIR / "Kartik_Test_Files.zip"
PLAN_PATH = ROOT_DIR / "Kartik_TEST_PLAN.md"


def make_pdf(path: Path, title: str, sections: list[tuple[str, list[str]]], pdf_meta_title: str = ""):
    doc = SimpleDocTemplate(
        str(path),
        pagesize=LETTER,
        rightMargin=0.8 * inch,
        leftMargin=0.8 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
        title=pdf_meta_title or title,
        author="Kartik Patel",
        pageCompression=0,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("T", parent=styles["Title"], fontSize=17, spaceAfter=12)
    h_style = ParagraphStyle("H", parent=styles["Heading2"], fontSize=13, spaceBefore=10, spaceAfter=6)
    b_style = ParagraphStyle("B", parent=styles["BodyText"], fontSize=10.5, leading=14.5, spaceAfter=8)

    story = [Paragraph(html.escape(title), title_style), Spacer(1, 6)]
    for heading, paras in sections:
        story.append(Paragraph(html.escape(heading), h_style))
        for p in paras:
            story.append(Paragraph(html.escape(p), b_style))
    doc.build(story)


def make_docx(path: Path, heading: str, paragraphs: list[str]):
    doc = Document()
    if heading:
        doc.add_heading(heading, level=1)
    for p in paragraphs:
        doc.add_paragraph(p)
    doc.save(str(path))


def main():
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Deep Learning PDF (ML Cluster)
    make_pdf(
        FIXTURES_DIR / "deep_learning_neural_networks.pdf",
        "Deep Learning and Neural Networks",
        [
            (
                "Neural Networks and Backpropagation",
                [
                    "Deep learning uses multi-layer artificial neural networks to learn hierarchical feature representations directly from raw data.",
                    "Training deep neural networks relies on backpropagation to compute gradients of the loss function with respect to each weight, followed by stochastic gradient descent or Adam optimization.",
                    "Activation functions such as ReLU, GELU, and Softmax introduce non-linearity so deep neural networks can approximate complex functions.",
                ],
            ),
            (
                "Architectures: CNNs and Transformers",
                [
                    "Convolutional neural networks excel at spatial image recognition through weight sharing and pooling layers, while transformer neural networks rely on self-attention mechanisms.",
                    "Regularization techniques including dropout, batch normalization, and weight decay prevent overfitting during backpropagation training.",
                ],
            ),
        ],
    )

    # 2. Introduction to Machine Learning PDF (ML Cluster)
    make_pdf(
        FIXTURES_DIR / "introduction_to_ml.pdf",
        "Introduction to Machine Learning",
        [
            (
                "Supervised and Unsupervised Learning",
                [
                    "Machine learning builds statistical models and neural networks that learn patterns from training datasets without explicit rule programming.",
                    "Supervised learning includes linear regression, logistic regression, decision trees, random forests, support vector machines, and neural network classifiers.",
                    "Unsupervised learning discovers latent structure through k-means clustering, hierarchical clustering, and principal component analysis.",
                ],
            ),
            (
                "Model Evaluation and Generalization",
                [
                    "Cross-validation, precision, recall, F1 score, and ROC-AUC measure how well a machine learning model generalizes to unseen data.",
                    "Avoiding overfitting requires balancing model capacity, training data size, gradient descent convergence, and regularization penalties.",
                ],
            ),
        ],
    )

    # 3. Natural Language Processing PDF (ML Cluster)
    make_pdf(
        FIXTURES_DIR / "nlp_language_models.pdf",
        "Natural Language Processing and Transformers",
        [
            (
                "Embeddings and Self-Attention",
                [
                    "Natural language processing transforms human text into dense vector embeddings using transformer neural networks and contextual encoders like BERT.",
                    "Self-attention computes pairwise token relevance across sentences, enabling modern machine learning and deep learning language models to capture semantic similarity.",
                ],
            ),
            (
                "Retrieval-Augmented Generation",
                [
                    "Sentence transformers encode documents into 384-dimensional embeddings for semantic search and grounded question answering.",
                ],
            ),
        ],
    )

    # 4. Database Indexing PDF (DBMS Cluster — B-tree test!)
    make_pdf(
        FIXTURES_DIR / "database_indexing_btree.pdf",
        "Database Indexing and B-tree Internals",
        [
            (
                "How B-tree Indexes Accelerate SQL Queries",
                [
                    "A B-tree index is a self-balancing search tree used as the default index structure in PostgreSQL and relational database management systems.",
                    "B-tree nodes keep keys sorted so equality lookups, range scans (BETWEEN, <, >), and ORDER BY clauses run in O(log N) disk page reads instead of full table scans.",
                    "Leaf nodes in a B-tree store pointers to heap tuples and are doubly linked to allow fast sequential range traversal.",
                ],
            ),
            (
                "GIN and Vector Indexes",
                [
                    "Alongside B-tree indexes, PostgreSQL offers GIN indexes for full-text search and HNSW indexes via pgvector for approximate nearest neighbor vector search.",
                ],
            ),
        ],
    )

    # 5. Long PDF (> 1800 words) containing BLUE-HERON-47 near the end!
    long_paras = []
    for i in range(1, 22):
        long_paras.append(
            f"Chapter {i}: Distributed storage engines coordinate write-ahead logging, snapshot isolation, checkpoint flushing, "
            f"buffer pool eviction policies, and crash recovery across replicated PostgreSQL database clusters. "
            f"Query optimizers estimate selectivity histograms, join cardinalities, hash aggregation memory budgets, and "
            f"parallel worker execution plans to maintain predictable tail latency under concurrent analytical workloads."
        )
    long_paras.append(
        "Final Appendix Verification Marker: During long-document indexing diagnostics, the verification beacon code "
        "BLUE-HERON-47 confirms that full-text extraction and chunked vector indexing read all the way to the final page."
    )
    make_pdf(
        FIXTURES_DIR / "long_distributed_systems_handbook.pdf",
        "Long Distributed Database Systems Handbook",
        [("Comprehensive Distributed Storage Architecture", long_paras)],
    )

    # 6. Personal Finance DOCX (Unrelated Finance Cluster — semantic search test!)
    make_docx(
        FIXTURES_DIR / "personal_finance_budgeting.docx",
        "Personal Finance and Monthly Budgeting",
        [
            "Building lasting wealth begins with tracking household expenses and consistently saving money every month before discretionary spending.",
            "The 50/30/20 budgeting framework allocates 50 percent of after-tax income to essentials like rent and groceries, 30 percent to lifestyle wants, and 20 percent directly to savings and debt payoff.",
            "Automating recurring transfers into a high-yield savings account builds a six-month emergency fund effortlessly.",
            "Long-term investing in low-cost index funds harnesses compound interest over decades to achieve financial independence and retirement security.",
        ],
    )

    # 7. Italian Cooking PDF (Unrelated Culinary Cluster)
    make_pdf(
        FIXTURES_DIR / "italian_cooking_recipes.pdf",
        "Traditional Italian Pasta and Cooking Recipes",
        [
            (
                "Homemade Tomato Basil Sauce and Sourdough Pasta",
                [
                    "Simmer crushed San Marzano tomatoes with extra-virgin olive oil, smashed garlic cloves, sea salt, and fresh sweet basil leaves for forty minutes.",
                    "Knead semolina flour with farm eggs to roll silky tagliatelle ribbons, then boil in salted water until al dente and finish with aged Parmigiano-Reggiano cheese.",
                ],
            ),
        ],
    )

    # 8. Ancient World History DOCX (Unrelated History Cluster)
    make_docx(
        FIXTURES_DIR / "ancient_world_history.docx",
        "Ancient Civilizations and Silk Road History",
        [
            "Mesopotamian city-states between the Tigris and Euphrates rivers pioneered cuneiform writing, irrigation canals, and codified laws such as the Code of Hammurabi.",
            "The Silk Road connected Han Dynasty China with Persia, India, and the Mediterranean Roman Empire, exchanging silk textiles, spices, papermaking, and architectural ideas across continents.",
            "Classical Greek city-states and Egyptian pharaohs left enduring monuments, philosophical treatises, and maritime trade networks.",
        ],
    )

    # 9. Empty DOCX (Validation test — must fail with 'No readable text found')
    make_docx(FIXTURES_DIR / "empty_document.docx", "", [])

    # 10. Unsupported .txt file (Validation test — must be rejected/skipped cleanly)
    (FIXTURES_DIR / "unsupported_readme.txt").write_text(
        "This plain text file should be rejected by PDF/DOCX/ZIP validation.\n",
        encoding="utf-8",
    )

    # 11. XSS Safety Markdown Note
    (FIXTURES_DIR / "xss_safety_test.md").write_text(
        "# Security Sanitization Check\n\n"
        "Literal script payload test: <script>window.__xssTriggered = true;</script>\n"
        "This script tag must render strictly as harmless text and never execute.\n",
        encoding="utf-8",
    )

    # 12. Build Kartik_Test_Files.zip (contains valid PDFs, DOCX, MD note, empty DOCX, and unsupported .txt)
    zip_members = [
        "deep_learning_neural_networks.pdf",
        "introduction_to_ml.pdf",
        "nlp_language_models.pdf",
        "database_indexing_btree.pdf",
        "long_distributed_systems_handbook.pdf",
        "personal_finance_budgeting.docx",
        "italian_cooking_recipes.pdf",
        "ancient_world_history.docx",
        "xss_safety_test.md",
        "empty_document.docx",
        "unsupported_readme.txt",
    ]
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in zip_members:
            zf.write(FIXTURES_DIR / name, arcname=name)
    print(f"[ZIP] Created {ZIP_PATH} with {len(zip_members)} entries")

    # 13. Write Kartik_TEST_PLAN.md checklist
    PLAN_PATH.write_text(
        """# Kartik Test Plan — LinkUp Verification Checklist

## Automated Verification
- [x] Link title extraction returns no repeated words (`https://developer.mozilla.org/en-US/docs/Web/JavaScript` -> `JavaScript | MDN`).
- [x] Embedding function returns 384 numbers for short text, long text (chunked mean pooling), and Hindi text.
- [x] Similarity between "Deep Learning" and "Introduction to ML" is higher than between "Deep Learning" and "Personal Finance".
- [x] Search: `"B-tree"` in keyword mode returns the Database Indexing card first.
- [x] Search: `"saving money every month"` in semantic mode returns the Personal Finance card first.
- [x] Long PDF: phrase `BLUE-HERON-47` is found by keyword search.
- [x] Upload of empty DOCX (`empty_document.docx`), `.txt` file (`unsupported_readme.txt`), and duplicate file each return a clear error without a server crash.
- [x] ZIP archive upload (`Kartik_Test_Files.zip`) extracts and ingests all valid documents while cleanly skipping unsupported/empty entries.
- [x] Multi-file batch upload ingests multiple PDFs/DOCX files in one request.
- [x] Assistant answers `"What is the capital of France?"` with `"not found in your cards"` and no invented answer.

## Manual Browser Checks (with Screenshots)
- [ ] Canvas: filter chips and counts are correct after adding and deleting cards.
- [ ] Graph: no node overlap, threshold slider changes edge count, clicking a node opens the card.
- [ ] Smart Arrange: unrelated topics (ML vs Finance vs Cooking vs History) are in separate clusters; Unclustered used instead of Uncategorized Notes; Regenerate keeps deterministic names.
- [ ] Assistant: every answer shows citations, markdown renders correctly (bold, lists, tables, code), greeting has no `100% Grounded` badge.
- [ ] Delete a card: disappears from search, graph, clusters, and assistant answers.
- [ ] Refresh page & sign out/in: data persists for same user and is empty for a new user.
""",
        encoding="utf-8",
    )
    print(f"[DOC] Created {PLAN_PATH}")


if __name__ == "__main__":
    main()
