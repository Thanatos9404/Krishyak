import { useProductLocale } from "../product/ProductLocale";
import { workspaceSpeech } from "../product/workspaceSpeech";
import { useCallback, useEffect, useRef, useState } from "react";

export function selectedDeviceVoice(voices, language) {
  return (
    voices.find(
      (voice) =>
        voice.localService === true &&
        voice.lang?.split("-")[0].toLowerCase() === language,
    ) || null
  );
}

export default function LocalReadout({ text, workspace: w }) {
  const { tx, language, info } = useProductLocale();
  const [voice, setVoice] = useState(null),
    [speaking, setSpeaking] = useState(false),
    [error, setError] = useState(""),
    [serverAvailable, setServerAvailable] = useState(false);
  const request = useRef(null),
    context = useRef(null),
    source = useRef(null),
    generation = useRef(0);
  const allowed = w?.consents.includes("speech_processing");
  const owner = w?.farmer?.id;
  const stop = useCallback(() => {
    generation.current++;
    request.current?.abort();
    request.current = null;
    source.current?.stop();
    source.current = null;
    context.current?.close().catch(() => {});
    context.current = null;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);
  useEffect(() => {
    const engine = window.speechSynthesis;
    const update = () =>
      setVoice(selectedDeviceVoice(engine?.getVoices() || [], language));
    update();
    engine?.addEventListener("voiceschanged", update);
    return () => engine?.removeEventListener("voiceschanged", update);
  }, [language]);
  useEffect(() => {
    stop();
    setError("");
    setServerAvailable(false);
    const controller = new AbortController();
    if (owner && !w.offline && allowed) {
      workspaceSpeech
        .capabilities(controller.signal)
        .then((caps) => {
          if (!controller.signal.aborted)
            setServerAvailable(caps.tts_languages?.includes(language) === true);
        })
        .catch(() => {});
    }
    return () => {
      controller.abort();
      stop();
    };
  }, [text, language, owner, w?.selected, w?.offline, allowed, stop]);
  useEffect(() => {
    window.addEventListener("pagehide", stop);
    return () => window.removeEventListener("pagehide", stop);
  }, [stop]);
  const speak = async () => {
    if (speaking) {
      stop();
      return;
    }
    stop();
    setError("");
    const sequence = generation.current;
    const excerpt = text.slice(0, 2500);
    setSpeaking(true);
    try {
      if (voice) {
        const utterance = new SpeechSynthesisUtterance(excerpt);
        utterance.voice = voice;
        utterance.lang = info.speechCode;
        utterance.onend = () => {
          if (sequence === generation.current) setSpeaking(false);
        };
        utterance.onerror = () => {
          if (sequence === generation.current) {
            setSpeaking(false);
            setError(
              "Read-aloud is unavailable. The written advice remains available.",
            );
          }
        };
        window.speechSynthesis.speak(utterance);
        return;
      }
      if (!serverAvailable || !allowed || w.offline)
        throw new Error("Unavailable");
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error("Unavailable");
      // Resume within the farmer's tap so mobile autoplay rules permit playback.
      const audio = new Context();
      context.current = audio;
      await audio.resume();
      if (sequence !== generation.current) return;
      const controller = new AbortController();
      request.current = controller;
      const result = await workspaceSpeech.synthesize(
        excerpt,
        language,
        controller.signal,
      );
      if (sequence !== generation.current) return;
      const bytes = Uint8Array.from(atob(result.audios[0]), (value) =>
        value.charCodeAt(0),
      );
      const buffer = await audio.decodeAudioData(bytes.buffer);
      if (sequence !== generation.current) return;
      const player = audio.createBufferSource();
      source.current = player;
      player.buffer = buffer;
      player.connect(audio.destination);
      player.onended = () => {
        if (sequence === generation.current) stop();
      };
      player.start();
    } catch (problem) {
      if (sequence !== generation.current) return;
      stop();
      setError(
        problem.status === 429
          ? "Speech usage limit reached. Try later or read the written advice."
          : "Read-aloud is unavailable. The written advice remains available.",
      );
    }
  };
  return (
    <div>
      <button disabled={(!voice && !serverAvailable) || !text} onClick={speak}>
        {speaking ? tx("Stop reading") : tx("Read today’s advice aloud")}
      </button>
      <p>
        {voice
          ? tx(
              "Uses an installed device voice. No speech-provider request is sent.",
            )
          : serverAvailable
            ? tx(
                "Selected text is sent to the configured speech service. Krishyak does not save the text or audio.",
              )
            : tx(
                "No voice is available for this language. Written advice remains available.",
              )}
      </p>
      {!voice && !allowed && (
        <p>
          <a href="/app/more/settings">
            {tx(
              "Enable voice processing in permissions to check server read-aloud.",
            )}
          </a>
        </p>
      )}
      {text.length > 2500 && (
        <p>
          {tx(
            "Read-aloud covers the first 2,500 characters. The full advice remains written above.",
          )}
        </p>
      )}
      {error && <p role="status">{tx(error)}</p>}
    </div>
  );
}
