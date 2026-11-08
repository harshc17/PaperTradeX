# PaperTradeX design audit and proposed direction

Status: awaiting the user's direction choice; no redesign edits made

Site reviewed: https://papertradex.in/dashboard, plus the shared styles and account, market, portfolio, screener and challenge components

Baseline: [Dashboard screenshot](unslop-before-dashboard.png)

## Direction

- **Product:** An Indian paper trading workspace where learners practise stock decisions with virtual funds
- **Character:** Calm, exact, practical
- **World:** An Indian trading desk: graphite surfaces, aligned price columns, clear market-session information and restrained teal
- **Moments:** Real stock charts and portfolio results carry the visual emphasis; company identities use the existing original logos
- **Signature:** A consistent, quiet NSE/BSE session and quote-time stamp that distinguishes a live feed from the last available price

Keep the PaperTradeX name, flat chart mark, teal Georgia Italic wordmark, original company logo assets, features and section order. Use the existing Hanken Grotesk family for interface text and restrained JetBrains Mono for figures and timestamps. The brand wordmark remains the intentional italic exception.

## Findings

1. **Competing accents:** Teal navigation, cyan action gradients, green highlights and purple tool/challenge cards compete on the dashboard. Locations: DashboardMarket, DashboardSidebar, Header, AIPortfolioAnalyst
2. **Colored glows:** Buy buttons, the balance badge, AI actions, challenge actions and trade controls use colored shadows. Locations: those components, challenge/page.tsx and TradingPanel
3. **Decorative backgrounds:** Radial washes, a page-wide grid and blurred color blobs sit behind functional content. Locations: globals.css, login/page.tsx, DashboardSidebar, DashboardNews and TradingPanel
4. **Inconsistent surfaces:** Black panels, blue trade/account panels and white screener tables lack a shared surface hierarchy. Locations: globals.css, TradingPanel, stock-screener/page.tsx, etf-screener/page.tsx and account pages
5. **Low-contrast metadata:** The #474746 faint-text role is hard to read on dark panels, especially labels and secondary instructions. Locations: shared color tokens and their uses throughout the app
6. **Too many type treatments:** Small serif section headings, heavy mono prices and several bold weights compete for attention. Locations: layout.tsx, globals.css, dashboard, holdings, orders and transaction pages
7. **Shouting labels:** Uppercase navigation, table labels and widely tracked captions dominate small interface text. Locations: Header, DashboardMarket, PortfolioSummary, TradingPanel, challenge and ledger pages
8. **Mixed number formats:** Header cash rounds to whole rupees, some portfolio figures omit trailing decimals and ledger figures show two decimals. Locations: Header, PortfolioSummary, holdings and transactions
9. **Decorative icons:** Purple/blue tool icons, large AI icon tiles and sparkles add emphasis unrelated to meaning. Locations: DashboardSidebar, AIPortfolioAnalyst, DashboardNews, ask-ai and challenge pages
10. **Uneven density:** Tool rows combine large icon boxes and wide padding, while table metadata and controls are tightly packed. Related cards use different padding, gaps and corner radii. Locations: dashboard sidebar, stock lists, screeners and trading controls
11. **Pills everywhere:** Counts, cash, AI labels and routine metadata use badge treatments; the permanent New and Beta labels distract. Locations: Header, DashboardSidebar, DashboardNews, login, holdings, orders and transactions
12. **Excess motion:** General transition-all rules, lifted/scaled cards and repeating status effects add movement without new information. The header indicator pings even when the market is closed. Locations: globals.css, Header, dashboard and trade/challenge controls
13. **Copy:** Greeting headings, long placeholders, promotional challenge copy and exclamation marks can be replaced by short task labels. Locations: login, dashboard sidebar, AI analysis, trading feedback and challenge
14. **Unverified claim:** The login panel says 5000+ Indian Stocks without a supporting count in the implementation. Ask the user whether that claim is verified; remove it unless confirmed
15. **Conflicting status language:** The dashboard's Live label reflects incoming updates, while the shared header reports NSE closed. Clearly separate feed freshness from market-session state. Locations: DashboardMarket and Header
16. **Generic sign-in visual:** The login's grid, color washes and marketing counters dominate the first impression. Rework the existing split around useful product information rather than background effects
17. **Emoji decoration:** A challenge completion message and legacy empty-state components contain emoji. Use the existing Lucide set or plain text where those components render

## Proposed nine passes

1. Spacing: establish 4px rhythm; align logo, company, price and action columns; preserve mobile touch targets
2. Color: use a graphite surface ramp, three readable text roles, one brand teal accent, and meaningful gain/loss colors
3. Icons: standardise existing Lucide icons and remove decorative icon tiles/sparkles; retain original company logos
4. Copy: shorten task labels, identify comparisons, distinguish closed-market prices, and resolve the stock-count claim
5. Type: use existing sans interface and mono figures at restrained weights; preserve the requested Georgia Italic branding
6. Layout: retain features and section order, improve proportions inside sections, and preserve the responsive portfolio placement
7. Details: unify nested radii, quieter status/count treatments, table alignment and keyboard focus states
8. Visuals: let real charts, figures and company logos supply the detail; no generated company logos or decorative artwork
9. Motion: keep loading, useful quote changes and interaction feedback; remove idle pulses and card lifts; respect reduced motion

## Validation after approval

Build the frontend, compare the result with this audit, and check phone, tablet and desktop layouts. Preserve the existing authentication and trading flows. Admin-only content cannot be visually verified through the ordinary QA account.

## Credits

Audit framework adapted from **unslop by Damir Sokolovsky (@heydamir)**, licensed CC BY 4.0: https://github.com/heydamir/unslop
