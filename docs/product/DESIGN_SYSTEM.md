# Krishyak design system
## Principles
A field companion with the conclusion first, evidence next, and technical detail on request. Warm paper, generous spacing, restrained forest green and real agricultural photography adapt the OneSoil reference to an original Krishyak identity. No reference logos, illustrations, screenshots or proprietary assets were copied.

## Tokens and typography
Source of truth: frontend/src/design/tokens.css. Paper #f7f6f0, surface #fffefa, ink #20392d, forest #214b3a, muted #5b675d, sage #e7eddf, earth #86602c. Earth was darkened after measured contrast testing. Radii 12/24/32px; motions 160/260/450ms with reduced-motion overrides. Geologica is locally hosted with script-specific Noto fallback families and SIL OFL texts. Body starts at 16px, 1.6 line height. Headings use moderate weight, balanced wrapping and fluid sizes.

## Components and behavior
Pill public header; editorial image sections; original leaf wordmark; low-contrast borders, high-contrast text; plain language status badges. Farmer navigation is a desktop sidebar and mobile bottom bar: Today, Farm, Scan, Market, More. The field selector has an accessible name and shows the chosen field. Actions use explicit verbs and 44px targets. Dialogs use native modal semantics, Escape, focus containment and restoration. Optional source details use native disclosure controls.

## Photography
Seven different licensed Pexels photographs describe field patterns, farmers, produce, terraces, field work, markets and community. Every image has explicit dimensions and 400/800/1440 WebP sources. Priority is reserved for visible hero photography; other images load lazily. Depicted people are illustrative and never represented as users, founders or endorsers. Credits and the complete source/byte/hash manifest live at /credits and frontend/public/asset-provenance.json.

## States
Loading is a neutral status; missing data is unavailable, never a healthy result. Cached private evidence names its save date. Queued actions say waiting to sync. Development accounts, synthetic demonstrations, simulation outputs and unsupported crop results are labeled. Native draft policy acceptance and granular consent remain visible.
