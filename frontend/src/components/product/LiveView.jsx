import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CameraOff,
  Keyboard,
  Send,
  Volume2,
} from "lucide-react";
import useSarvamRecognition from "../../hooks/useSarvamRecognition";
import { farmApi } from "../../features/farms/api";
import { ConsentPrompt } from "../../features/farms/ConsentPrompt";
import { useProductLocale } from "../../features/product/ProductLocale";
import { workspaceSpeech } from "../../features/product/workspaceSpeech";
import { createSpeaker } from "../../features/product/speakAnswer";
import { ACTION_LINKS } from "../../features/product/useVoiceAssistant";
import { PictureSteps } from "../../features/product/PictureGuide";
import { VoiceOrb } from "./VoiceOrb";

const NEEDS = ["speech_processing", "agronomic_analysis"];
const STATUS = {
  idle: "Point at one leaf, tap the mic and ask",
  listening: "Listening… tap again when you finish",
  transcribing: "Understanding your words…",
  thinking: "Looking at your crop…",
  speaking: "Speaking… tap to stop",
};

// One still frame from the live camera, small enough for a slow connection.
export async function grabFrame(video) {
  if (!video?.videoWidth) return null;
  const scale = Math.min(
    1,
    1280 / Math.max(video.videoWidth, video.videoHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

// Krishyak Live: show the crop to the camera, ask aloud, hear the answer.
export function LiveView({ workspace: w }) {
  const { tx, info, language } = useProductLocale();
  const speech = useSarvamRecognition({
    speechCode: info.speechCode,
    transport: workspaceSpeech,
  });
  const [camera, setCamera] = useState("starting"),
    [phase, setPhase] = useState("idle"),
    [turns, setTurns] = useState([]),
    [problem, setProblem] = useState(""),
    [typing, setTyping] = useState(false),
    [draft, setDraft] = useState(""),
    [canSpeak, setCanSpeak] = useState(false);
  const video = useRef(null),
    stream = useRef(null),
    speaker = useRef(null),
    sequence = useRef(0);
  const allowed = NEEDS.every((purpose) => w.consents.includes(purpose));

  useEffect(() => {
    speaker.current = createSpeaker();
    return () => speaker.current?.close();
  }, []);
  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    workspaceSpeech
      .capabilities()
      .then((caps) => {
        if (!cancelled)
          setCanSpeak(caps.tts_languages?.includes(language) === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [allowed, language]);
  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("unavailable");
      return undefined;
    }
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        if (video.current) video.current.srcObject = media;
        setCamera("on");
      })
      .catch((error) =>
        setCamera(error?.name === "NotAllowedError" ? "denied" : "unavailable"),
      );
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [allowed]);

  const ask = useCallback(
    async (question) => {
      const text = question.trim();
      if (!text) return;
      const id = ++sequence.current;
      setProblem("");
      setPhase("thinking");
      const history = turns
        .slice(-6)
        .map(({ role, text: value }) => ({ role, text: value.slice(0, 1200) }));
      setTurns((values) => [...values, { role: "farmer", text }]);
      try {
        const body = new FormData();
        body.set("question", text.slice(0, 500));
        body.set("language", language);
        if (w.selected) body.set("plot_id", w.selected);
        body.set("history", JSON.stringify(history));
        const frame = await grabFrame(video.current);
        if (frame) body.set("frame", frame, "frame.jpg");
        const reply = await farmApi("/live/turn", {
          method: "POST",
          body,
          retry: false,
          timeoutMs: 60000,
        });
        if (id !== sequence.current) return;
        setTurns((values) => [
          ...values,
          {
            role: "assistant",
            text: reply.answer,
            action: reply.action,
            camera: reply.camera,
          },
        ]);
        setPhase("speaking");
        try {
          await speaker.current?.speak(reply.answer, {
            language,
            speechCode: info.speechCode,
            server: canSpeak,
          });
        } catch {
          /* The written answer stays on screen. */
        }
        if (id === sequence.current) setPhase("idle");
      } catch (error) {
        if (id !== sequence.current) return;
        setProblem(
          error.network
            ? "You seem to be offline. Krishyak Live needs the internet."
            : error.status === 429
              ? "Please wait a minute and try again."
              : "Krishyak could not answer right now. Please try again.",
        );
        setPhase("idle");
      }
    },
    [turns, language, info.speechCode, canSpeak, w.selected],
  );
  useEffect(() => {
    if (speech.transcript && phase === "transcribing") {
      const value = speech.transcript;
      speech.resetTranscript();
      ask(value);
    }
  }, [speech.transcript, phase, ask]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (speech.status === "listening") setPhase("listening");
    else if (speech.status === "processing" && phase === "listening")
      setPhase("transcribing");
    else if (speech.status === "error") {
      setProblem("We could not hear that clearly. Please try again or type.");
      setPhase("idle");
    }
  }, [speech.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = () => {
    speaker.current?.unlock();
    speaker.current?.stop();
    setProblem("");
    if (phase === "listening") speech.stopListening();
    else if (phase === "speaking") setPhase("idle");
    else if (!speech.isSupported) {
      setTyping(true);
      setProblem("Voice is not available on this phone. Please type.");
    } else speech.startListening();
  };
  const last = [...turns].reverse().find((turn) => turn.role === "assistant");
  const asked = [...turns].reverse().find((turn) => turn.role === "farmer");
  const busy = phase === "thinking" || phase === "transcribing";
  return (
    <div
      className={`live-view ${last ? "has-answer" : ""}`}
      data-voice-controls="own"
      lang={info.speechCode}
      dir={info.direction}
    >
      <div className="live-stage">
        <video
          ref={video}
          className="live-video"
          autoPlay
          playsInline
          muted
          aria-label={tx("Camera view of your crop")}
        />
        {camera !== "on" && allowed && (
          <div className="live-nocamera" role="status">
            <CameraOff size={40} aria-hidden="true" />
            <p>
              {camera === "starting"
                ? tx("Starting the camera…")
                : camera === "denied"
                  ? tx(
                      "Allow the camera in your browser so Krishyak can see the leaf. You can still ask by voice.",
                    )
                  : tx("No camera was found. You can still ask by voice.")}
            </p>
          </div>
        )}
        <span className="live-frame" aria-hidden="true" />
        <header className="live-top">
          <a
            className="live-back"
            href="/app/today"
            aria-label={tx("Back to Home")}
          >
            <ArrowLeft size={24} />
          </a>
          <h1>{tx("Krishyak Live")}</h1>
          <span className="voice-language">{info.nativeName}</span>
        </header>
      </div>
      <div className="live-panel">
        {!allowed ? (
          <ConsentPrompt
            workspace={w}
            purposes={NEEDS}
            title="Allow Krishyak Live"
            reason="A picture from your camera is checked by Krishyak's own leaf model, and your question goes to Sarvam AI to be understood and answered. Pictures and questions are not saved."
          />
        ) : (
          <>
            <div
              className="live-transcript"
              aria-live="polite"
              // A long answer scrolls here; keyboard users must be able to reach it.
              role="region"
              aria-label={tx("Conversation")}
              tabIndex={0}
            >
              {asked && <p className="live-asked">{asked.text}</p>}
              {last ? (
                <div className="live-answer">
                  <p>{last.text}</p>
                  <div className="voice-turn-actions">
                    <button
                      type="button"
                      className="voice-chip"
                      onClick={() => {
                        speaker.current?.unlock();
                        speaker.current
                          ?.speak(last.text, {
                            language,
                            speechCode: info.speechCode,
                            server: canSpeak,
                          })
                          .catch(() => {});
                      }}
                    >
                      <Volume2 size={18} /> {tx("Listen again")}
                    </button>
                    {ACTION_LINKS[last.action] && (
                      <a
                        className="voice-chip strong"
                        href={ACTION_LINKS[last.action][0]}
                      >
                        {tx(ACTION_LINKS[last.action][1])}{" "}
                        <ArrowRight size={18} />
                      </a>
                    )}
                  </div>
                  {last.camera?.status === "detected" && (
                    <details className="live-steps">
                      <summary>{tx("Show the steps in pictures")}</summary>
                      <PictureSteps steps={last.camera.first_steps} />
                    </details>
                  )}
                </div>
              ) : (
                !w.plot && (
                  <p className="live-hint">
                    {tx(
                      "Add your field and crop first, so Krishyak knows which crop it is looking at.",
                    )}{" "}
                    <a href="/app/setup">
                      {tx("Tell Krishyak about your farm")}
                    </a>
                  </p>
                )
              )}
              {problem && (
                <p className="voice-problem" role="alert">
                  {tx(problem)}
                </p>
              )}
            </div>
            <div className="live-controls">
              <VoiceOrb
                phase={phase}
                size={typing || last ? 76 : 104}
                disabled={busy || w.offline}
                onClick={tap}
                label={
                  phase === "listening"
                    ? tx("Stop and send")
                    : phase === "speaking"
                      ? tx("Stop speaking")
                      : tx("Tap to speak")
                }
              />
              <p className="voice-status" role="status">
                {w.offline
                  ? tx("You are offline. Krishyak Live needs the internet.")
                  : tx(STATUS[phase])}
              </p>
              {typing && (
                <form
                  className="voice-type"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!draft.trim() || busy) return;
                    speaker.current?.unlock();
                    ask(draft);
                    setDraft("");
                  }}
                >
                  <label className="sr-only" htmlFor="live-question">
                    {tx("Type your question")}
                  </label>
                  <input
                    id="live-question"
                    value={draft}
                    maxLength={500}
                    autoComplete="off"
                    enterKeyHint="send"
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
              )}
              <button
                type="button"
                className="voice-link"
                onClick={() => setTyping(!typing)}
              >
                <Keyboard size={18} />{" "}
                {typing ? tx("Speak instead") : tx("Type instead")}
              </button>
              <p className="voice-footnote">
                {tx(
                  "Krishyak's leaf model can be wrong. Before spraying, call the free Kisan Call Centre: 1800-180-1551.",
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
