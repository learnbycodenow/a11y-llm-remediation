/** Notes carry a "stage: " prefix so a stage can replace its own notes when re-run. */
export function replaceStageNotes(
  notes: readonly string[],
  stage: string,
  fresh: readonly string[],
): string[] {
  const prefix = `${stage}: `;
  return [...notes.filter((n) => !n.startsWith(prefix)), ...fresh.map((n) => `${prefix}${n}`)];
}
