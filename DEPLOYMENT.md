# Deploy PaperTradeX

Use Vercel for `frontend`, one Render (or Railway) service for `backend`, and MongoDB Atlas for persistent data. Redis and the legacy SQLite file are not used by the active models.

## MongoDB Atlas

1. Create or select a cluster and a database user restricted to read/write access to `papertradex`.
2. Add the backend service's outbound IP addresses/ranges to the Atlas network access list.
3. Copy the Node.js connection string from Connect > Drivers. Set the database name to `papertradex`, URL-encode special characters in credentials, and store it only as the backend's secret `MONGODB_URI`.
4. Collections are created by Mongoose when used; no SQL import is needed. Existing local data is not automatically migrated.

## Render (main configuration)

Push these changes to your connected repository, then create a Blueprint using the root `render.yaml`. If a backend service already exists, update that service instead of creating a duplicate.

- Root directory: `backend`
- Runtime: Node 22
- Build: `npm ci --omit=dev`
- Start: `node src/server.js`
- Health check: `/health`
- `MONGODB_URI`: Atlas connection string, entered privately
- `JWT_SECRET`: generated automatically for new Blueprint services; keep an existing secret when updating an existing service
- `NODE_ENV`: `production`
- `FRONTEND_URL` and `CORS_ORIGIN`: `https://papertradex.vercel.app`

The server must connect to MongoDB before accepting traffic. `/health` returns 503 if its database connection is lost. The Blueprint retains the existing free plan; review current hosting limits before relying on uninterrupted market polling.

## Railway alternative

Use the repository root as the service root and `/railway.json` as its config file. The config installs and starts the backend explicitly. Set `RAILPACK_NODE_VERSION=22`, `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, and `CORS_ORIGIN` as above. Generate a public domain. Railway supplies `PORT`.

Generate a JWT secret locally if needed:

```sh
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Do not deploy both backend services against the same database: the market polling and order-processing jobs would run twice.

## Vercel

Keep the project root at `frontend`. Set the Production environment variable `NEXT_PUBLIC_API_URL` to the actual backend HTTPS origin (for example `https://YOUR-SERVICE.onrender.com`), with no `/api` suffix, and redeploy. Both HTTP requests and Socket.IO use this setting. Never put MongoDB credentials or JWT secrets into `NEXT_PUBLIC_` variables.

For preview deployments, explicitly add each trusted preview origin to the backend's comma-separated `CORS_ORIGIN` list if needed.

## Verification and optional features

Railway follows `main` without a commit pin. Install Railway's GitHub App with access restricted to `harshc17/PaperTradeX`, and confirm a push creates a deployment for that commit before relying on automatic updates.

Trading is restricted to regular market hours. Closed-market requests must leave balance, holdings and orders unchanged. Verify a buy, sell, queued limit order and cancellation during an open session after changes to trade execution. Trades use server-resolved quotes and MongoDB transactions.

Security regression checks: `node --test backend/test/deployment.test.js backend/test/trading-hours.test.js`. Run dependency audits in the root, backend and frontend directories after dependency updates. Password-reset delivery requires SMTP; production must not log reset tokens.

- Confirm backend `/health` returns HTTP 200 and `{"status":"ok"}`.
- Register a test account and log in on the Vercel site; verify the user exists in Atlas and survives a backend restart.
- Verify market quotes and Socket.IO connections in browser developer tools. External market providers may restrict datacenter requests; validate them on the selected host.
- Configure SMTP for password-reset email delivery.
- Configure matching backend `GOOGLE_CLIENT_ID` and frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, plus the Vercel origin in Google OAuth settings, for Google login.
- Configure AI provider keys on the backend for AI features.
- Local deployment checks: `node --test backend/test/deployment.test.js` (mocked database and market services).

References: [Render Blueprints](https://render.com/docs/blueprint-spec), [Railway config](https://docs.railway.com/config-as-code/reference), [Atlas connection setup](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/), [Vercel environment variables](https://vercel.com/docs/environment-variables).
