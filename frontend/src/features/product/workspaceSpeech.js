import { farmApi } from "../farms/api";
import { boundedWav } from "./wavAudio";
export const workspaceSpeech = {
  capabilities: (signal) => farmApi("/speech/capabilities", { signal }),
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
