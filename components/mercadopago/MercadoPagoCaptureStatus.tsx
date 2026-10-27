import Link from 'next/link'
import type { MercadoPagoReviewCapturePresentation } from '@/lib/mercadopago/review-capture-status'

const toneClass: Record<MercadoPagoReviewCapturePresentation['tone'], string> = {
  neutral: 'border-border-subtle bg-bg-primary text-text-secondary',
  status: 'border-primary/20 bg-primary-soft text-text-primary',
  warning: 'border-warning/30 bg-warning/10 text-text-primary',
}

export function MercadoPagoCaptureStatus({
  presentation,
}: {
  presentation: MercadoPagoReviewCapturePresentation
}) {
  const role = presentation.tone === 'warning' ? 'alert' : 'status'
  return (
    <section
      role={role}
      aria-label="Estado de captura de Mercado Pago"
      className={`mt-4 min-w-0 rounded-input border px-3 py-3 text-xs leading-relaxed ${toneClass[presentation.tone]}`}
    >
      <p className="min-w-0 break-words font-semibold">{presentation.line}</p>
      {presentation.detail && (
        <p className="mt-1 min-w-0 break-words text-text-secondary">{presentation.detail}</p>
      )}
      {presentation.showSettingsLink && (
        <Link
          href="/settings"
          className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline"
        >
          Ir a Configuración
        </Link>
      )}
    </section>
  )
}
