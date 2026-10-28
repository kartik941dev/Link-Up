import logging
import re
from typing import List, Optional
from collections import Counter
from config import settings

logger = logging.getLogger("ml_service.llm_client")

# Common English stop words for fallback heuristic keyword extraction
STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", 
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", 
    "by", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", 
    "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", 
    "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", 
    "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", 
    "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", 
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", 
    "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too", 
    "under", "until", "up", "very", "was", "we", "were", "what", "when", "where", "which", 
    "while", "who", "whom", "why", "with", "would", "you", "your", "yours", "yourself", "yourselves",
    "pdf", "docx", "document", "file", "notes", "summary", "overview", "introduction", "guide"
}

def resolve_groq_model(client) -> str:
    """Dynamically resolves the best available chat completion model for this Groq account."""
    PREFERRED = [
        "llama-3.1-8b-instant",
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
        "allam-2-7b",
        "llama3-8b-8192",
        "llama-3.3-70b-versatile"
    ]
    try:
        available = {m.id for m in client.models.list().data}
        for pref in PREFERRED:
            if pref in available:
                return pref
        chat_models = [m for m in available if "whisper" not in m and "guard" not in m]
        return chat_models[0] if chat_models else list(available)[0]
    except Exception:
        return "qwen/qwen3.8-27b"

class LLMClient:
    def __init__(self):
        self._groq_client = None
        self._model_name = "llama-3.1-8b-instant"
        self._init_groq()

    def _init_groq(self):
        api_key = settings.llm_api_key.strip() if settings.llm_api_key else ""
        if api_key and not api_key.startswith("gsk_your_groq_api_key"):
            try:
                from groq import Groq
                self._groq_client = Groq(api_key=api_key)
                self._model_name = resolve_groq_model(self._groq_client)
                logger.info(f"Groq client successfully initialized using model: {self._model_name}")
            except Exception as e:
                logger.warning(f"Failed to initialize Groq client: {e}. Fallback naming will be used.")
                self._groq_client = None
        else:
            logger.info("No active Groq API key configured. Using heuristic thematic naming engine.")

    def generate_cluster_title(
        self,
        card_titles: List[str],
        snippets: Optional[List[str]] = None,
        common_tags: Optional[List[str]] = None
    ) -> str:
        """
        Generates a concise 2-to-4 word thematic title for a semantic cluster.
        First tries Groq Llama 3.1. If unavailable or fails, uses robust heuristic extraction.
        """
        if not card_titles:
            return "Knowledge Notes"

        # 1. Try Groq Llama 3.1 if client is active
        if self._groq_client:
            try:
                sample_titles = card_titles[:8]
                sample_snippets = [s[:120] for s in (snippets or [])[:4] if s]
                
                content_preview = "\n".join([f"- {t}" for t in sample_titles])
                if sample_snippets:
                    content_preview += "\nExcerpts:\n" + "\n".join([f"- {s}" for s in sample_snippets])

                prompt = (
                    "You are a semantic knowledge organizer. Analyze the following knowledge card titles "
                    "and excerpts belonging to a thematic group:\n\n"
                    f"{content_preview}\n\n"
                    "Generate a concise, professional, title-cased 2-to-4 word topic name for this cluster "
                    "(e.g., 'Cloud Infrastructure', 'Machine Learning Models', 'Database Systems', 'Frontend Engineering').\n"
                    "Do NOT wrap in quotes. Do NOT prefix with 'Cluster:' or 'Topic:'. Return ONLY the 2-4 word title."
                )

                response = self._groq_client.chat.completions.create(
                    model=self._model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a professional knowledge management assistant that outputs only concise 2-4 word topic labels."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.3,
                    max_tokens=25,
                )
                
                raw_text = response.choices[0].message.content.strip()
                # Clean up quotes or markdown
                cleaned = re.sub(r'["`*\']', '', raw_text).strip()
                cleaned = re.sub(r'^(Topic|Cluster|Category|Theme):\s*', '', cleaned, flags=re.IGNORECASE).strip()
                if 2 <= len(cleaned.split()) <= 6 and len(cleaned) < 50:
                    return cleaned
            except Exception as e:
                logger.warning(f"Groq cluster naming failed: {e}. Falling back to heuristic.")

        # 2. Heuristic extraction fallback
        return self._heuristic_title_generation(card_titles, snippets, common_tags)

    def _heuristic_title_generation(
        self,
        card_titles: List[str],
        snippets: Optional[List[str]] = None,
        common_tags: Optional[List[str]] = None
    ) -> str:
        # If there are prominent shared tags, prioritize them
        if common_tags and len(common_tags) > 0:
            top_tags = [t.title() for t in common_tags[:2]]
            if len(top_tags) == 1:
                return f"{top_tags[0]} Concepts"
            return " & ".join(top_tags)

        # Tokenize and score words across titles and snippets
        all_text = " ".join(card_titles)
        if snippets:
            all_text += " " + " ".join([s[:100] for s in snippets[:3]])

        words = re.findall(r'[a-zA-Z]{3,}', all_text)
        filtered_words = [
            w.capitalize() for w in words 
            if w.lower() not in STOP_WORDS
        ]

        if not filtered_words:
            # Fallback to first title trimmed
            first_title = card_titles[0]
            words = first_title.split()[:3]
            return " ".join(words) if words else "Knowledge Cluster"

        counts = Counter(filtered_words)
        most_common = [word for word, _ in counts.most_common(3)]

        if len(most_common) == 1:
            return f"{most_common[0]} Overview"
        elif len(most_common) == 2:
            return f"{most_common[0]} & {most_common[1]}"
        else:
            return f"{most_common[0]} & {most_common[1]} {most_common[2]}"

llm_client = LLMClient()
