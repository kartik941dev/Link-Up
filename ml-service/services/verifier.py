import json
import logging
import re
from typing import List, Dict, Any, Optional
from config import settings
from utils.llm_client import resolve_groq_model

logger = logging.getLogger("ml_service.verifier")

class HallucinationVerifier:
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
                logger.info(f"Verifier initialized Groq client using model: {self._model_name}")
            except Exception as e:
                logger.warning(f"Verifier could not initialize Groq client: {e}")
                self._groq_client = None

    def verify_answer(
        self,
        query: str,
        answer: str,
        context_cards: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Evaluates the generated answer against the source context cards.
        Returns:
            {
                "grounded": bool,
                "confidence": float,  # 0.0 to 1.0
                "unsupported_claims": List[str],
                "verified_claims_count": int,
                "total_claims_count": int
            }
        """
        if not answer or not context_cards:
            return {
                "grounded": False,
                "confidence": 0.0,
                "unsupported_claims": ["No knowledge context was available to verify claims."],
                "verified_claims_count": 0,
                "total_claims_count": 0
            }

        # 1. Try Groq Llama 3.1 verification prompt
        if self._groq_client:
            try:
                context_snippets = []
                for c in context_cards[:6]:
                    card_text = c.get("extracted_text") or c.get("snippet") or c.get("title") or ""
                    context_snippets.append(f"[Card: {c['id']} - {c['title']}]: {card_text[:350]}")
                
                context_block = "\n\n".join(context_snippets)

                prompt = f"""You are a strict factual hallucination verification judge.
Analyze the provided RESPONSE and determine if every statement is supported by the SOURCE CONTEXT.

SOURCE CONTEXT:
{context_block}

USER QUESTION:
{query}

RESPONSE TO VERIFY:
{answer}

INSTRUCTIONS:
1. Break down the response into key factual claims.
2. Check if each claim is directly mentioned or logically entailed by the SOURCE CONTEXT.
3. If information is not in the context, flag it as an unsupported claim.
4. Output STRICT JSON only. Format:
{{
  "grounded": true or false,
  "confidence": 0.0 to 1.0,
  "unsupported_claims": ["claim 1", "claim 2"],
  "explanation": "concise explanation"
}}
"""

                res = self._groq_client.chat.completions.create(
                    model=self._model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an automated factual verification engine. Output ONLY valid parseable JSON."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.0,
                    max_tokens=250,
                )

                content = res.choices[0].message.content.strip()
                # Extract JSON if enclosed in markdown blocks
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    grounded = bool(parsed.get("grounded", True))
                    confidence = float(parsed.get("confidence", 0.90))
                    unsupported = parsed.get("unsupported_claims", [])
                    return {
                        "grounded": grounded,
                        "confidence": round(max(0.0, min(1.0, confidence)), 2),
                        "unsupported_claims": unsupported if isinstance(unsupported, list) else [],
                        "explanation": parsed.get("explanation", "Verification completed.")
                    }
            except Exception as e:
                logger.warning(f"Groq verification failed: {e}. Falling back to heuristic verification.")

        # 2. Heuristic verification fallback: Word & N-gram entity overlap
        return self._heuristic_verification(answer, context_cards)

    def _heuristic_verification(
        self,
        answer: str,
        context_cards: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Evaluates token overlap and citation presence between answer sentences and context cards.
        """
        # Collect all context text
        all_context = ""
        for c in context_cards:
            all_context += " " + (c.get("title") or "")
            all_context += " " + (c.get("snippet") or "")
            all_context += " " + (c.get("extracted_text") or "")[:500]

        context_tokens = set(re.findall(r'[a-zA-Z]{3,}', all_context.lower()))

        # Split answer into sentences
        sentences = [s.strip() for s in re.split(r'[.!?\n]+', answer) if len(s.strip()) > 15]
        if not sentences:
            return {
                "grounded": True,
                "confidence": 0.85,
                "unsupported_claims": [],
                "explanation": "Heuristic verification verified basic response structure."
            }

        unsupported_claims = []
        verified_count = 0

        for sentence in sentences:
            tokens = set(re.findall(r'[a-zA-Z]{3,}', sentence.lower()))
            if not tokens:
                verified_count += 1
                continue
            
            # Check overlap percentage
            overlap = len(tokens.intersection(context_tokens))
            ratio = overlap / len(tokens)

            # Check if sentence has citation markup
            has_citation = bool(re.search(r'\[Card:\s*[^\]]+\]', sentence))

            if ratio >= 0.40 or has_citation:
                verified_count += 1
            else:
                unsupported_claims.append(sentence[:120] + "...")

        confidence = round(verified_count / len(sentences), 2)
        grounded = confidence >= 0.70

        return {
            "grounded": grounded,
            "confidence": confidence,
            "unsupported_claims": unsupported_claims[:3],
            "explanation": f"Evaluated {verified_count}/{len(sentences)} claims matching verified knowledge cards."
        }

hallucination_verifier = HallucinationVerifier()
