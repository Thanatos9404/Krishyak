import { useProductLocale } from "../product/ProductLocale";
import React, { useEffect, useState } from "react";
export default function LocalReadout({ text }) {
  const { tx } = useProductLocale();
  const [voice, setVoice] = useState(null),
    [speaking, setSpeaking] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const engine = window.speechSynthesis;
    if (!engine) return;
    const update = () =>
      setVoice(
        engine
          .getVoices()
          .find(
            (value) =>
              value.localService === true && value.lang.startsWith("en"),
          ) || null,
      );
    update();
    engine.addEventListener("voiceschanged", update);
    return () => {
      engine.removeEventListener("voiceschanged", update);
      engine.cancel();
    };
  }, []);
  useEffect(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, [text]);
  return (
    <div>
      <button
        disabled={!voice || !text}
        onClick={() => {
          window.speechSynthesis.cancel();
          if (speaking) {
            setSpeaking(false);
            return;
          }
          const utterance = new SpeechSynthesisUtterance(text.slice(0, 5000));
          utterance.voice = voice;
          utterance.lang = voice.lang;
          utterance.onend = () => setSpeaking(false);
          utterance.onerror = () => {
            setSpeaking(false);
            setError(
              "Read-aloud is unavailable. The written advice remains available.",
            );
          };
          setError("");
          setSpeaking(true);
          window.speechSynthesis.speak(utterance);
        }}
      >
        {speaking
          ? tx("Stop reading")
          : tx("Read today’s advice aloud in English")}
      </button>
      <p>
        {voice
          ? tx(
              "Uses an installed device voice. No speech-provider request is sent.",
            )
          : tx(
              "No installed English device voice is available. Written advice remains available.",
            )}
      </p>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
