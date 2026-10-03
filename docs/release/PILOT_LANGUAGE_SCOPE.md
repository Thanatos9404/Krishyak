# First pilot language scope

The user's 3 October 2026 instruction narrows the first pilot to ten Indian
languages: Hindi, Urdu, Gujarati, Bengali, Marathi, Kannada, Tamil, Telugu,
Malayalam and Punjabi. English remains available. The remaining twelve scheduled
languages are deferred; this does not defer the rest of the release brief.

`frontend/src/i18n/pilotLanguages.json` defines the active choices and deferred
codes. Both translation providers accept only active choices. Older saved
preferences for a deferred language resolve to an active browser language or
English. Default workspace generation, validation and browser testing use the
same pilot list. The service worker caches only active workspace packs.

Workspace translations are static Sarvam output, generated explicitly with
bounded requests and submitted characters. Selecting a language does not call
a translation provider. The initial pilot completion used 95 provider requests
and 69,974 submitted characters; two additional fallback labels used 10 requests
and 630 characters. These runs used existing credits and purchased nothing.
Earlier work before the scope change is excluded from these run totals.

The English source has 762 strings. All ten packs pass source and pack hashes,
placeholder parity, protected glossary identity and script checks in
`WORKSPACE_LOCALE_VALIDATION.json`. The static server-message inventory contains
only source literals, never runtime farmer data. Pack metadata and the picker
explicitly disclose machine translation awaiting native-speaker review.

These checks establish structural integrity, not semantic or native-speaker
approval. User-entered names and notes remain unchanged. Dynamic crop labels,
locale date display, complete structured server-message coverage and speech
integration continue under the remaining release requirements.

Local validation: production build and formatting pass; 305 frontend tests pass.
The entry language matrix passes Chromium, Firefox and WebKit at 360 and 1440px,
including Urdu RTL, preference persistence, zero accessibility violations and
zero runtime translation calls. The complete seven-test WebKit product flow
also passes with passive requests cancelled during document navigation.
The expanded six-test matrix also passes all three engines: keyboard dismissal
returns focus to the picker, and Hindi/Urdu persist across Today, Farm, Scan,
Market, More and Settings after real isolated-development sign-in. Browser
checks retain their page-error assertions; the fixes do not suppress failures.
