import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { getCurrentMonth } from '@/lib/dates'
import { readDashboardData } from '@/lib/server/dashboard-queries'

type InitialQuote = {
  compra: number
  venta: number
  fechaActualizacion: string
  rate: number
  effectiveDate: string
  updatedAt: string
  source: 'dolarapi'
  kind: 'oficial'
  stale: boolean
}

function normalizeQuote(raw: Partial<InitialQuote>): InitialQuote | null {
  const venta = Number(raw.venta)
  const compra = Number(raw.compra)
  const fechaActualizacion = raw.fechaActualizacion
  if (!Number.isFinite(venta) || venta <= 0 || !Number.isFinite(compra) || !fechaActualizacion) {
    return null
  }
  return {
    compra,
    venta,
    fechaActualizacion,
    rate: venta,
    effectiveDate: new Date(fechaActualizacion).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
    updatedAt: new Date(fechaActualizacion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    source: 'dolarapi',
    kind: 'oficial',
    stale: false,
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; currency?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: config } = await supabase
    .from('user_config')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single()

  if (!config?.onboarding_completed) redirect('/onboarding')

  const { month, currency: currencyParam } = await searchParams
  const selectedMonth = month ?? getCurrentMonth()
  const viewCurrency = (currencyParam === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'
  const [initialData, initialQuote] = await Promise.all([
    readDashboardData({
      supabase,
      userId: user.id,
      selectedMonth,
      viewCurrency,
    }),
    fetch('https://dolarapi.com/v1/dolares/oficial', {
      next: { revalidate: 300 },
    })
      .then(async (res) => (res.ok ? normalizeQuote((await res.json()) as Partial<InitialQuote>) : null))
      .catch(() => null),
  ])

  return (
    <DashboardShell
      selectedMonth={selectedMonth}
      viewCurrency={viewCurrency}
      userEmail={user.email ?? ''}
      initialData={initialData}
      initialQuote={initialQuote}
    />
  )
}
