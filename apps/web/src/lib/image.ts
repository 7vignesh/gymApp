/**
 * Client-side image compression before upload.
 * - Downscales long edge to `maxSize` (default 1024px)
 * - Re-encodes as JPEG at `quality` (default 0.85)
 * - Returns a data-URL the API can forward to OpenAI Vision.
 */
export async function compressImageToDataUrl(
  file: File,
  maxSize = 1024,
  quality = 0.85,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });

  const ctx = (canvas as HTMLCanvasElement).getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    return blobToDataUrl(blob);
  }
  return (canvas as HTMLCanvasElement).toDataURL("image/jpeg", quality);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
