// Phone photos are often 4-12 MB. The server normalizes to 2048 px anyway, so
// resizing on the device saves the farmer's data and stays within upload limits.
const MAX_EDGE = 2048;
const LIMIT = 4 * 1024 * 1024;

export async function preparePhoto(file) {
  if (typeof createImageBitmap !== "function") return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= LIMIT && file.type === "image/jpeg") {
    bitmap.close?.();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const quality of [0.9, 0.8, 0.7]) {
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= LIMIT)
      return new File([blob], "crop-photo.jpg", { type: "image/jpeg" });
  }
  throw new Error("This photo is too large. Take it again closer to the leaf.");
}
