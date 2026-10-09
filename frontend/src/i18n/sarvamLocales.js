// Static build artifacts: switching language never calls a translation API.
// Sindhi is intentionally absent: locales/sarvam/sd.json was generated in
// Devanagari, but the interface renders Sindhi right-to-left in Perso-Arabic
// script. The provider uses the Perso-Arabic static pack instead, falling back
// to English for any key it lacks, until a reviewed Perso-Arabic pack exists.
export const SARVAM_LOCALE_LOADERS = {
  hi: () => import('./locales/sarvam/hi.json').then((m) => m.default),
  bn: () => import('./locales/sarvam/bn.json').then((m) => m.default),
  gu: () => import('./locales/sarvam/gu.json').then((m) => m.default),
  kn: () => import('./locales/sarvam/kn.json').then((m) => m.default),
  ml: () => import('./locales/sarvam/ml.json').then((m) => m.default),
  mr: () => import('./locales/sarvam/mr.json').then((m) => m.default),
  or: () => import('./locales/sarvam/or.json').then((m) => m.default),
  pa: () => import('./locales/sarvam/pa.json').then((m) => m.default),
  ta: () => import('./locales/sarvam/ta.json').then((m) => m.default),
  te: () => import('./locales/sarvam/te.json').then((m) => m.default),
  as: () => import('./locales/sarvam/as.json').then((m) => m.default),
  brx: () => import('./locales/sarvam/brx.json').then((m) => m.default),
  doi: () => import('./locales/sarvam/doi.json').then((m) => m.default),
  kok: () => import('./locales/sarvam/kok.json').then((m) => m.default),
  ks: () => import('./locales/sarvam/ks.json').then((m) => m.default),
  mai: () => import('./locales/sarvam/mai.json').then((m) => m.default),
  mni: () => import('./locales/sarvam/mni.json').then((m) => m.default),
  ne: () => import('./locales/sarvam/ne.json').then((m) => m.default),
  sa: () => import('./locales/sarvam/sa.json').then((m) => m.default),
  sat: () => import('./locales/sarvam/sat.json').then((m) => m.default),
  ur: () => import('./locales/sarvam/ur.json').then((m) => m.default),
};
