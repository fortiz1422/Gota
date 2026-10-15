export const LANDING_COPY_KEYS = [
  'HERO_TITLE_PRE',
  'HERO_TITLE_EM',
  'HERO_SUB',
  'HERO_SIGN_PRE',
  'HERO_SIGN_EM',
  'META_TITLE',
  'META_DESCRIPTION',
] as const

export type LandingCopyKey = (typeof LANDING_COPY_KEYS)[number]

export function escapeHtmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replaceAll('"', '&quot;')
}

/** Relative same-origin path, or an absolute https URL. Empty means `/start`. */
export function resolveLandingCtaUrl(raw: string | undefined): string {
  const value = raw?.trim() || '/start'
  if (!/^\/(?!\/)/.test(value) && !/^https:\/\//.test(value)) {
    throw new Error('LANDING_CTA_URL inválida')
  }
  return value
}

export function renderLandingHtml(
  template: string,
  copy: Partial<Record<LandingCopyKey, string>>,
  ctaUrl: string | undefined
): string {
  const cta = resolveLandingCtaUrl(ctaUrl)
  if (template.split('{{CTA_URL}}').length - 1 !== 3) {
    throw new Error('Se esperaban 3 CTA')
  }

  let html = template
  for (const key of LANDING_COPY_KEYS) {
    const value = copy[key]
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Falta la clave de copy ${key}`)
    }
    const token = `{{${key}}}`
    if (!html.includes(token)) throw new Error(`Falta el placeholder ${token}`)
    html = html.split(token).join(escapeHtmlAttribute(value))
  }

  html = html.split('{{CTA_URL}}').join(escapeHtmlAttribute(cta))
  if (/\{\{[A-Z0-9_]+\}\}/.test(html)) {
    throw new Error('Quedó un placeholder sin reemplazar')
  }
  return html
}
