import { workspaceSpeech } from "./workspaceSpeech";

// Plays one spoken answer. Server speech (Sarvam) is preferred because it
// sounds natural in Indian languages; an installed device voice is the
// fallback. The AudioContext must be created during the farmer's tap so
// mobile autoplay rules allow playback when the answer arrives later.
export function deviceVoice(language) {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find(
      (voice) => voice.lang?.split("-")[0].toLowerCase() === language,
    ) || null
  );
}

export function createSpeaker() {
  let context = null,
    source = null,
    request = null,
    generation = 0;
  const stop = () => {
    generation++;
    request?.abort();
    request = null;
    try {
      source?.stop();
    } catch {
      /* Already stopped. */
    }
    source = null;
    window.speechSynthesis?.cancel();
  };
  return {
    // Call inside a tap handler.
    unlock() {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      if (!context || context.state === "closed") context = new Context();
      context.resume().catch(() => {});
    },
    stop,
    close() {
      stop();
      context?.close().catch(() => {});
      context = null;
    },
    async speak(text, { language, speechCode, server }) {
      stop();
      const id = generation;
      const excerpt = text.slice(0, 2500);
      if (server && context) {
        const controller = new AbortController();
        request = controller;
        try {
          const result = await workspaceSpeech.synthesize(
            excerpt,
            language,
            controller.signal,
          );
          if (id !== generation) return false;
          const bytes = Uint8Array.from(atob(result.audios[0]), (value) =>
            value.charCodeAt(0),
          );
          const buffer = await context.decodeAudioData(bytes.buffer);
          if (id !== generation) return false;
          await new Promise((resolve) => {
            const player = context.createBufferSource();
            source = player;
            player.buffer = buffer;
            player.connect(context.destination);
            player.onended = resolve;
            player.start();
          });
          return id === generation;
        } catch (problem) {
          if (id !== generation) return false;
          if (problem.status === 429) throw problem;
          /* Fall through to a device voice. */
        }
      }
      const voice = deviceVoice(language);
      if (!voice || !window.speechSynthesis) return false;
      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(excerpt);
        utterance.voice = voice;
        utterance.lang = speechCode;
        utterance.onend = () => resolve(id === generation);
        utterance.onerror = () => resolve(false);
        window.speechSynthesis.speak(utterance);
      });
    },
  };
}
