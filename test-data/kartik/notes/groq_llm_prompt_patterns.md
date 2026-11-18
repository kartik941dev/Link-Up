# Groq Llama 3.1 Prompt Engineering Patterns for LinkUp RAG

- **Synthesis Temperature**: Use `temperature=0.2` with `max_tokens=1000` for concise, factual, markdown-structured answers.
- **Verification Temperature**: Use `temperature=0.0` with strict JSON output for the hallucination verification judge.
- **Strict Citation Format**: Enforce `[Card: <card_id> - <card_title>]` inline after every factual claim so the frontend `CitationBadge` component renders clickable pills.
- **Safe Refusal Rule**: Explicitly instruct the model to respond with *"Based on your knowledge cards, there is not enough information to answer this question."* whenever the retrieved context does not support an answer.
