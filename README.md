# PaperTradeX

Paper trading for Indian equities and ETFs — practice buys, sells, and portfolio management with **live market data**, without risking real money.

| Layer | Stack |
|-------|--------|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, Chart.js |
| Backend | Node.js, Express, Socket.IO, Mongoose |
| Market data | Yahoo Finance, NSE-oriented quote pipeline |
| AI (optional) | Groq · OpenRouter · Gemini |
| Database | MongoDB |

**Repo:** [github.com/harshc17/PapertTradeX](https://github.com/harshc17/PapertTradeX)

---

## Features

| Area | What you get |
|------|----------------|
| **Auth** | Register and login with JWT sessions |
| **Dashboard** | Market overview, portfolio snapshot, movers, indices |
| **Trading** | Stock detail pages with charts and paper buy/sell |
| **Portfolio** | Holdings, order history, watchlist |
| **Discovery** | Stock screener and ETF screener |
| **Challenge** | Weekly paper-trading challenge flow |
| **AI** | Ask-AI assistant and news / portfolio analysis panels |
| **Live data** | Real-time quote updates over Socket.IO |

### App routes

| Path | Page |
|------|------|
| `/login` | Sign in / register |
| `/dashboard` | Main market & portfolio hub |
| `/stock/[symbol]` | Chart, quote, and trade panel |
| `/holdings` | Open positions |
| `/orders` | Order history |
| `/watchlist` | Saved symbols |
| `/stock-screener` | Equity screener |
| `/etf-screener` | ETF screener |
| `/challenge` | Weekly challenge |
| `/ask-ai` | AI assistant |
| `/admin` | Admin tools |

---

## Project structure

```
PaperTradeX/
├── frontend/                 # Next.js UI (src/app, components, contexts)
├── backend/
│   ├── src/
│   │   ├── server.js         # Express API + Socket.IO
│   │   ├── models/           # MongoDB models
│   │   └── services/         # Market data, trade engine, AI, NSE clients
│   └── .env.example          # Env template (copy to .env)
├── database_schema.sql       # Schema reference
├── package.json              # Root scripts (run both apps)
└── README.md
```

---

## Prerequisites

- **Node.js** 18 or newer
- **npm**
- **MongoDB** running locally, or a cloud URI (Atlas, etc.)

---

## Quick start

```bash
git clone https://github.com/harshc17/PapertTradeX.git
cd PapertTradeX

# Install root + backend + frontend deps
npm run install:all

# Backend environment
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```bash
MONGODB_URI=mongodb://localhost:27017/papertradex

# Required — generate with:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_generated_secret_here

# Optional — enable AI features
GROQ_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=
```

Start both servers from the repo root:

```bash
npm start
```

| Service  | URL                   |
|----------|-----------------------|
| Frontend | http://localhost:3000 |
| Backend  | http://localhost:3001 |

### Run separately

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

### Root scripts

| Script | Command | What it does |
|--------|---------|--------------|
| Install everything | `npm run install:all` | Installs root, backend, and frontend deps |
| Start both | `npm start` | Backend (3001) + frontend (3000) via concurrently |
| Backend only | `npm run server` | `nodemon` on the Express API |
| Frontend only | `npm run client` | Next.js dev server |

---

## Environment variables

Copy `backend/.env.example` → `backend/.env`. **Do not commit real keys.**

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes* | MongoDB connection string (*defaults to local if omitted) |
| `JWT_SECRET` | **Yes** | Long random string — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | No | Token lifetime, default `24h` |
| `CORS_ORIGIN` | No | Comma-separated allowed origins, default `http://localhost:3000` |
| `FRONTEND_URL` | No | Used in password-reset links, default `http://localhost:3000` |
| `ADMIN_EMAIL` | No | Admin account email, default `admin@papertradex.com` |
| `ADMIN_PASSWORD` | No | Admin password — leave blank to skip seeding |
| `GOOGLE_CLIENT_ID` | No | Google OAuth Client ID (see setup below) |
| `SMTP_HOST` | No | SMTP server host — leave blank to log reset links to console |
| `SMTP_PORT` | No | SMTP port, default `587` |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From address for reset emails |
| `GROQ_API_KEY` | No | Primary AI provider |
| `OPENROUTER_API_KEY` | No | Fallback AI provider |
| `GEMINI_API_KEY` | No | Google Gemini for AI features |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | No | Backend URL, default `http://localhost:3001` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | No | Same Google Client ID as backend — enables the Google login button |

---

## Google login setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create or select a project.
2. **APIs & Services → OAuth consent screen** → External → fill in app name + support email → add your email as a test user.
3. **Credentials → Create Credentials → OAuth client ID** → Application type: **Web application**.
4. Under **Authorized JavaScript origins** add `http://localhost:3000` (and your production URL when deploying).
5. Copy the **Client ID**.
6. Set it in both env files:
   - `backend/.env` → `GOOGLE_CLIENT_ID=<your-client-id>`
   - `frontend/.env.local` → `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-client-id>`
7. Restart both servers. The "Continue with Google" button will appear on the login page.

---

## ⚠️ Security notice — rotate your API keys

If you previously committed `backend/.env` to git, the following keys are compromised and **must be regenerated**:

- **Gemini API key** → [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — delete the old key and create a new one.
- **OpenRouter API key** → [openrouter.ai/keys](https://openrouter.ai/keys) — delete the old key and create a new one.

After regenerating, update `backend/.env` with the new values. The `.env` file is git-ignored and will not be committed again.

---

## How it works

1. **Frontend** talks to the Express API for auth, portfolio, orders, and stock metadata.
2. **Backend** fetches quotes / history via market-data services and runs the paper **TradeEngine**.
3. **Socket.IO** pushes live price updates to the client ticker and dashboards.
4. **MongoDB** stores users, holdings, orders, and watchlists.
5. Optional **AI** keys power Ask-AI and news/portfolio analysis when configured.

On first startup with a reachable database, the backend seeds initial market-related data as needed.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Backend fails to start | Confirm MongoDB is running and `MONGODB_URI` is correct |
| Empty / stale prices | Check network access for market-data providers; watch backend logs |
| AI panels error / empty | Set at least one of `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY` |
| Frontend can't reach API | Ensure backend is on port **3001** and CORS is not blocked locally |
| Port already in use | Stop other processes on 3000/3001, or change ports in config |

---

## Notes

- This is **paper trading only** — no real brokerage or money movement.
- Unauthenticated users are redirected to `/login`; signed-in users land on `/dashboard`.
- Keep secrets in `backend/.env` only.

## License

Private / personal project unless otherwise noted.
