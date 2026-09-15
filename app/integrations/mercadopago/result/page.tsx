import { ArrowLeft, CheckCircle, ShieldCheck } from '@phosphor-icons/react/dist/ssr'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMercadoPagoResultCopy, parseMercadoPagoResultStatus } from '@/lib/mercadopago-spike/result'

export default async function MercadoPagoResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  noStore()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const status = parseMercadoPagoResultStatus(typeof params.status === 'string' ? params.status : undefined)
  const result = status === 'success' ? { status: 'success' as const } : { status }
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
              <p className="flex items-center gap-3 p-4 type-body text-text-primary"><CheckCircle size={22} weight="light" className="text-data" aria-hidden="true" />{copy.nextStep}</p>
            </div>
          )}
          <a href="/settings" className="mt-8 flex min-h-12 items-center justify-center rounded-button bg-primary px-5 type-body-lg text-white transition-opacity hover:opacity-90">{copy.action}</a>
        </section>
      </div>
    </main>
  )
}