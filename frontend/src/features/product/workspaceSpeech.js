import { farmApi } from "../farms/api";
export const workspaceSpeech = {
  capabilities: () => farmApi("/speech/capabilities"),
  transcribe: (blob, language, signal) => {
    const form = new FormData();
    form.append(
      "file",
      blob,
      blob.type.includes("mp4")
        ? "recording.m4a"
        : blob.type.includes("ogg")
          ? "recording.ogg"
          : "recording.webm",
    );
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
};
