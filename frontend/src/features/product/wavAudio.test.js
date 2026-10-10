import { boundedWav, monoWav } from "./wavAudio";

function buffer(duration = 0.01) {
  return {
    duration,
    sampleRate: 16000,
    numberOfChannels: 1,
    length: 160,
    getChannelData: () => new Float32Array(160).fill(0.5),
  };
}
test("voice upload has bounded mono PCM duration and a real WAV header", async () => {
  const blob = monoWav(buffer());
  const bytes = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(blob);
  });
  const view = new DataView(bytes);
  expect(blob.type).toBe("audio/wav");
  expect(view.getUint32(24, true)).toBe(16000);
  expect(view.getUint16(22, true)).toBe(1);
  expect(view.getUint32(40, true)).toBe(320);
  expect(view.getInt16(44, true)).toBe(16383);
  for (const duration of [0, 30.01, Infinity, NaN])
    expect(() => monoWav(buffer(duration))).toThrow();
  expect(() => monoWav({ ...buffer(), sampleRate: 0 })).toThrow();
  expect(() => monoWav({ ...buffer(), length: 0 })).toThrow();
  expect(() =>
    monoWav({
      ...buffer(),
      getChannelData: () => new Float32Array(160).fill(NaN),
    }),
  ).toThrow();
});
test("cancelled decoding closes the device context and produces no upload", async () => {
  const controller = new AbortController();
  const context = {
    decodeAudioData: jest.fn(async () => {
      controller.abort();
      return buffer();
    }),
    close: jest.fn(async () => {}),
  };
  window.AudioContext = jest.fn(() => context);
  await expect(
    boundedWav(
      { size: 20, arrayBuffer: async () => new ArrayBuffer(20) },
      controller.signal,
    ),
  ).rejects.toThrow("cancelled");
  expect(context.close).toHaveBeenCalledTimes(1);
  delete window.AudioContext;
});
