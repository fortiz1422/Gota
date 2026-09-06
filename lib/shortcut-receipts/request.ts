import {
  detectImageMime,
  MAX_RECEIPT_BYTES,
  type ReceiptUpload,
} from './ingest'

type ParseSuccess = {
  ok: true
  file: ReceiptUpload
  sourceAppHint: string | null
}

type ParseFailure = {
  ok: false
  status: 400 | 413 | 415
  error: 'invalid_request' | 'one_file_required' | 'file_too_large' | 'unsupported_media_type'
}

export type ShortcutReceiptRequestResult = ParseSuccess | ParseFailure

function isUpload(value: FormDataEntryValue): value is File {
  return typeof value !== 'string'
}

function extensionFor(mimeType: 'image/jpeg' | 'image/png' | 'image/webp'): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  return 'webp'
}

export async function parseShortcutReceiptRequest(
  request: Request,
): Promise<ShortcutReceiptRequestResult> {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase()

  if (contentType.startsWith('multipart/form-data')) {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return { ok: false, status: 400, error: 'invalid_request' }
    }

    const uploads = Array.from(form.values()).filter(isUpload)
    const file = form.get('file')
    if (uploads.length !== 1 || !file || !isUpload(file)) {
      return { ok: false, status: 400, error: 'one_file_required' }
    }

    const sourceAppHint = form.get('source_app_hint')
    return {
      ok: true,
      file: file as ReceiptUpload,
      sourceAppHint: typeof sourceAppHint === 'string' ? sourceAppHint : null,
    }
  }

  const declaredMime = contentType.split(';', 1)[0]
  if (
    declaredMime !== 'application/octet-stream' &&
    declaredMime !== 'image/jpeg' &&
    declaredMime !== 'image/png' &&
    declaredMime !== 'image/webp'
  ) {
    return { ok: false, status: 415, error: 'unsupported_media_type' }
  }

  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RECEIPT_BYTES) {
    return { ok: false, status: 413, error: 'file_too_large' }
  }

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await request.arrayBuffer())
  } catch {
    return { ok: false, status: 400, error: 'invalid_request' }
  }
  if (bytes.byteLength > MAX_RECEIPT_BYTES) {
    return { ok: false, status: 413, error: 'file_too_large' }
  }

  const detectedMime = detectImageMime(bytes)
  if (!detectedMime || (declaredMime !== 'application/octet-stream' && declaredMime !== detectedMime)) {
    return { ok: false, status: 415, error: 'unsupported_media_type' }
  }

  const body = Uint8Array.from(bytes)
  return {
    ok: true,
    file: {
      name: `shortcut-upload.${extensionFor(detectedMime)}`,
      type: detectedMime,
      size: body.byteLength,
      arrayBuffer: async () => body.slice().buffer,
    },
    sourceAppHint: null,
  }
}
