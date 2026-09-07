const errorMessages: Record<string, string> = {
  not_found: 'La carga de comprobantes no está disponible.',
  unauthorized: 'No pudimos autenticar este Atajo. Revisá su acceso en Gota.',
  rate_limited: 'Enviaste demasiados comprobantes. Esperá unos minutos y volvé a intentar.',
  one_file_required: 'No encontramos una imagen para cargar.',
  invalid_file: 'No encontramos una imagen válida para cargar.',
  file_too_large: 'La imagen supera el límite de 10 MB.',
  unsupported_media_type: 'El archivo no es una imagen compatible. Usá JPG, PNG o WebP.',
  storage_unavailable: 'Gota no pudo guardar la imagen. Volvé a intentar en unos minutos.',
  ingest_failed: 'Gota no pudo cargar el comprobante. Volvé a intentar.',
}

export function withShortcutReceiptMessage(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body

  const response = body as Record<string, unknown>
  if (typeof response.message === 'string') return body
  if (typeof response.error !== 'string') return body

  return {
    ...response,
    message: errorMessages[response.error] ?? 'Gota no pudo cargar el comprobante.',
  }
}
