import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Keyboard,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  Volume2,
  WifiOff,
  X,
} from "lucide-react";
import { useProductLocale } from "../../features/product/ProductLocale";
import {
  ACTION_LINKS,
  useVoiceAssistant,
} from "../../features/product/useVoiceAssistant";
import { VoiceOrb } from "./VoiceOrb";
import { SUGGESTIONS } from "../../features/product/voiceLauncher";

const STATUS = {
  idle: "Tap the mic and ask your question",
  listening: "Listening… tap again when you finish",
  transcribing: "Understanding your words…",
  thinking: "Finding the answer…",
  speaking: "Speaking… tap to stop",
};

// Full-screen voice help. Big mic, plain words, answers spoken aloud in the
// farmer's language, with a typed fallback that always works.
export function VoiceMode({ workspace: w, onClose }) {
  const { tx, info } = useProductLocale();
  const titleId = useId();
  const still = useReducedMotion();
  const voice = useVoiceAssistant(w);
  const [typing, setTyping] = useState(false),
    [draft, setDraft] = useState("");
  const panel = useRef(null),
    end = useRef(null),
    opener = useRef(null);
  const { cancel } = voice;
  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.querySelector(".voice-orb-button, button")?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      opener.current?.focus?.();
    };
  }, []);
  useEffect(() => {
    const close = (event) => {
      if (event.key === "Escape") {
        cancel();
        onClose();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [cancel, onClose]);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [voice.turns.length, voice.phase]);
  const close = () => {
    voice.cancel();
    onClose();
  };
  const busy = ["transcribing", "thinking"].includes(voice.phase);
  const submit = (event) => {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    voice.ask(draft);
    setDraft("");
  };
  const unavailable = w.offline || voice.configured === false;
  return createPortal(
    <motion.div
      className="voice-mode"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      ref={panel}
      initial={still ? { opacity: 0 } : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={still ? { opacity: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
      lang={info.speechCode}
      dir={info.direction}
    >
      <div className="voice-backdrop" aria-hidden="true">
        <span className="voice-blob one" />
        <span className="voice-blob two" />
        <span className="voice-blob three" />
      </div>
      <header className="voice-header">
        <span className="voice-language">{info.nativeName}</span>
        <h2 id={titleId}>{tx("Ask Krishyak")}</h2>
        <button
          type="button"
          className="voice-close"
          onClick={close}
          aria-label={tx("Close voice help")}
        >
          <X size={26} />
        </button>
      </header>
      <div className="voice-conversation" aria-live="polite">
        {voice.turns.length === 0 && (
          <div className="voice-welcome">
            <p className="voice-hello">
              {tx("Namaste{{v0}}! How can I help you today?", {
                v0: w.farmer?.display_name ? `, ${w.farmer.display_name}` : "",
              })}
            </p>
            <p>
              {tx(
                "Ask about weather, mandi prices, plant problems or your field. Speak in {{v0}}.",
                { v0: info.nativeName },
              )}
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {voice.turns.map((turn, index) => (
            <motion.div
              key={index}
              className={`voice-turn ${turn.role}`}
              initial={still ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="sr-only">
                {turn.role === "farmer" ? tx("You said:") : tx("Krishyak:")}
              </span>
              <p>{turn.text}</p>
              {turn.role === "assistant" && (
                <div className="voice-turn-actions">
                  <button
                    type="button"
                    className="voice-chip"
                    onClick={() => voice.replay(turn.text)}
                  >
                    <Volume2 size={18} /> {tx("Listen again")}
                  </button>
                  {ACTION_LINKS[turn.action] && (
                    <a
                      className="voice-chip strong"
                      href={ACTION_LINKS[turn.action][0]}
                      onClick={() => voice.cancel()}
                    >
                      {tx(ACTION_LINKS[turn.action][1])}{" "}
                      <ArrowRight size={18} />
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {voice.problem && (
          <p className="voice-problem" role="alert">
            {tx(voice.problem)}
          </p>
        )}
        <span ref={end} />
      </div>
      {!voice.allowed ? (
        <section className="voice-consent" aria-label={tx("Allow voice help")}>
          <ShieldCheck size={30} aria-hidden="true" />
          <h3>{tx("Allow voice help")}</h3>
          <p>
            {tx(
              "Your voice and question are sent to Sarvam AI, an Indian language service, to understand and answer you. Krishyak does not save your recording or question. You can turn this off in Settings.",
            )}
          </p>
          <button
            type="button"
            className="voice-primary"
            disabled={voice.granting || w.offline}
            onClick={voice.grant}
          >
            {voice.granting ? tx("Saving…") : tx("Allow and start")}
          </button>
        </section>
      ) : (
        <div className="voice-controls">
          {unavailable ? (
            <p className="voice-status" role="status">
              <WifiOff size={20} aria-hidden="true" />{" "}
              {w.offline
                ? tx("You are offline. Voice help needs the internet.")
                : tx(
                    "Voice help is not available right now. Please try later.",
                  )}
            </p>
          ) : (
            <>
              {voice.turns.length === 0 && !typing && (
                <div
                  className="voice-suggestions"
                  aria-label={tx("Try asking")}
                >
                  {SUGGESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="voice-chip"
                      disabled={busy}
                      onClick={() => voice.ask(tx(question))}
                    >
                      {tx(question)}
                    </button>
                  ))}
                </div>
              )}
              <VoiceOrb
                phase={voice.phase}
                size={typing ? 92 : 148}
                disabled={busy || voice.micSupported === false}
                onClick={
                  voice.phase === "speaking" ? voice.stopSpeaking : voice.listen
                }
                label={
                  voice.phase === "listening"
                    ? tx("Stop and send")
                    : voice.phase === "speaking"
                      ? tx("Stop speaking")
                      : tx("Tap to speak")
                }
              />
              <p className="voice-status" role="status">
                {voice.micSupported === false && voice.phase === "idle"
                  ? tx("Voice is not available on this phone. Please type.")
                  : tx(STATUS[voice.phase])}
              </p>
              {typing ? (
                <form className="voice-type" onSubmit={submit}>
                  <label className="sr-only" htmlFor={`${titleId}-question`}>
                    {tx("Type your question")}
                  </label>
                  <input
                    id={`${titleId}-question`}
                    value={draft}
                    maxLength={500}
                    autoComplete="off"
                    placeholder={tx("Type your question")}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    aria-label={tx("Send question")}
                  >
                    <Send size={22} />
                  </button>
                </form>
              ) : null}
              <div className="voice-secondary">
                <button
                  type="button"
                  className="voice-link"
                  onClick={() => setTyping(!typing)}
                >
                  <Keyboard size={18} />{" "}
                  {typing ? tx("Speak instead") : tx("Type instead")}
                </button>
                {voice.turns.length > 0 && (
                  <button
                    type="button"
                    className="voice-link"
                    onClick={voice.reset}
                  >
                    <RotateCcw size={18} /> {tx("New question")}
                  </button>
                )}
              </div>
            </>
          )}
          <p className="voice-footnote">
            {tx("Answers can be wrong. Before spraying or buying, call")}{" "}
            <a href="tel:18001801551">
              <Phone size={14} /> {tx("Kisan Call Centre 1800-180-1551")}
            </a>
          </p>
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
