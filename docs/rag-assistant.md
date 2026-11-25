# PaperTradeX finance assistant

Ask AI answers account questions from an authenticated, freshly read paper-portfolio snapshot; education questions use the managed knowledge corpus plus optional LLM explanation. Users cannot upload documents. Legacy document endpoints return 410 and legacy uploads are never retrieved. Existing stored uploads are not silently deleted.

## Enable later on Render

The user selected **Gemini**. Add `GEMINI_API_KEY` privately to the Render backend, then set:

```
RAG_PROVIDER=gemini
RAG_GENERATION_ENABLED=true
RAG_GEMINI_MODEL=gemini-3.5-flash-lite
RAG_VECTOR_ENABLED=true
```

No Groq requests are made by the assistant. Optional OpenAI support uses `OPENAI_API_KEY`, `RAG_PROVIDER=openai`, and `RAG_OPENAI_MODEL=gpt-6.2-sol`. No automatic cross-provider retries send data to another provider. OpenAI uses Responses with `store:false`. Provider retention policies still apply. If vector search is enabled with OpenAI generation, question embeddings still use Gemini, as disclosed in the UI/privacy policy.

The shared index is maintained by the operator; the public Ask AI page has no knowledge-library management panel or upload controls. The authenticated ADMIN-only `/api/rag/index` maintenance endpoint embeds up to 32 missing curated chunks per call. Indexing is idempotent; content hashes change on edits. Never index account records. New corpus sources require a code update and index refresh.

Operators can alternatively set `RAG_BUILD_INDEX_ON_START=true` for a deployment to build up to four batches after database connection and before listening. Clear this flag after observing completion in the Render logs. This maintenance action is explicit, does not change user roles, and is not enabled during normal startup. Failure logs contain only a status code; the application still starts with keyword fallback.

When generation is unavailable, the chat shows a clear unavailable reply with Retry answer, rather than dumping source passages. Verified portfolio snapshots remain visible. A retry reuses its saved question, options and bounded context, replaces the same reply, and leaves draft text and later messages intact. Portfolio data is fetched again on every retry. New chat clears saved retry requests as well as visible messages.

## Retrieval and context

With Gemini selected for generation, an unanswered question can get one interpretation attempt. Gemini sees the question and, when resolving a follow-up, up to two earlier user questions. A clear correction goes back through the same retrieval, permissions, and factual checks. The chat shows the interpretation and uses it for follow-ups. Ambiguous wording gets a clarification prompt; missing verified facts stay unavailable. Interpretation and the second answer share the original request deadline.

Managed knowledge: original app help, finance lessons linked to SEBI Investor, and short original study notes linked to the SEBI Financial Education Booklet (Chapter 2, reviewed 22 November 2026). The copyrighted booklet itself is not copied into the database. No full copyrighted books are included. Add only licensed, public-domain or original material to `backend/src/knowledge/papertradex.json`; retain source URL, title and review date. References are not fetched at question time. PDF ingestion and web crawling are not included.

Text is split into stable overlapping 1,100-character chunks. Gemini Embedding 2 produces 768-dimensional vectors stored in MongoDB by model/version and chunk hash. Exact cosine search over the small curated index is combined with BM25 using reciprocal ranks; up to four passages, at most two from one document, enter the prompt. This is real embedding-based vector retrieval, without requiring an Atlas Vector Search index. It is suitable for this bounded corpus; use indexed database vector search if the library becomes large.

Stale/deleted source chunks cannot be retrieved because every query is restricted to current compiled chunk IDs and the exact embedding model tag. Embedding errors fall back to keyword search. Vectors contain only public education/app help. There is no shared user-portfolio cache.

## Account facts

The portfolio option allows account-related questions to load server-owned records, not browser-submitted figures or user IDs. General education questions do not load the account. The intent detector supports common personal/imperative portfolio wording; follow-ups use up to four recent exchanges. Portfolio follow-ups fetch and reconcile a fresh account snapshot; prior account answers are replaced with a context note and cannot establish balances or returns. Starting a new chat or leaving the page clears memory. Completed-trade statistics have a separate checkbox.

Both `/api/portfolio` and the assistant use `loadPortfolioAccount`; all security prices come from the existing `displayQuote` feed/cache. Current value, invested cost, total unrealised return and available balance are calculated on the server. Session returns follow the same calculation as Dashboard/Holdings, with parity tests across additions, partial/full sales and missing references. Today's buys use execution cost; overnight shares use previous close; today's sold positions retain their return. Missing prices leave values null, never zero. Delayed quotes and per-position timestamps are included. Totals sum before rounding. Holdings quantity is reconciled against executed history, rejecting incomplete or changing snapshots.

Answers are recorded snapshots, not streaming portfolio cards. Quotes may have different timestamps and markets may move while the answer is generated; ask again to refresh. Current holdings value excludes cash. Total return means unrealised return on open holdings, not realised lifetime profit. Limits: 200 holdings, 400 relevant symbols, 20,000 trades; oversized/inconsistent accounts fail instead of returning silently partial totals.

## Generation and cost controls

Gemini 3.5 Flash-Lite is the default. At most 1,200 output tokens, answers normally under 180 words; full holdings data is rendered separately. Conversation context is bounded to four recent exchanges, at most 1,000 characters per message. Credentials, email, raw transaction rows and the unused whole library are not included. Previous account answers are replaced with a context note. Questions and earlier assistant text remain untrusted, never verified account facts. A request occurs only after the user submits a question. No provider call runs during startup, quote ticks or page loading. Only administrator indexing calls create document embeddings. Each semantic query uses one query embedding call. Timeout: embeddings 10 seconds, answer generation 18 seconds total. A temporary HTTP 502/503/504 receives at most one retry with the same provider and payload inside that deadline; rate limits, validation failures and completed responses are not retried. No cross-provider retry.

Sourced-only policy: every factual sentence requires a valid source ID for server-side checks. The chat hides source IDs and source lists. Standalone live quotes are available through the market pages and read-only MCP tools. General model knowledge cannot fill gaps. Unsupported numerical claims are rejected. Recommendations to buy/sell/hold/switch specific investments are declined. Missing verified information returns the specified refusal rather than extrapolation. Current account facts must cite the verified server portfolio source. General model knowledge cannot supply live prices, news, current fundamentals or account numbers. Schema validation, citation-ID checks, incomplete/refusal handling and truthful fallback protect the response path, but do not prove every generated sentence is correct. Review the structured account table for portfolio figures. The assistant has no execution tools.

All endpoints require authentication. Index building additionally requires ADMIN. Responses are private/no-store and chats only live in page memory. The process-local rate limit is 20 submissions/index requests per user per 15 minutes; configure provider spending limits before broad enablement. Railway remains offline; other legacy AI features remain disabled.

## Verification

Run `node --test backend/test/rag*.test.js backend/test/deployment.test.js backend/test/daily-returns.test.js backend/test/trade-idempotency.test.js backend/test/quoteConsistency.test.js` and the frontend production build. Tests mock providers and cover provider selection/no Groq, schema/citations, semantic concept retrieval, stale chunk filtering, account isolation, opt-in/context routing, disabled uploads, calculation parity, missing quotes and trading regressions. No private user data is sent externally by tests. Real LLM/embedding quality and live signed-in account behavior require keys and an authenticated session.

## Verified tools and MCP

Ask AI retrieves shared website quotes, account-synced watchlists and optional exchange-announcement metadata on demand. Quotes retain exchange identity, observation time, delayed/closed status and unavailable values. The old simulated news generators stay disabled and are never used for grounding. NSE announcement lookup reuses the existing session/backoff, caches for five minutes, and returns unavailable without opening extra sessions when blocked. Only announcement titles, dates and allowlisted attachment links are verified; attachment bodies, broad news coverage, sentiment, MF NAVs, SIDs/KIMs and effective-dated tax circulars are not currently integrated. Requests needing those missing facts return the exact unverified-information response. Review dates are never substituted for regulatory effective dates.

Deterministic tools calculate percentage change, CAGR, hypothetical end-of-month SIP scenarios and conventional dated XIRR; no tax rate is assumed. The chat parser supports explicit forms such as `CAGR from 100 to 121 over 2 years`, `percentage change from 100 to 110`, and `SIP of 1000 per month at 12% for 10 years`. Portfolio return and allocation figures come from server calculations; portfolio XIRR uses aggregated executed cash flows. Invalid dates, ambiguous cash-flow signs, unsupported sizes and missing inputs fail instead of inventing results. External MCP clients can pass structured calculator inputs.

`POST /api/assistant/mcp` uses the official MCP SDK with stateless Streamable HTTP (2025-11-25-compatible protocol), Bearer authentication and JSON responses. Tools: `fetch_user_portfolio`, `fetch_live_market_data`, `fetch_user_watchlist`, `fetch_company_disclosures`, `retrieve_financial_documents`, `execute_financial_math`. No tool places, edits or cancels orders or changes account data. The caller cannot select another account. Large watchlists explicitly report quote truncation at 20 symbols.

Open Ask AI → Answer options → Connect an external AI assistant to issue a one-hour read-only key for a named client. The user must initiate issuance. Keys use a signing key cryptographically separated from app login tokens, store only a hashed token identifier, and are checked against account tokenVersion and revocation on every request. They cannot authenticate trading routes. Management endpoints use the normal authenticated session, and revocation is user-scoped. MCP does not accept login JWTs. No key is embedded in the client bundle or written to logs. The dialog shows the private key once and clears it on close. Do not paste it into this chat or shared repositories.

Configure an MCP client supporting Streamable HTTP Bearer headers with URL `https://papertradex-roib.onrender.com/api/assistant/mcp` and `Authorization: Bearer <private one-hour key>`. This is not an OAuth connector; clients requiring OAuth need a separate authorization integration. External assistants control their own generated prose and retention, so PaperTradeX supplies policy instructions and verified tool outputs but cannot enforce another provider’s final wording.
