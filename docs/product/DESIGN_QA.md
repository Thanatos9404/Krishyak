# Design and accessibility QA
## Verification scope
Public SSR and interactions, synthetic demo, anonymous sign-in, signed-in Today/Farm/Scan/Market/More, settings, benefits, planning, institutional permission gate. Production-build Playwright projects use Chromium, Firefox and WebKit. Viewports: 320, 360, 375, 390, 412, 768, 1024, 1280 and 1440px. These are emulated viewports, not physical Android/iOS tests.

Full-page evidence is generated under output/product/screenshots/{engine}; private screenshots contain only explicitly synthetic local accounts. Local in-app browser inspection separately verifies the actual OpenFreeMap map worker, corner control, undo/redo and public layout.

## Checks
No page-level horizontal overflow. Axe WCAG 2.0 A/AA, 2.1 AA and 2.2 AA across public/demo and farmer routes. Native dialog Escape, focus containment/restoration, labeled forms, keyboard map controls, visible focus, semantic navigation and reduced motion. A 640px CSS viewport checks a 1280px display at 200% effective zoom. Touch controls use 44px primary targets. Inline text links retain their surrounding text context.

## Issues found and resolved
- A broad demo SVG rule enlarged a button icon; it now targets the chart directly.
- Offline opt-in checked state waited for IDB; state now updates immediately, rolls back on failure and confirms only after commit.
- Clean Linux CI found the same pending-state gap in first-use processing permissions. Only the control displays its pending choice immediately; actual processing continues to use server-confirmed consents. A failed save rolls the control back, and success is announced after refresh. Browser tests now withdraw/regrant permission even on previously used synthetic accounts.
- Late crop-cycle evidence could replace an explicitly chosen Scan crop. Automatic crop defaults now stop after the farmer chooses a crop, and reset when the selected field changes. Regression tests cover both cases.
- Legal pages lacked breadcrumb JSON-LD; visible and schema breadcrumbs are now aligned.
- Dialog Tab could reach browser chrome; native modals additionally contain Tab/Shift+Tab and restore the initiating control.
- A public numbered label and inherited market retry button failed contrast; both use darker tokens.
- WebKit native select painting overflowed at 320px with long field names. Explicit constrained appearance and the native control's accessible name prevent overflow without clipping the page.
- Populated simulation exposed an unnamed organic toggle and pale green/yellow result text. The toggle is now a labeled switch with its checked state; result text and numeric risk values have strong contrast.
- Visual inspection found browser-default text-link buttons and a bare planning empty state. Scoped button resets and original photo/card layouts now match the product shell.
- An inherited MSP link led to a nonexistent /msp page. It now reaches dated, expandable official records inside Market.
- Font fallbacks fetched unused scripts on English pages. English uses Geologica/system fallback; selected Indic scripts retain the locally hosted font stack.
- Native page navigation could leave field evidence reads pending in WebKit. Reads now cancel on replacement and page exit; cancellation cannot become a network cache fallback. Back-forward cache restores recheck the anonymous account shell.

Hindi planning inputs were visually checked at 390px with loaded local fonts, long translated accordion labels and a native scrollable dialog. The page remained 390px wide. Evidence: output/product/hindi-mobile.jpg. This checks layout, not linguistic correctness or complete workspace translation.

## Boundaries
Automated accessibility is a subset of WCAG and cannot certify universal accessibility. No human farmer study, professional screen-reader audit, language approval or agronomist review is claimed. Wider legacy language packs remain usable in planning; new workspace copy explicitly falls back to English and must not be presented as fully reviewed multilingual field software. Final machine counts and release/deployment evidence are in UI_REBUILD_REPORT.md.
