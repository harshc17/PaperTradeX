# PaperTradeX

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-Modern-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](LICENSE)

A high-performance, modern paper trading and portfolio simulation platform tailored for **Indian Equities (NSE/BSE)** and **ETFs**. Practice buying, selling, stop-loss orders, and real-time portfolio management using **live market prices**, charts, and AI-driven insights — with zero financial risk.

**Repository:** [https://github.com/harshc17/PapertTradeX](https://github.com/harshc17/PapertTradeX)

---

## 🌟 Key Features

| Area | Highlights |
|---|---|
| **Live Market Engine** | Real-time Indian equity pricing (NSE/BSE) over Socket.IO and fallback Yahoo Finance pipelines. |
| **Realistic Trading Engine** | Execute Market & Limit orders with instant execution, trade validations, cash balance updates, and realistic cost-basis tracking. |
| **Portfolio & Holdings Hub** | Interactive holdings overview with separate **Today's Gain (1D)** and **Total Returns (Unrealized P&L)**, allocation meters, and quick trade shortcuts. |
| **Interactive Technical Charts** | Multi-timeframe charts (1D, 1W, 1M, 1Y, 5Y) with volume bars, technical indicators, and price metrics. |
| **Smart Screeners** | Filter and sort high-volume Indian stocks and ETFs by sector, price change, market cap, and performance. |
| **Weekly Trading Challenge** | Compete in simulated paper trading sprints, climb the leaderboard, and track weekly ROI performance. |
| **AI Market Intelligence** | Embedded **Ask-AI** assistant and automated news sentiment analyzer powered by Google Gemini, Groq, and OpenRouter. |
| **Modern Dark-Mode UI** | Custom dark theme inspired by institutional terminals, featuring responsive navigation, glassmorphic cards, micro-interactions, and tabular numerical alignment. |

---

## 🧭 Application Routes

| Path | Purpose |
|---|---|
| `/login` | User authentication (Email/Password & Google OAuth) |
| `/forgot-password` | Self-serve password reset request via email |
| `/reset-password` | Secure token-based password reset |
| `/dashboard` | Command center with market indices, portfolio snapshot, and top movers |
| `/stock/[symbol]` | Full-page chart, live depth/quote, news, and buy/sell trading panel |
| `/holdings` | Open equity & ETF holdings with daily and cumulative P&L breakdown |
| `/orders` | Real-time order log with status (Executed, Pending, Cancelled) |
| `/transactions` | Detailed ledger of all executed trades and cash balance adjustments |
| `/watchlist` | Custom watchlist with live price tickers and quick actions |
| `/stock-screener` | Stock discovery tool with sector and gain/loss filters |
| `/etf-screener` | Comprehensive tracker for Indian thematic & index ETFs |
| `/challenge` | Weekly paper trading tournament & leaderboard |
| `/ask-ai` | Conversational financial copilot and stock analysis |

---

## 🏗️ Architecture & Technology Stack

```
PaperTradeX/
├── frontend/                     # Next.js 14 App Router, TypeScript, Tailwind CSS
│   ├── src/
│   │   ├── app/                  # Application routes (holdings, dashboard, stock, etc.)
│   │   ├── components/           # Reusable UI widgets, trading panel, charts, banners
│   │   ├── context/              # Global state (Auth, Portfolio, Holdings)
│   │   └── lib/                  # Socket.IO client, API utilities, and configuration
│   └── tailwind.config.js        # Custom institutional dark palette & design tokens
├── backend/                      # Node.js, Express, Socket.IO
│   ├── src/
│   │   ├── models/               # Mongoose data schemas (User, Order, Holding, etc.)
│   │   ├── services/             # TradeEngine, MarketData, HistoricalClient, Mailer
│   │   ├── db/                   # Database client & connection lifecycle
│   │   └── server.js             # Express API endpoints & real-time WebSocket server
│   └── .env.example              # Environment variables template
├── database_schema.sql           # Database schema documentation
├── package.json                  # Root runner scripts (concurrently)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or later
* **npm**: v9.0.0 or later
* **MongoDB**: Running locally on `mongodb://localhost:27017` or a MongoDB Atlas URI

### 1. Clone & Install
```bash
git clone https://github.com/harshc17/PapertTradeX.git
cd PapertTradeX

# Install root, backend, and frontend dependencies in one command
npm run install:all
```

### 2. Configure Environment Variables
Create your backend environment configuration:
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and supply your secrets:
```env
# Database & Authentication
MONGODB_URI=mongodb://localhost:27017/papertradex
JWT_SECRET=your_super_secret_jwt_key_here
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Optional: Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id

# Optional: Password Reset Mailer (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=PaperTradeX <noreply@papertradex.com>

# Optional: AI Market Analyst (Provide at least one)
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

### 3. Launch Development Servers
Run both backend and frontend concurrently from the project root:
```bash
npm start
```

* **Frontend:** [http://localhost:3000](http://localhost:3000)
* **Backend API & WebSockets:** [http://localhost:3001](http://localhost:3001)

Or run each service individually:
```bash
# Terminal 1: Backend API
cd backend && npm run dev

# Terminal 2: Frontend Next.js
cd frontend && npm run dev
```

---

## 📈 Portfolio P&L Calculation Logic

PaperTradeX adheres to precise financial accounting standards for positions:

1. **Invested Capital (Cost Basis):**
   $$\text{Invested} = \sum (\text{Quantity} \times \text{Average Buy Price})$$
2. **Current Valuation:**
   $$\text{Current Value} = \sum (\text{Quantity} \times \text{Current LTP})$$
3. **Total Unrealized Returns:**
   $$\text{Total Returns} = \text{Current Value} - \text{Invested}$$
   $$\text{Total Returns \%} = \frac{\text{Total Returns}}{\text{Invested}} \times 100$$
4. **Today's Gain (1D Performance):**
   $$\text{Day Gain (₹)} = \sum (\text{Quantity} \times \text{1-Day Price Change})$$
   $$\text{Day Gain \%} = \frac{\text{Day Gain}}{\text{Total Invested}} \times 100$$

---

## 🛡️ Security & Best Practices

* **Passwords:** Salted and hashed using `bcryptjs`.
* **Sessions:** Stateless authorization via secure JWT tokens stored client-side and verified on protected endpoints.
* **Secrets:** Strict `.gitignore` rules prevent accidental commit of `.env`, cache directories, and local credentials.
* **Safety:** This platform is strictly a **paper trading simulation** and does not interact with live brokerage funds.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add some amazing feature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
