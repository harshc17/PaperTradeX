# PaperTradeX knowledge assistant

Ask AI (`/ask-ai`) retrieves passages from original app-help documents, three introductory education summaries (ETFs, diversification and market risks) linked to SEBI Investor references reviewed 22 November 2026, and the signed-in user's private text/Markdown library. It does not fetch those external pages at question time. Optional completed-trade metrics are calculated by the existing weighted-average performance service, then added as an ephemeral source. The browser cannot supply account metrics or select another user's documents.

## Search and generation

This first release uses overlapping 1,100-character chunks and BM25 ranked keyword retrieval, capped at two passages per document and five document passages per question. It does not use embeddings, a vector database, PDF parsing, web crawling, live market quotes or an order-execution tool. Each question is independent. Retrieval-only mode returns actual passages, not a simulated model answer.

Groq generation is optional. Add `GROQ_API_KEY` privately to the **Render** backend and set `RAG_GENERATION_ENABLED=true` when ready to enable generated answers. Do not expose the key to Vercel client variables or commit it. `RAG_MODEL` defaults to `llama-3.3-70b-versatile`. `RAG_ENABLED=false` disables all knowledge endpoints. Railway remains offline.

No AI request runs during startup, page loading, document upload or quote updates. A provider request happens only after an authenticated user submits a question, generation is configured, and supporting passages exist. There is an 18-second provider timeout. Failures, malformed responses and unknown citations fall back to source search. A valid citation ID proves only that the source was retrieved, not that every generated claim is true; review excerpts.

## Privacy and limits

- `RagDocument.owner` is indexed and included in every list/search/delete query. No global private-document cache exists.
- Up to 25 documents per account, 40–30,000 characters each; title up to 120 characters. The count guard is a practical quota, not an atomic concurrent-write reservation.
- Authenticated question/upload rate limit: 20 combined requests per 15 minutes per user. Limits are process-local, reset on deployment and are not a distributed cost cap. Configure provider spending limits before enabling generation broadly.
- Questions: up to 2,000 characters. Trade history: up to 20,000 executed records, rejected rather than silently truncated.
- Questions and matching passages go to Groq only when generation is enabled. Trade statistics require the explicit checkbox. Raw transaction rows and account identifiers are not sent. Avoid secrets or personal information in uploaded content.
- Responses are private/no-store; chat is only held in page memory. Source text and generated text render as text, not HTML. Only server-owned app-help links are rendered.
- Documents can be removed from future retrieval. Existing page results and backup retention are separate. App-help facts should be reviewed whenever corresponding trading/account behavior changes.
- Other AI features remain disabled independently. No pricing or trade-execution code is changed by this feature.

## Validation

Run `node --test backend/test/rag.test.js backend/test/deployment.test.js backend/test/tradingCoach.test.js` and the frontend production build. Tests cover source ranking, owner isolation, auth, validation, deletion, provider fallback/citations, opt-in account metrics and invalid history. Provider tests use mocked HTTP responses and never send private data externally.
