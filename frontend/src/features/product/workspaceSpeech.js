import { farmApi } from "../farms/api";
import { boundedWav } from "./wavAudio";

// What the server's speech service can do changes only with a deployment, yet
// every microphone on a screen asks for it. One shared read per minute serves
// them all; a caller that stops waiting does not cancel it for the others.
const FRESH_MS = 60000;
let known = null,
  pending = null;
function sharedCapabilities() {
  if (known && Date.now() - known.at < FRESH_MS)
    return Promise.resolve(known.value);
  pending ??= farmApi("/speech/capabilities")
    .then((value) => {
      known = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}
function untilAborted(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const stop = () => {
      const error = new Error("The previous read was cancelled.");
      error.cancelled = true;
      reject(error);
    };
    if (signal.aborted) return stop();
    signal.addEventListener("abort", stop, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", stop);
    });
  });
}
export function forgetSpeechCapabilities() {
  known = null;
}

export const workspaceSpeech = {
  capabilities: (signal) => untilAborted(sharedCapabilities(), signal),
  transcribe: async (blob, language, signal) => {
    const audio = await boundedWav(blob, signal);
    const form = new FormData();
    form.append("file", audio, "recording.wav");
    form.append("language", language);
    // Explicit recordings are never automatically retried after refresh.
    return farmApi("/speech/transcribe", {
      method: "POST",
      body: form,
      signal,
      retry: false,
      timeoutMs: 70000,
    });
  },
  synthesize: (text, language, signal) =>
    farmApi("/speech/synthesize", {
      method: "POST",
      body: { text, language },
      signal,
      retry: false,
      timeoutMs: 40000,
    }),
};
