"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  CloudSun,
  Fingerprint,
  Globe2,
  IndianRupee,
  Landmark,
  MapPin,
  Mic,
  Phone,
  Satellite,
  ShieldCheck,
  Sprout,
  WifiOff,
} from "lucide-react";
import {
  ProductLocaleProvider,
  useProductLocale,
} from "../../features/product/ProductLocale";
import { SUPPORTED_LANGUAGES } from "../../i18n/config";
import { SUGGESTIONS } from "../../features/product/voiceLauncher";
import { ProductLanguageChooser } from "../product/ProductLanguageChooser";
import { Brand } from "../public/Brand";
import { Photo } from "../public/Photo";
import { HeroScene } from "./HeroScene";

const QUICK_LANGUAGES = [
  "hi",
  "en",
  "mr",
  "bn",
  "te",
  "ta",
  "gu",
  "kn",
  "pa",
  "ml",
  "or",
  "as",
];
const FEATURES = [
  [
    Camera,
    "Check a sick plant",
    "Take a photo of one leaf. See the likely problem and the first safe steps.",
    "tomatoes",
  ],
  [
    IndianRupee,
    "Mandi prices near you",
    "Latest rates from nearby mandis, and whether they are going up or down.",
    "market",
  ],
  [
    Satellite,
    "Field watch from space",
    "Satellite pictures show where your crop looks stressed, so you know where to walk.",
    "fields",
  ],
];
const SMALL_FEATURES = [
  [
    CloudSun,
    "Weather for your field",
    "Rain, heat and wind for the next two days, and what it means for spraying.",
  ],
  [
    Landmark,
    "Government schemes",
    "Official links for PM-KISAN, crop insurance and soil health cards.",
  ],
  [
    WifiOff,
    "Works on weak internet",
    "Your field records stay on the phone and sync when the network returns.",
  ],
];
const STEPS = [
  [
    Fingerprint,
    "Sign in with your fingerprint",
    "No password and no OTP. Use your phone's fingerprint or screen lock.",
  ],
  [
    MapPin,
    "Add your field",
    "Stand in your field and tap one button. Add the crop you have sown.",
  ],
  [
    Mic,
    "Tap the mic and ask",
    "Ask anything about your crop, weather or prices. Hear the answer.",
  ],
];

const reveal = (still, delay = 0) =>
  still
    ? {}
    : {
        initial: { opacity: 0, y: 28 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-60px" },
        transition: { duration: 0.55, delay, ease: [0.22, 0.61, 0.36, 1] },
      };

function RotatingQuestion() {
  const { tx } = useProductLocale();
  const still = useReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (still) return undefined;
    const timer = setInterval(
      () => setIndex((value) => (value + 1) % SUGGESTIONS.length),
      3200,
    );
    return () => clearInterval(timer);
  }, [still]);
  return (
    <p className="voice-band-question" aria-live="off">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.35 }}
        >
          “{tx(SUGGESTIONS[index])}”
        </motion.span>
      </AnimatePresence>
    </p>
  );
}

function LanguageStrip() {
  const { tx, language, changeLanguage, loading } = useProductLocale();
  return (
    <section className="landing-languages" aria-labelledby="languages-heading">
      <div className="container">
        <h2 id="languages-heading">
          <Globe2 size={24} aria-hidden="true" /> {tx("Choose your language")}
        </h2>
        <div className="language-chips">
          {QUICK_LANGUAGES.map((code) => {
            const row = SUPPORTED_LANGUAGES[code];
            return (
              <button
                key={code}
                type="button"
                className="language-chip"
                aria-pressed={language === code}
                disabled={loading}
                lang={row.speechCode}
                onClick={() => changeLanguage(code)}
              >
                {row.nativeName}
              </button>
            );
          })}
          <ProductLanguageChooser moreLabel="All languages" />
        </div>
        <p>
          {tx(
            "Krishyak works in 22 Indian languages and English. You can change it any time.",
          )}
        </p>
      </div>
    </section>
  );
}

function Landing() {
  const { tx, info } = useProductLocale();
  const still = useReducedMotion();
  return (
    <div className="landing" lang={info.speechCode} dir={info.direction}>
      <noscript>
        <style>{`.landing [style*="opacity"]{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <a href="#landing-main" className="skip-link">
        {tx("Skip to content")}
      </a>
      <header className="landing-header">
        <div className="container landing-header-inner">
          <Brand />
          <nav className="landing-links" aria-label={tx("Site")}>
            <a href="/how-it-works">{tx("How it works")}</a>
            <a href="/for-farmers">{tx("For farmers")}</a>
            <a href="/demo">{tx("Demo farm")}</a>
          </nav>
          <div className="landing-header-actions">
            <ProductLanguageChooser />
            <a className="landing-signin" href="/app/today">
              {tx("Sign in")}
            </a>
          </div>
        </div>
      </header>
      <main id="landing-main">
        <section className="landing-hero">
          <div className="landing-shape shape-a" aria-hidden="true" />
          <div className="landing-shape shape-b" aria-hidden="true" />
          <div className="container landing-hero-grid">
            <div className="landing-hero-copy rise-in">
              <span className="landing-pill">
                <Sprout size={16} aria-hidden="true" />{" "}
                {tx("Free for Indian farmers")}
              </span>
              <h1>{tx("Your farming helper that listens.")}</h1>
              <p className="landing-lead">
                {tx(
                  "Ask about rain, mandi prices and sick plants by speaking in your own language. Krishyak answers aloud.",
                )}
              </p>
              <div className="landing-cta">
                <a className="landing-button primary" href="/app/today">
                  <Fingerprint size={22} aria-hidden="true" />
                  {tx("Start free")}
                </a>
                <a className="landing-button ghost" href="/app/today">
                  {tx("I already have an account")}{" "}
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              </div>
              <p className="landing-note">
                <ShieldCheck size={18} aria-hidden="true" />
                {tx(
                  "No password. Sign in with your phone's fingerprint or screen lock.",
                )}
              </p>
            </div>
            <HeroScene />
          </div>
        </section>
        <LanguageStrip />
        <section
          className="landing-section container"
          aria-labelledby="features-heading"
        >
          <motion.div className="landing-heading" {...reveal(still)}>
            <h2 id="features-heading">
              {tx("Everything for your field, in one place")}
            </h2>
            <p>{tx("Big buttons, simple words and your own language.")}</p>
          </motion.div>
          <div className="feature-grid">
            <motion.article className="feature-voice" {...reveal(still)}>
              <div className="feature-voice-orb" aria-hidden="true">
                <Mic size={46} />
              </div>
              <h3>{tx("Ask by voice")}</h3>
              <p>
                {tx(
                  "Tap the big mic and speak. Krishyak uses your field, crop, weather and mandi records to answer in your language.",
                )}
              </p>
            </motion.article>
            {FEATURES.map(([Icon, title, text, photo], index) => (
              <motion.article
                className="feature-photo"
                key={title}
                {...reveal(still, 0.08 * (index + 1))}
              >
                <Photo
                  name={photo}
                  decorative
                  sizes="(max-width: 700px) 100vw, 33vw"
                />
                <div>
                  <span className="feature-icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <h3>{tx(title)}</h3>
                  <p>{tx(text)}</p>
                </div>
              </motion.article>
            ))}
            {SMALL_FEATURES.map(([Icon, title, text], index) => (
              <motion.article
                className="feature-small"
                key={title}
                {...reveal(still, 0.06 * index)}
              >
                <span className="feature-icon" aria-hidden="true">
                  <Icon size={24} />
                </span>
                <h3>{tx(title)}</h3>
                <p>{tx(text)}</p>
              </motion.article>
            ))}
          </div>
        </section>
        <section className="voice-band" aria-labelledby="voice-band-heading">
          <div className="container voice-band-inner">
            <div className="voice-band-orb" aria-hidden="true">
              {!still &&
                [0, 0.7, 1.4].map((delay) => (
                  <motion.span
                    key={delay}
                    initial={{ scale: 1, opacity: 0.45 }}
                    animate={{ scale: 2.1, opacity: 0 }}
                    transition={{ duration: 2.1, repeat: Infinity, delay }}
                  />
                ))}
              <Mic size={52} />
            </div>
            <div>
              <h2 id="voice-band-heading">
                {tx("Just ask, like you ask a friend")}
              </h2>
              <RotatingQuestion />
              <p>
                {tx(
                  "Answers are short and spoken aloud. For sprays and medicines, Krishyak always tells you to confirm with an expert first.",
                )}
              </p>
            </div>
          </div>
        </section>
        <section
          className="landing-section container"
          aria-labelledby="steps-heading"
        >
          <motion.div className="landing-heading" {...reveal(still)}>
            <h2 id="steps-heading">{tx("Start in three steps")}</h2>
          </motion.div>
          <ol className="landing-steps">
            {STEPS.map(([Icon, title, text], index) => (
              <motion.li key={title} {...reveal(still, 0.1 * index)}>
                <span className="step-number">{index + 1}</span>
                <Icon size={30} aria-hidden="true" />
                <h3>{tx(title)}</h3>
                <p>{tx(text)}</p>
              </motion.li>
            ))}
          </ol>
        </section>
        <section className="landing-final">
          <div className="container landing-final-grid">
            <Photo
              name="farmers"
              decorative
              sizes="(max-width: 700px) 100vw, 45vw"
            />
            <div>
              <h2>{tx("Your records stay yours.")}</h2>
              <ul>
                <li>
                  <ShieldCheck size={22} aria-hidden="true" />
                  {tx("Free to use. No ads. Delete your account any time.")}
                </li>
                <li>
                  <Sprout size={22} aria-hidden="true" />
                  {tx(
                    "Advice is a guide. Always check your field before acting.",
                  )}
                </li>
                <li>
                  <Phone size={22} aria-hidden="true" />
                  {tx("Need a person? Call the free Kisan Call Centre:")}{" "}
                  <a href="tel:18001801551">1800-180-1551</a>
                </li>
              </ul>
              <a className="landing-button primary" href="/app/today">
                <Fingerprint size={22} aria-hidden="true" />
                {tx("Start free")}
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="container landing-footer-inner">
          <Brand />
          <nav aria-label={tx("Footer")}>
            <a href="/how-it-works">{tx("How it works")}</a>
            <a href="/technology">{tx("Technology")}</a>
            <a href="/about">{tx("About")}</a>
            <a href="/faq">{tx("Questions")}</a>
            <a href="/privacy">{tx("Privacy")}</a>
            <a href="/terms">{tx("Terms")}</a>
            <a href="/credits">{tx("Photo credits")}</a>
            <a href="https://github.com/Thanatos9404/Krishyak">GitHub</a>
          </nav>
          <p>{tx("Made in India for Indian farmers.")}</p>
        </div>
      </footer>
    </div>
  );
}

export function FarmerLanding() {
  return (
    <ProductLocaleProvider>
      <Landing />
    </ProductLocaleProvider>
  );
}
