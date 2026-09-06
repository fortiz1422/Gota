export function isShortcutReceiptsEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== 'false'
}
