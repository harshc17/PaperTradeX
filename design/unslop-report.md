# PaperTradeX design pass

Direction approved by the site owner: a calm, exact Indian trading workspace with graphite surfaces, restrained teal, clearer figures and quiet controls. The owner requested removal of the unverified stock-count claim.

## Nine passes

1. **Spacing:** regularised list gaps, card padding and control corners. The desktop dashboard gives market information a fluid main column and tools a 280px column; the mobile portfolio remains above market information.
2. **Color:** introduced a graphite surface ramp, three text roles, a teal brand accent, and restrained gain/loss colors. Removed colored shadows, surface gradients, blurred decorative blobs and the page-wide grid. Screeners use the same dark surfaces as the rest of the app.
3. **Icons:** retained Lucide and original company images, removed decorative sparkles and large AI icon tiles, and aligned the tools list around one icon column. Kept the existing Georgia Italic wordmark and flat chart mark.
4. **Copy:** removed the 5000+ claim, shortened task labels and replaced the greeting heading. The sign-in panel shows the actual default starting virtual balance. Market Overview now distinguishes market-session state from snapshot refresh time; chart connection labels do not imply that a closed market is live.
5. **Type:** Hanken Grotesk for the interface and JetBrains Mono for figures. Reduced heavy weights, removed widely tracked uppercase styling, enlarged small captions and standardised currency formatting. Georgia Italic remains only in the requested brand wordmark.
6. **Layout:** preserved features and section order. Retained the sign-in split while replacing its decoration with a real starting-account preview. Added a compact mobile navigation disclosure with all existing destinations.
7. **Details:** quieter counts, consistent surfaces and focus outlines, linked form labels, password-toggle names, account-menu state and selected-navigation semantics.
8. **Visuals:** real market charts, portfolio figures and the existing company logos provide visual detail. Updated chart labels, muted volume bars and tooltip surfaces. No generated artwork, replacement logos or image prompts were used.
9. **Motion:** removed idle pings, card lifts, broad transition-all rules and extra entrance sequences. Retained loading feedback, brief quote changes, press feedback and reduced-motion support.

## Existing feature connections

The dashboard news and portfolio review components contained hard-coded localhost endpoints. They now use the same configured backend URL as the rest of the app. No authentication, database or trading-engine rules were changed.

## Checks

- Production build and TypeScript checks passed
- Local sign-in preview checked against the approved direction
- Contrast ratios: primary text 15.73:1; secondary text 8.23:1; captions on the raised surface 4.95:1; dark text on teal controls 5.86:1
- Existing company image assets and branding files preserved
- Live route, navigation and responsive checks recorded after release
- Private admin content cannot be visually verified with the ordinary QA account

## Attribution

Design process adapted from **unslop by Damir Sokolovsky (@heydamir)**, CC BY 4.0: https://github.com/heydamir/unslop
