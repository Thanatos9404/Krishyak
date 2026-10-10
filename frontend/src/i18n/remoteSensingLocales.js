// Additive feature packs preserve the existing reviewed/generated UI packs.
// Until a translated pack is available, the provider explicitly falls back to English.
import english from './locales/remote-sensing/en.json';
export const REMOTE_SENSING_LOCALE_LOADERS = {
  en: async () => english,
  as: () => import('./locales/remote-sensing/as.json').then(module => module.default),
  bn: () => import('./locales/remote-sensing/bn.json').then(module => module.default),
  brx: () => import('./locales/remote-sensing/brx.json').then(module => module.default),
  doi: () => import('./locales/remote-sensing/doi.json').then(module => module.default),
  gu: () => import('./locales/remote-sensing/gu.json').then(module => module.default),
  hi: () => import('./locales/remote-sensing/hi.json').then(module => module.default),
  kn: () => import('./locales/remote-sensing/kn.json').then(module => module.default),
  ks: () => import('./locales/remote-sensing/ks.json').then(module => module.default),
  kok: () => import('./locales/remote-sensing/kok.json').then(module => module.default),
  mai: () => import('./locales/remote-sensing/mai.json').then(module => module.default),
  ml: () => import('./locales/remote-sensing/ml.json').then(module => module.default),
  mni: () => import('./locales/remote-sensing/mni.json').then(module => module.default),
  mr: () => import('./locales/remote-sensing/mr.json').then(module => module.default),
  ne: () => import('./locales/remote-sensing/ne.json').then(module => module.default),
  or: () => import('./locales/remote-sensing/or.json').then(module => module.default),
  pa: () => import('./locales/remote-sensing/pa.json').then(module => module.default),
  sa: () => import('./locales/remote-sensing/sa.json').then(module => module.default),
  sat: () => import('./locales/remote-sensing/sat.json').then(module => module.default),
  sd: () => import('./locales/remote-sensing/sd.json').then(module => module.default),
  ta: () => import('./locales/remote-sensing/ta.json').then(module => module.default),
  te: () => import('./locales/remote-sensing/te.json').then(module => module.default),
  ur: () => import('./locales/remote-sensing/ur.json').then(module => module.default),
};
