/** Keep in sync with the share-target branch in public/sw.js */
export function isShareTargetReceiptImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function isShareTargetReceiptImageFile(file: {
  type?: string | null
}): boolean {
  const type = file.type ?? ''
  return type.length > 0 && isShareTargetReceiptImageMime(type)
}

export const SHARE_TARGET_INVALID_FILE_ERROR = 'tipo_invalido'

export function shareTargetBridgeErrorMessage(
  code: string | null | undefined,
): string | null {
  if (!code) return null
  if (code === SHARE_TARGET_INVALID_FILE_ERROR) {
    return 'Solo podemos recibir imágenes (capturas o fotos). Compartí el comprobante como imagen.'
  }
  return 'No pudimos recibir el archivo compartido.'
}
