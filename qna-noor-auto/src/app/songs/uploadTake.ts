export const TAKE_AUDIO_BITS_PER_SECOND = 64_000;

export function saveTakeErrorMessage(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "";
  if (
    !message ||
    /Server Components render|unexpected response/i.test(message)
  ) {
    return "Couldn't save the recording. If it was very long, try a shorter take.";
  }
  return message;
}

export async function uploadInChunks(
  dataUrl: string,
  append: (chunk: string) => Promise<void>,
  onProgress?: (fraction: number) => void,
  chunkSize = 2_500_000,
) {
  if (chunkSize <= 0) throw new Error("Chunk size must be positive.");
  for (let offset = 0; offset < dataUrl.length; offset += chunkSize) {
    await append(dataUrl.slice(offset, offset + chunkSize));
    onProgress?.(Math.min(1, (offset + chunkSize) / dataUrl.length));
  }
}
