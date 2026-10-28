import { useCallback, useEffect, useRef, useState } from "react";
import useSarvamRecognition from "../../hooks/useSarvamRecognition";
import { farmApi } from "../farms/api";
import { useProductLocale } from "./ProductLocale";
import { workspaceSpeech } from "./workspaceSpeech";
import { createSpeaker } from "./speakAnswer";

export const VOICE_POLICY = "2026-10-03";
// Where each assistant action takes the farmer.
export const ACTION_LINKS = {
  scan: ["/app/health", "Check a sick plant"],
  market: ["/app/market", "See mandi prices"],
  weather: ["/app/today#weather", "See weather"],
  farm: ["/app/farm", "Open my fields"],
  note: ["/app/today#note", "Note what I saw"],
  benefits: ["/app/more/benefits", "Government schemes"],
};

// One conversation with Krishyak: record → transcribe → answer → speak.
// Nothing is stored; the last few turns are sent back only for follow-ups.
export function useVoiceAssistant(w) {
  const { info, language } = useProductLocale();
  const recognition = useSarvamRecognition({
    speechCode: info.speechCode,
    transport: workspaceSpeech,
  });
  const [phase, setPhase] = useState("idle"),
    [turns, setTurns] = useState([]),
    [problem, setProblem] = useState(""),
    [capabilities, setCapabilities] = useState(null),
    [granting, setGranting] = useState(false);
  const speaker = useRef(null),
    request = useRef(null),
    sequence = useRef(0),
    asking = useRef(false);
  const allowed = Boolean(w.consents?.includes("speech_processing"));
  const owner = w.farmer?.id;

  useEffect(() => {
    speaker.current = createSpeaker();
    return () => speaker.current?.close();
  }, []);
  useEffect(() => {
    if (!owner || w.offline) return undefined;
    const controller = new AbortController();
    workspaceSpeech
      .capabilities(controller.signal)
      .then(setCapabilities)
      .catch(() => setCapabilities({ configured: false }));
    return () => controller.abort();
  }, [owner, w.offline]);

  const cancel = useCallback(() => {
    sequence.current++;
    asking.current = false;
    request.current?.abort();
    request.current = null;
    speaker.current?.stop();
    recognition.resetTranscript();
    setPhase("idle");
  }, [recognition.resetTranscript]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => cancel, [language, owner, cancel]);

  const canSpeak = Boolean(
    capabilities?.tts_languages?.includes(language) && !w.offline,
  );
  const ask = useCallback(
    async (question) => {
      const text = question.trim();
      if (!text || asking.current) return;
      asking.current = true;
      const id = ++sequence.current;
      setProblem("");
      setPhase("thinking");
      const history = turns
        .slice(-6)
        .map(({ role, text: value }) => ({ role, text: value.slice(0, 1200) }));
      setTurns((values) => [...values, { role: "farmer", text }]);
      const controller = new AbortController();
      request.current = controller;
      try {
        const reply = await farmApi("/assistant/ask", {
          method: "POST",
          body: {
            question: text.slice(0, 500),
            language,
            plot_id: w.selectedRef?.current || w.selected || null,
            history,
          },
          signal: controller.signal,
          retry: false,
          timeoutMs: 45000,
        });
        if (id !== sequence.current) return;
        setTurns((values) => [
          ...values,
          { role: "assistant", text: reply.answer, action: reply.action },
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
        if (id !== sequence.current || error.cancelled) return;
        setProblem(
          error.network
            ? "You seem to be offline. Voice help needs the internet."
            : error.status === 429
              ? "You have asked many questions. Please wait a little and try again."
              : "Krishyak could not answer right now. Please try again.",
        );
        setPhase("idle");
      } finally {
        if (id === sequence.current) {
          asking.current = false;
          request.current = null;
        }
      }
    },
    [turns, language, info.speechCode, canSpeak, w.selected, w.selectedRef],
  );

  // A finished recording becomes the next question.
  useEffect(() => {
    if (recognition.transcript && phase === "transcribing") {
      const value = recognition.transcript;
      recognition.resetTranscript();
      ask(value);
    }
  }, [recognition.transcript, phase, ask]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (recognition.status === "listening") setPhase("listening");
    else if (recognition.status === "processing" && phase === "listening")
      setPhase("transcribing");
    else if (recognition.status === "error") {
      setProblem(
        recognition.error === "Microphone permission denied."
          ? "Allow the microphone in your browser to speak, or type your question."
          : "We could not hear that clearly. Please try again or type.",
      );
      setPhase("idle");
    }
  }, [recognition.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const grant = async () => {
    setGranting(true);
    setProblem("");
    try {
      await farmApi("/consents", {
        method: "POST",
        body: {
          purpose: "speech_processing",
          granted: true,
          policy_version: VOICE_POLICY,
        },
      });
      await w.loadConsents();
      return true;
    } catch {
      setProblem("Your permission could not be saved. Please retry.");
      return false;
    } finally {
      setGranting(false);
    }
  };
  const listen = async () => {
    speaker.current?.unlock();
    speaker.current?.stop();
    setProblem("");
    if (phase === "listening") {
      recognition.stopListening();
      return;
    }
    if (phase === "speaking") {
      setPhase("idle");
      return;
    }
    if (!recognition.isSupported) {
      setProblem("Voice is not available on this phone. Please type.");
      return;
    }
    await recognition.startListening();
  };
  return {
    phase,
    turns,
    problem,
    granting,
    allowed,
    configured: capabilities ? Boolean(capabilities.configured) : null,
    micSupported: recognition.isSupported,
    grant,
    listen,
    // Typed questions also unlock audio, since they come from a tap.
    ask: (text) => {
      speaker.current?.unlock();
      return ask(text);
    },
    stopSpeaking: () => {
      speaker.current?.stop();
      if (phase === "speaking") setPhase("idle");
    },
    replay: (text) => {
      speaker.current?.unlock();
      setPhase("speaking");
      speaker.current
        ?.speak(text, {
          language,
          speechCode: info.speechCode,
          server: canSpeak,
        })
        .catch(() => {})
        .finally(() => setPhase("idle"));
    },
    reset: () => {
      cancel();
      setTurns([]);
      setProblem("");
    },
    cancel,
  };
}
