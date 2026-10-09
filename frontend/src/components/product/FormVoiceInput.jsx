import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic } from "lucide-react";
import useSarvamRecognition from "../../hooks/useSarvamRecognition";
import { useProductLocale } from "../../features/product/ProductLocale";
import { workspaceSpeech } from "../../features/product/workspaceSpeech";
import {
  applyVoiceValue,
  voiceValue,
} from "../../features/product/voiceValues";
import { farmApi } from "../../features/farms/api";

export function FormVoiceInput({ target, workspace: w }) {
  const reviewId = useId();
  const { info, tx } = useProductLocale();
  const speech = useSarvamRecognition({
    speechCode: info.speechCode,
    transport: workspaceSpeech,
  });
  const [server, setServer] = useState(null);
  useEffect(() => {
    if (!w.farmer) return undefined;
    const controller = new AbortController();
    farmApi("/speech/capabilities", { signal: controller.signal, retry: false })
      .then(setServer)
      .catch(() => setServer(null));
    return () => controller.abort();
  }, [w.farmer]);
  const [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [listening, setListening] = useState(false),
    [allow, setAllow] = useState(false),
    [granting, setGranting] = useState(false);
  const recognition = useRef(null),
    generation = useRef(0),
    timer = useRef(null);
  const resetTranscript = speech.resetTranscript;
  const speechAllowed = w.consents.includes("speech_processing");
  const previousSpeechAllowed = useRef(speechAllowed);
  const stopBrowser = useCallback(() => {
    generation.current++;
    clearTimeout(timer.current);
    recognition.current?.abort();
    recognition.current = null;
  }, []);
  // Sarvam covers every scheduled language; browsers support only a few.
  // Use it whenever configured, with explicit consent; otherwise fall back
  // to the browser's own speech engine.
  const serverSpeech = Boolean(
    server?.configured &&
    server.stt_languages?.includes(info.speechCode.split("-")[0]),
  );
  const browserSpeech =
    !serverSpeech &&
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const label =
    target?.getAttribute("aria-label") ||
    target?.labels?.[0]?.textContent?.trim() ||
    target?.placeholder ||
    tx("Selected input");
  useEffect(() => {
    stopBrowser();
    setDraft("");
    setError("");
    setListening(false);
    setAllow(false);
    resetTranscript();
    return stopBrowser;
  }, [target, info.speechCode, w.farmer?.id, resetTranscript, stopBrowser]);
  useEffect(() => {
    if (previousSpeechAllowed.current && !speechAllowed) {
      stopBrowser();
      resetTranscript();
      setDraft("");
      setListening(false);
      setAllow(false);
    }
    previousSpeechAllowed.current = speechAllowed;
  }, [speechAllowed, stopBrowser, resetTranscript]);
  useEffect(() => {
    if (speech.transcript) setDraft(speech.transcript);
  }, [speech.transcript]);
  useEffect(() => {
    if (!target) return;
    const observer = new MutationObserver(() => {
      if (!target.isConnected) {
        stopBrowser();
        resetTranscript();
        setDraft("");
        setListening(false);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [target, stopBrowser, resetTranscript]);
  useEffect(() => {
    if (speech.error)
      setError(tx("Voice input is unavailable. You can still type."));
  }, [speech.error, tx]);
  if (!target || !w.farmer || !target.isConnected) return null;
  const container =
    target.closest("dialog")?.querySelector(".dialog-body") ||
    target.closest("form") ||
    target.closest("main");
  if (!container) return null;
  const stop = () => {
    recognition.current?.stop();
    speech.stopListening();
  };
  const start = async () => {
    const initialGeneration = generation.current;
    setError("");
    setDraft("");
    if (!browserSpeech) {
      if (!w.consents.includes("speech_processing")) {
        if (!allow) return;
        setGranting(true);
        try {
          await farmApi("/consents", {
            method: "POST",
            body: {
              purpose: "speech_processing",
              granted: true,
              policy_version: "2026-10-03",
            },
          });
          await w.loadConsents();
          if (initialGeneration !== generation.current || !target.isConnected)
            return;
        } catch {
          setError(tx("Your permission could not be saved. Please retry."));
          return;
        } finally {
          setGranting(false);
        }
      }
      await speech.startListening();
      return;
    }
    const engine = new browserSpeech(),
      id = ++generation.current;
    engine.lang = info.speechCode;
    engine.continuous = false;
    engine.interimResults = false;
    recognition.current = engine;
    engine.onresult = (event) => {
      if (generation.current === id) setDraft(event.results[0][0].transcript);
    };
    engine.onerror = () => {
      if (generation.current === id)
        setError(tx("Voice input is unavailable. You can still type."));
    };
    engine.onend = () => {
      clearTimeout(timer.current);
      if (generation.current === id) setListening(false);
    };
    try {
      engine.start();
      setListening(true);
      timer.current = setTimeout(() => engine.stop(), 29000);
    } catch {
      setError(tx("Voice input is unavailable. You can still type."));
    }
  };
  const value = voiceValue(draft, target, info.speechCode);
  const busy =
    listening ||
    speech.isListening ||
    speech.status === "processing" ||
    granting;
  return createPortal(
    <section
      className="form-voice-entry"
      data-voice-controls="true"
      aria-label={tx("Voice input")}
    >
      <strong>
        <Mic size={18} />
        {tx("Voice input")}: {label}
      </strong>
      <p>
        {tx("Speak in your selected language. Check the text before using it.")}
      </p>
      <p className="small">
        {browserSpeech
          ? tx(
              "Your browser's speech service processes this recording. Krishyak does not save the audio.",
            )
          : tx(
              "Audio is sent to the configured speech service. Krishyak does not save the audio. You can turn this off in permissions.",
            )}
      </p>
      {!browserSpeech && !w.consents.includes("speech_processing") && (
        <label className="v2-check">
          <input
            type="checkbox"
            checked={allow}
            onChange={(event) => setAllow(event.target.checked)}
          />
          {tx("Allow voice processing for form entry")}
        </label>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={
          w.offline ||
          (!browserSpeech && !speech.isSupported) ||
          (!browserSpeech &&
            !allow &&
            !w.consents.includes("speech_processing")) ||
          (busy && !listening && !speech.isListening)
        }
        onClick={listening || speech.isListening ? stop : start}
      >
        {listening || speech.isListening ? tx("Stop recording") : tx("Speak")}
      </button>
      {!browserSpeech && !speech.isSupported && (
        <p role="status">
          {tx("Voice input is unavailable. You can still type.")}
        </p>
      )}
      {busy && (
        <p role="status">
          {listening || speech.isListening
            ? tx("Listening")
            : tx("Processing voice")}
        </p>
      )}
      {draft && (
        <>
          <div className="v2-label">
            <label htmlFor={reviewId}>{tx("Review spoken text")}</label>
            <textarea
              id={reviewId}
              value={draft}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          {value === null ? (
            <p role="status">
              {tx(
                "This value is unclear. Correct the text or enter it manually.",
              )}
            </p>
          ) : (
            <p>
              {tx("Value to use")}:{" "}
              {target.tagName === "SELECT"
                ? Array.from(target.options).find(
                    (option) => option.value === value,
                  )?.textContent
                : value}
            </p>
          )}
          <button
            type="button"
            className="button secondary"
            disabled={value === null || busy}
            onClick={() => {
              if (applyVoiceValue(target, value)) {
                setDraft("");
                speech.resetTranscript();
              } else
                setError(tx("Choose an input again before using this text."));
            }}
          >
            {tx("Use this value")}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>,
    container,
  );
}
