\---

name: Emerald Night
colors:
surface: '#131313'
surface-dim: '#131313'
surface-bright: '#3a3939'
surface-container-lowest: '#0e0e0e'
surface-container-low: '#1c1b1b'
surface-container: '#201f1f'
surface-container-high: '#2a2a2a'
surface-container-highest: '#353534'
on-surface: '#e5e2e1'
on-surface-variant: '#bccac2'
inverse-surface: '#e5e2e1'
inverse-on-surface: '#313030'
outline: '#86948d'
outline-variant: '#3d4a44'
surface-tint: '#59dcb2'
primary: '#59dcb2'
on-primary: '#003829'
primary-container: '#00a982'
on-primary-container: '#003527'
inverse-primary: '#006c52'
secondary: '#c8c6c5'
on-secondary: '#313030'
secondary-container: '#474746'
on-secondary-container: '#b7b5b4'
tertiary: '#bfc7cf'
on-tertiary: '#293138'
tertiary-container: '#8e969d'
on-tertiary-container: '#272f35'
error: '#ffb4ab'
on-error: '#690005'
error-container: '#93000a'
on-error-container: '#ffdad6'
primary-fixed: '#78f9cd'
primary-fixed-dim: '#59dcb2'
on-primary-fixed: '#002117'
on-primary-fixed-variant: '#00513d'
secondary-fixed: '#e5e2e1'
secondary-fixed-dim: '#c8c6c5'
on-secondary-fixed: '#1c1b1b'
on-secondary-fixed-variant: '#474746'
tertiary-fixed: '#dbe3ec'
tertiary-fixed-dim: '#bfc7cf'
on-tertiary-fixed: '#151d22'
on-tertiary-fixed-variant: '#40484e'
background: '#131313'
on-background: '#e5e2e1'
surface-variant: '#353534'
typography:
display-lg:
fontFamily: EB Garamond
fontSize: 48px
fontWeight: '500'
lineHeight: 56px
letterSpacing: -0.02em
display-lg-mobile:
fontFamily: EB Garamond
fontSize: 32px
fontWeight: '500'
lineHeight: 40px
letterSpacing: -0.01em
headline-md:
fontFamily: EB Garamond
fontSize: 24px
fontWeight: '500'
lineHeight: 32px
body-lg:
fontFamily: Hanken Grotesk
fontSize: 18px
fontWeight: '400'
lineHeight: 28px
body-md:
fontFamily: Hanken Grotesk
fontSize: 16px
fontWeight: '400'
lineHeight: 24px
data-mono:
fontFamily: JetBrains Mono
fontSize: 14px
fontWeight: '500'
lineHeight: 20px
letterSpacing: 0.02em
label-caps:
fontFamily: Hanken Grotesk
fontSize: 12px
fontWeight: '700'
lineHeight: 16px
letterSpacing: 0.1em
rounded:
sm: 0.125rem
DEFAULT: 0.25rem
md: 0.375rem
lg: 0.5rem
xl: 0.75rem
full: 9999px
spacing:
base: 8px
xs: 4px
sm: 12px
md: 24px
lg: 48px
xl: 80px
gutter: 24px
margin-desktop: 64px
margin-mobile: 20px
---

## Brand \& Style

This design system establishes a high-performance, "Kinetic Ledger" aesthetic for PaperTradeX. It blends the clinical precision of financial trading with a sophisticated, editorial atmosphere. The personality is authoritative, premium, and calm—prioritizing legibility and focus within a deep-space environment.

The visual style is a hybrid of **Minimalism** and **Tonal Layering**. It utilizes expansive dark surfaces to reduce eye strain during long trading sessions, punctuated by vibrant emerald accents that signify growth and action. Typography is the primary vehicle for brand expression, using a high-contrast serif for key narrative moments and a hyper-functional sans-serif for dense financial data.

## Colors

The palette is anchored by a deep, ink-black surface (`#0E0E0E`), providing a limitless backdrop that allows interface elements to emerge with clarity.

* **Primary Emerald (#00A982):** Used exclusively for high-priority calls to action, active states, and positive market trends.
* **Surface Strategy:** Backgrounds utilize the base black, while containers and cards use a slightly lighter grey-black (`#161616`) to create subtle depth without harsh contrast.
* **Accents:** Muted emerald tints are used for secondary indicators (like 10-20% opacity fills), ensuring the primary green remains impactful.
* **Typography:** Titles use a soft white (`#F0F0F0`), while data and body text use a more subdued silver-grey (`#8B949E`) to maintain visual hierarchy.

## Typography

The typography system creates a "financial journal" feel. It balances the elegance of **EB Garamond** for editorial highlights and greetings with the technical precision of **Hanken Grotesk** for interface controls.

* **Editorial Flourish:** Use EB Garamond for welcome headers, empty state titles, and significant portfolio milestones. It should always appear in light weights to maintain sophistication.
* **Functional Data:** Use JetBrains Mono for all numerical values, tickers, and prices. Monospaced characters ensure that numbers do not "jump" during real-time updates.
* **Hierarchy:** Maintain high contrast between labels (small, uppercase, wide tracking) and body text.

## Layout \& Spacing

The layout philosophy follows a **Fixed-Fluid Hybrid**. Content is centered within a maximum width of 1440px on desktop, while inner grids are fluid.

* **Rhythm:** A strict 8px base unit governs all dimensions.
* **Density:** High-density is reserved for data tables; however, the surrounding "wrapper" layout should be airy and expansive to evoke a premium feel.
* **Grid:** Use a 12-column grid for desktop with 24px gutters. On mobile, transition to a 4-column grid with 20px margins.
* **Safe Areas:** Provide generous vertical padding (`80px`+) between major sections (e.g., between the Portfolio Header and the Market Watchlist) to allow the design to "breathe."

## Elevation \& Depth

This design system avoids heavy shadows, instead using **Tonal Layering** and **Low-Contrast Outlines**.

* **Surfaces:** Depth is communicated by "stepping up" the luminosity of the grey. The further "forward" an object is, the lighter its hex value (within the #0E0E0E to #222222 range).
* **Glassmorphism:** Use subtle backdrop blurs (20px+) with a 5% white overlay for floating modals or navigation bars to maintain context of the underlying data.
* **Borders:** Containers should use a 1px solid border (`#ffffff10`) to define edges against the black background. Do not use borders on primary action buttons.

## Shapes

The shape language is "Soft-Precision." It avoids the playfulness of fully rounded corners in favor of a professional, structured look.

* **Standard Radius:** 4px (`rounded-sm`) for inputs and small components.
* **Container Radius:** 8px (`rounded-lg`) for cards and primary layout blocks.
* **Interactive Elements:** Buttons should never be pill-shaped; they should maintain the 4px radius to feel like solid, architectural blocks.

## Components

* **Buttons:** Primary buttons are solid `#00A982` with black text. Secondary buttons are ghost-style with a 1px `#ffffff20` border and white text. No shadows.
* **Input Fields:** Darker than the surface (`#050505`) with a 1px border. On focus, the border transitions to Primary Emerald. Labels sit above the field in `label-caps`.
* **Cards:** Background `#161616`. Titles in EB Garamond. Content should have at least 24px of internal padding.
* **Data Tables:** Remove all vertical grid lines. Use horizontal rules only (`#ffffff08`). The header row uses `label-caps` typography.
* **Chips/Badges:** Small, 2px radius. Use low-opacity fills (e.g., Emerald at 10% alpha) with solid emerald text for positive indicators.
* **The Ledger:** A custom component for trade history. It uses monospaced font exclusively, with a hairline vertical separator between the "Time" and "Action" columns.

