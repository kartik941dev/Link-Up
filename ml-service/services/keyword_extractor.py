"""
KeyBERT-style semantic keyword extractor using the local all-MiniLM-L6-v2 model.
Extracts 2 to 4 lowercase, deduplicated content keywords per document,
explicitly excluding file-type labels and generic filler words.
"""

import logging
import re
from collections import Counter
from typing import List
import numpy as np
from services.model_loader import model_loader

logger = logging.getLogger("ml_service.keyword_extractor")

GENERIC_AND_NOISE_WORDS = {
    # Stop words
    "a", "about", "above", "after", "again", "against", "all", "also", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
    "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself",
    "his", "how", "however", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "like",
    "make", "many", "may", "me", "more", "most", "much", "must", "my", "myself", "new", "no", "nor",
    "not", "now", "of", "off", "on", "once", "one", "only", "or", "other", "our", "ours", "ourselves",
    "out", "over", "own", "same", "see", "she", "should", "since", "so", "some", "still", "such",
    "take", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these",
    "they", "this", "those", "through", "to", "too", "two", "under", "until", "up", "use", "used",
    "using", "very", "was", "way", "we", "well", "were", "what", "when", "where", "which", "while",
    "who", "whom", "why", "will", "with", "within", "without", "would", "you", "your", "yours",
    # File-type & generic tags we must never emit
    "pdf", "docx", "doc", "txt", "zip", "note", "notes", "link", "web", "website", "url", "http",
    "https", "www", "com", "org", "html", "page", "site", "documentation", "document", "documents",
    "research", "article", "articles", "file", "files", "summary", "overview", "introduction",
    "guide", "manual", "chapter", "section", "example", "examples", "information", "content", "text",
    "data", "system", "systems", "project", "report", "study", "work", "time", "year", "years",
    "part", "first", "second", "third", "based", "include", "includes", "including", "provide",
    "provides", "different", "important", "common", "general", "various", "specific", "help", "helps",
}


def _extract_candidates(title: str, text: str, max_candidates: int = 35) -> List[str]:
    """Extracts clean 1-gram and 2-gram candidate phrases from title and body."""
    combined = f"{title}. {title}. {text[:6000]}"
    # Keep alphabetic / hyphenated tech terms (e.g., b-tree, pgvector, k-means, neural networks)
    raw_tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9-]{1,28}", combined.lower())
    clean_tokens = [
        t.strip("-") for t in raw_tokens
        if len(t.strip("-")) >= 3 and not t.isdigit()
    ]

    unigram_counts: Counter = Counter()
    bigram_counts: Counter = Counter()

    for idx, tok in enumerate(clean_tokens):
        if tok not in GENERIC_AND_NOISE_WORDS:
            unigram_counts[tok] += 1
        if idx + 1 < len(clean_tokens):
            nxt = clean_tokens[idx + 1]
            if (
                tok not in GENERIC_AND_NOISE_WORDS
                and nxt not in GENERIC_AND_NOISE_WORDS
                and tok != nxt
            ):
                bigram = f"{tok} {nxt}"
                bigram_counts[bigram] += 1

    # Prioritize repeated bigrams and high-frequency domain unigrams
    candidates: List[str] = []
    seen = set()

    for phrase, count in bigram_counts.most_common(22):
        if count >= 2 or phrase in title.lower():
            if phrase not in seen:
                candidates.append(phrase)
                seen.add(phrase)

    for word, _ in unigram_counts.most_common(25):
        if word not in seen:
            candidates.append(word)
            seen.add(word)

    # Also add single-occurrence bigrams if candidate list is short
    if len(candidates) < 12:
        for phrase, _ in bigram_counts.most_common(15):
            if phrase not in seen:
                candidates.append(phrase)
                seen.add(phrase)

    return candidates[:max_candidates]


def extract_keywords(title: str, text: str, top_k: int = 4) -> List[str]:
    """
    Returns 2 to 4 lowercase, deduplicated content keywords semantically closest to the document
    using Maximal Marginal Relevance (MMR) over all-MiniLM-L6-v2 embeddings.
    """
    doc_text = f"{title}\n\n{(text or '')[:4000]}".strip()
    if not doc_text:
        return []

    candidates = _extract_candidates(title or "", text or "")
    if not candidates:
        return []

    try:
        doc_vec = np.array(model_loader.encode(doc_text), dtype=np.float32)
        cand_vecs = np.array(model_loader.encode(candidates), dtype=np.float32)

        # Cosine similarities (vectors are already L2-normalized)
        doc_sims = np.dot(cand_vecs, doc_vec)

        # Boost exact title phrase matches slightly
        title_lower = (title or "").lower()
        for i, cand in enumerate(candidates):
            if cand in title_lower:
                doc_sims[i] += 0.08
            # Slight boost for informative 2-word keyphrases
            if " " in cand:
                doc_sims[i] += 0.05

        # Greedy MMR selection to avoid redundant overlapping tags (e.g. "neural" + "neural networks")
        selected_indices: List[int] = []
        selected_words: set[str] = set()
        target_k = max(2, min(top_k, 4))

        for _ in range(min(target_k, len(candidates))):
            best_idx = -1
            best_score = -1e9
            for idx in range(len(candidates)):
                if idx in selected_indices:
                    continue
                cand_words = set(candidates[idx].split())
                # Skip if completely redundant subset/superset of an already selected keyword
                if cand_words.issubset(selected_words):
                    continue

                sim_to_doc = float(doc_sims[idx])
                if not selected_indices:
                    mmr_score = sim_to_doc
                else:
                    max_sim_to_sel = max(
                        float(np.dot(cand_vecs[idx], cand_vecs[s_idx]))
                        for s_idx in selected_indices
                    )
                    # Penalize near-synonym duplication
                    mmr_score = 0.72 * sim_to_doc - 0.28 * max_sim_to_sel

                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = idx

            if best_idx == -1:
                break
            selected_indices.append(best_idx)
            selected_words.update(candidates[best_idx].split())

        result = [candidates[i].lower().strip() for i in selected_indices]
        # Deduplicate preserving order
        deduped = list(dict.fromkeys(k for k in result if k and k not in GENERIC_AND_NOISE_WORDS))
        return deduped[:4]
    except Exception as e:
        logger.warning(f"Semantic keyword extraction failed, using frequency fallback: {e}")
        return candidates[:3]
