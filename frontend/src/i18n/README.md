# Krishyak language support

Krishyak includes English and all 22 languages in the Eighth Schedule of the Indian Constitution. Each language has a BCP-47 speech locale, a native-script label, and layout direction metadata.

## Runtime design

- English ships in the initial bundle; Indian-language packs load only when selected.
- UI translation is static: Sarvam generates committed packs once using the server-only key. Selecting a language downloads its static pack without a paid translation request. Regeneration reuses cached unchanged strings.
- The selected language is saved on the device and applied to document language and text direction.
- Speech input records up to 29 seconds through MediaRecorder and uses backend Sarvam Saaras v3 transcription in the selected language. Typed input remains available. Sarvam Bulbul v3 read-aloud supports 11 languages; unsupported languages show an explicit unavailable state. Server-side quotas and bounded audio caching control paid usage.
- Voice parsing understands localized crop, soil, area-unit, rainfall, and risk terms and maps them to the application's existing canonical data values.

## Translation quality policy

Copy uses short, task-based wording suited to low-literacy users. English remains the safe fallback for untranslated technical content. Before a public agricultural deployment, every pack should receive native-speaker review in its target region, especially treatment, pesticide, financial, identity, and government-scheme guidance.

Keep translations in locale packs rather than component conditionals. Generate with `backend/generate_sarvam_locales.py`, then validate all keys, placeholders and source hashes using `backend/verify_sarvam_locales.py`. Packs under `locales/sarvam` are machine translated and have not received native-speaker review; their metadata records this explicitly. Runtime API text is not automatically sent for translation.
