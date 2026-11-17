# Automatic Render recovery

Railway remains the preferred backend. The browser checks both database-backed
`/health` endpoints every 15 seconds while the app is open. When Railway is
unreachable and Render is healthy, API calls and the live-price socket switch to
Render. When Railway recovers, both switch back automatically. Existing tabs
must load the new frontend once to receive this behavior.

## Configuration

- Vercel production: `NEXT_PUBLIC_API_URL` is the Railway URL and
  `NEXT_PUBLIC_BACKUP_API_URL=https://papertradex-roib.onrender.com`.
- Both backends use identical `MONGODB_URI` (including database name),
  `JWT_SECRET`, sender settings and account data. Never generate an independent
  backup signing secret or database.
- Render service `PaperTradeX`, workspace `My Workspace`, service ID
  `srv-dbb96t8m7kps73ekrb1g`, tracks GitHub `main` with auto-deploy enabled.
- Render uses `MARKET_POLLING_ENABLED=true` and
  `STANDBY_PRIMARY_URL=https://paperttradex-production.up.railway.app`.
  Its feed loops run when serving connected users or its primary health probe
  fails; otherwise it avoids duplicate background quote fetching.
- Render environment settings are managed directly in Render. `render.yaml`
  is the recreation template; do not create a duplicate service.
- Authorize both hosts' outbound IPs/ranges in MongoDB Atlas and Brevo where
  required. Copy any configured Google/AI credentials privately too.

## Account and order safety

JWTs and persisted accounts survive server changes. HTTP and socket clients
share one selected backend; stock subscriptions and event listeners survive
reconnection. Health checks never clear account state. Auth errors, rate limits
and provider-specific failures are not treated as whole-server outages.

Read requests can retry on the selected healthy backend. Paper trade requests
use a unique request ID retained for unresolved manual retries/reloads. A
partial unique MongoDB index on user/request ID and the same transaction as the
balance, position, transaction and order writes prevent duplicate execution.
Reusing an ID for different trade parameters is rejected. A committed request
can be recovered even after market close. Signup, reset, challenge and other
mutations are not automatically replayed after an ambiguous connection loss.

## Limits and verification

This is automatic application recovery, not uninterrupted availability or a
separate database backup. Detection/reconnection takes time. Free Render
instances can sleep without inbound traffic and need time to wake; a shared
MongoDB outage affects both hosts. Provider quote freshness checks and regular
trading hours remain enforced.

Verify simulated primary loss and recovery locally without stopping production:
`design/failover-proxy.cjs` exposes local Railway/Render routes on 3015/3016 and
can disable only the primary test route. Point the local frontend at those two
origins. Never expose this test proxy publicly. Check login retention, matching
holdings/balance, unchanged order IDs, socket subscription replay and recovery.
Unit checks cover safe read retries, provider/auth errors, cancelled requests,
lost trade responses, duplicate buys/sells and queued limit orders.

References: [Free service limits](https://render.com/docs/free),
[Blueprint configuration](https://render.com/docs/blueprint-spec),
[outbound IP ranges](https://render.com/docs/outbound-ip-addresses).
