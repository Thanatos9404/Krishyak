# India-first workspace language scope

The final activation brief supersedes the earlier ten-language pilot restriction.
All 22 scheduled Indian languages and Indian English are active. The shared
`frontend/src/i18n/pilotLanguages.json` registry drives the picker, generation,
validation and browser matrix. Profile updates accept the same 23 codes and
reject unsupported languages.

Each Indian language has 1,767 static workspace labels. Selecting a language
loads only its versioned static JSON pack, with no runtime translation call.
The service worker caches selected public packs. Source hashes prevent stale
translations from being reused after a UI change. User-entered names and notes
remain unchanged, and localized labels preserve canonical API values.

Most packs use Sarvam Translate v1. Its Sindhi output used Devanagari, so the
Sindhi pack instead uses Sarvam's document translation API with explicit Arabic
script guidelines. A four-label public probe established Arabic output and HTML
identifier preservation before the full bounded run. The full document had
44,459 submitted text characters, an estimated 223 existing credits, and a hard
250-credit limit. No credits were purchased. Sindhi metadata identifies the
actual document API and provider-managed model instead of claiming Translate v1.
The resumable generator is `backend/generate_sindhi_document_locale.py`.

`WORKSPACE_LOCALE_VALIDATION.json` records all 22 packs passing exact source key,
hash, interpolation, protected glossary, critical-label and script checks.
Kashmiri, Sindhi and Urdu use right-to-left layout. Manipuri uses Meitei Mayek;
Santali uses Ol Chiki. Machine translation still needs native-speaker review.
Structural validation cannot establish semantic correctness or agronomic safety.

The browser matrix checks every configured language at mobile and desktop
widths and through authenticated Today, Farm, Health, Market, More and Settings
routes. It verifies localized crop/state/district search, saved canonical
values, language persistence, right-to-left layout and accessibility. The current
release audit records which runs actually completed; this matrix definition
alone is not a claim that production, physical phones or native review passed.

Private speech is separately capability-gated. Sarvam STT uses its documented
23 language tags; server TTS exposes only languages actually available from the
configured provider. Device readout selects a voice for the chosen language.
Bhashini remains disabled until usable credentials and production approval exist.
Unavailable voice support displays a localized written-advice fallback without
switching the farmer to an unrelated language. Explicit consent, authenticated
requests, weighted Redis budgets and bounded audio processing apply to private
speech. Live synthetic speech probes are not real farmer microphone validation.

The [crop identity record](CROP_IDENTITIES.md), [India integration status](INDIA_DATA_INTEGRATIONS.md)
and [final activation audit](FINAL_PRODUCTION_AUDIT.md) carry related evidence.
