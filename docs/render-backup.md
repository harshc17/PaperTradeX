# Render recovery backend

Railway is the primary API and Socket.IO server. `render.yaml` prepares a free
Render recovery service tracking `main`. It does not switch production traffic.
The existing service is `PaperTradeX` in `My Workspace`, at
https://papertradex-roib.onrender.com (service `srv-dbb96t8m7kps73ekrb1g`).
Its environment is currently managed directly in Render; the Blueprint is a
recovery template, not an additional service to create alongside it.
Render must be connected and the service successfully deployed before it is a
usable backup.

## Provision

1. Reuse the existing service. If recreating it in a future recovery, use
   `render.yaml`; do not create a duplicate while the existing service is present.
2. Privately copy the existing Railway **MONGODB_URI** and **JWT_SECRET** into
   Render. Use the identical database, database name and signing secret so
   accounts, holdings and existing sessions remain valid. Never generate a
   separate secret for the backup or put secrets in Git.
3. Copy **BREVO_API_KEY** and **GOOGLE_CLIENT_ID** privately from Railway.
   Copy any configured AI provider keys as well if those features are required.
   Leave **ADMIN_PASSWORD** unset: recovery must not seed a new administrator.
4. Authorize the service's outbound IP ranges in MongoDB Atlas and Brevo where
   allowlists apply. Obtain the actual ranges from Render's service dashboard;
   Railway's outbound IP is not the Render server's IP.
5. Confirm `/health` returns HTTP 200 and test API CORS using the production
   website origin. Confirm email delivery and login before considering the
   backup ready. Keep `MARKET_POLLING_ENABLED=false` while inactive.

## Recover from a Railway outage

1. Set Render's `MARKET_POLLING_ENABLED=true`, deploy, wait for `/health` HTTP
   200, and verify fresh stock/index quotes and Socket.IO subscriptions.
2. Change Vercel's production **NEXT_PUBLIC_API_URL** to the verified Render
   service URL and redeploy the frontend. The same setting controls both HTTP
   and WebSocket connections. Changing the variable alone does not change an
   already built frontend.
3. Verify login, signup/reset email, charts, dashboard/holdings consistency and
   order status. Check an interrupted order's status before resubmitting it;
   a failed connection does not prove a trade was not recorded.
4. Once Railway recovers, verify its health and quotes, restore the Railway API
   URL in Vercel and redeploy. Then disable Render polling again.

There is no automatic request replay or automatic failover in this setup.
Free Render services sleep after 15 minutes without inbound traffic and take
time to wake up. This is a recovery option, not uninterrupted availability or a
separate database backup. A shared database outage affects both servers.

References: [Free service limits](https://render.com/docs/free),
[Blueprint configuration](https://render.com/docs/blueprint-spec),
[outbound IP ranges](https://render.com/docs/outbound-ip-addresses).
