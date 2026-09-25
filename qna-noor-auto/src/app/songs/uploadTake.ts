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
