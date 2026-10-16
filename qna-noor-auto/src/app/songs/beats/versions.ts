export function nextVersionName(existingManualCount: number): string {
  return `Version ${Math.max(0, Math.floor(existingManualCount)) + 1}`;
}

export function autoVersionsToPrune(
  versions: Array<{ id: string; createdAt: Date | string }>,
  keep = 10,
): string[] {
  const retained = Math.max(0, Math.floor(keep));
  return [...versions]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
        right.id.localeCompare(left.id),
    )
    .slice(retained)
    .map((version) => version.id);
}
