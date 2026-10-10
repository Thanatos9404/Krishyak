// Decode on the device so the private server can enforce the actual duration.
export function monoWav(buffer) {
  if (
    !Number.isFinite(buffer.duration) ||
    buffer.duration <= 0 ||
    buffer.duration > 30 ||
    !Number.isFinite(buffer.sampleRate) ||
    buffer.sampleRate < 8000 ||
    buffer.sampleRate > 192000 ||
    !Number.isInteger(buffer.length) ||
    buffer.length < 1 ||
    Math.abs(buffer.length / buffer.sampleRate - buffer.duration) >
      1 / buffer.sampleRate ||
    buffer.numberOfChannels < 1 ||
    buffer.numberOfChannels > 2
  )
    throw new Error("recording duration unavailable");
  const rate = 16000;
  const count = Math.floor(buffer.duration * rate);
  if (!count) throw new Error("recording is empty");
  const bytes = new ArrayBuffer(44 + count * 2);
  const view = new DataView(bytes);
  const text = (at, value) =>
    [...value].forEach((char, index) =>
      view.setUint8(at + index, char.charCodeAt(0)),
    );
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, count * 2, true);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
  for (let index = 0; index < count; index++) {
    const original = (index * buffer.sampleRate) / rate;
    const left = Math.min(Math.floor(original), buffer.length - 1),
      right = Math.min(left + 1, buffer.length - 1),
      fraction = original - left;
    let value = 0;
    for (const channel of channels)
      value += channel[left] * (1 - fraction) + channel[right] * fraction;
    if (!Number.isFinite(value)) throw new Error("invalid recording sample");
    value = Math.max(-1, Math.min(1, value / channels.length));
    view.setInt16(
      44 + index * 2,
      value < 0 ? value * 32768 : value * 32767,
      true,
    );
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export async function boundedWav(blob, signal) {
  if (signal?.aborted || blob.size > 5 * 1024 * 1024)
    throw new Error("recording cancelled");
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) throw new Error("audio decoder unavailable");
  const context = new Context();
  try {
    const bytes = await blob.arrayBuffer();
    if (signal?.aborted) throw new Error("recording cancelled");
    const buffer = await context.decodeAudioData(bytes);
    if (signal?.aborted) throw new Error("recording cancelled");
    return monoWav(buffer);
  } finally {
    await context.close().catch(() => {});
  }
}
