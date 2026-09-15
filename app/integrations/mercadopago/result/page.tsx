import { ArrowLeft, CheckCircle, FileText, Receipt, ShieldCheck } from '@phosphor-icons/react/dist/ssr'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMercadoPagoResultCopy, type MercadoPagoResultStatus } from '@/lib/mercadopago-spike/result'

const STATUSES: MercadoPagoResultStatus[] = ['success', 'denied', 'invalid', 'not_configured', 'provider_error']

function parseCount(value: string | undefined): number {
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 && count <= 5 ? count : 0
}

export default async function MercadoPagoResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const rawStatus = typeof params.status === 'string' ? params.status : 'invalid'
  const status = STATUSES.includes(rawStatus as MercadoPagoResultStatus) ? rawStatus as MercadoPagoResultStatus : 'invalid'
  const result = status === 'success'
    ? { status: 'success' as const, identity: 'verified' as const, reports: parseCount(typeof params.reports === 'string' ? params.reports : undefined), payments: parseCount(typeof params.payments === 'string' ? params.payments : undefined) }
    : { status }
  const copy = getMercadoPagoResultCopy(result)

  return (
    <main className="min-h-app bg-bg-secondary px-5 pb-safe-cta pt-safe">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <a href="/settings" className="inline-flex w-fit items-center gap-2 text-body text-text-secondary" aria-label="Volver a Configuración">
          <ArrowLeft size={20} weight="light" aria-hidden="true" />
          Configuración
        </a>
        <section className="surface-module rounded-card-lg p-6" aria-labelledby="result-title">
          <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            {status === 'success' ? <CheckCircle size={30} weight="light" aria-hidden="true" /> : <ShieldCheck size={30} weight="light" aria-hidden="true" />}
          </div>
          <p className="type-label text-text-tertiary">{copy.eyebrow}</p>
          <h1 id="result-title" className="type-title mt-2 text-text-primary">{copy.title}</h1>
          <p className="type-body mt-3 text-text-secondary">{copy.description}</p>
          <p className="type-body-lg mt-4 text-text-primary">{copy.note}</p>

          {status === 'success' && (
            <div className="mt-6 divide-y divide-separator rounded-card bg-bg-secondary">
              <p className="flex items-center gap-3 p-4 type-body text-text-primary"><ShieldCheck size={22} weight="light" className="text-success" aria-hidden="true" />{copy.identity}</p>
              <p className="flex items-center gap-3 p-4 type-body text-text-primary"><FileText size={22} weight="light" className="text-data" aria-hidden="true" />{copy.reports}</p>
              <p className="flex items-center gap-3 p-4 type-body text-text-primary"><Receipt size={22} weight="light" className="text-data" aria-hidden="true" />{copy.payments}</p>
            </div>
          )}
          {status === 'success' && copy.zeroActivity && <p className="type-meta mt-4 text-text-secondary">{copy.zeroActivity}</p>}

          <a href="/settings" className="mt-8 flex min-h-12 items-center justify-center rounded-button bg-primary px-5 type-body-lg text-white transition-opacity hover:opacity-90">{copy.action}</a>
        </section>
      </div>
    </main>
  )
}