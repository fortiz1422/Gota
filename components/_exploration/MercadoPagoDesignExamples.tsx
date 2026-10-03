'use client'

import { useState } from 'react'
import { MercadoPagoReviewDetail, MercadoPagoReviewInbox } from '@/components/mercadopago/MercadoPagoReviewClient'
import { MercadoPagoConnectionView } from '@/components/settings/MercadoPagoSettingsCard'
import { MercadoPagoSetupView } from '@/components/settings/MercadoPagoSetupCard'
import { MercadoPagoDuplicateView } from '@/components/mercadopago/MercadoPagoDuplicateReview'
import { ParsePreview } from '@/components/dashboard/ParsePreview'
import { classifyMercadoPagoMovements, isReviewableMercadoPagoExpense, isReviewableMercadoPagoCardPurchase, type MercadoPagoMovement } from '@/lib/mercadopago/review'
import type { Card } from '@/types/database'
import type { DuplicateExpenseSnapshot } from '@/lib/mercadopago/duplicate-resolution'

// Synthetic presentation examples. No provider capture, ledger writes or real user data.
const base: MercadoPagoMovement = {
  candidateId: 'example-balance', occurredAt: '2026-10-03T15:00:00Z', balanceOccurredAt: '2026-10-03T15:00:00Z',
  amount: { value: 32000, currency: 'ARS' }, description: 'YPF', statementDescriptor: null,
  reviewStatus: 'pending', kind: 'expense', direction: 'outflow', fundingSource: { kind: 'mercadopago_balance' },
  balanceImpact: { observed: true, effect: 'debit', amount: { value: -32000, currency: 'ARS' } },
}
const movements: MercadoPagoMovement[] = [
  base,
  { ...base, candidateId: 'example-card', description: 'Mercado Libre · Producto con una descripción muy larga que no debería agrandar la fila de la lista', amount: { value: 120000, currency: 'ARS' },
    fundingSource: { kind: 'card', brand: 'Visa', lastFour: '1234' }, installments: 3, cardType: 'credit', cardPurchaseEligible: true,
    operation: { type: 'regular_payment', status: 'approved' }, balanceImpact: { observed: false, effect: 'zero', amount: { value: 0, currency: 'ARS' } } },
  { ...base, candidateId: 'example-transfer', description: 'Transferencia', kind: 'transfer', amount: { value: 100000, currency: 'ARS' }, balanceImpact: { observed: true, effect: 'debit', amount: { value: -100000, currency: 'ARS' } } },
  { ...base, candidateId: 'example-incoming', description: 'Transferencia recibida', kind: 'transfer', direction: 'inflow', balanceImpact: { observed: true, effect: 'credit', amount: { value: 32000, currency: 'ARS' } } },
  { ...base, candidateId: 'example-duplicate', description: 'Coto', attention: 'possible_duplicate' },
]
const card = { id: 'example-card', name: 'Visa · Banco ejemplo', archived: false } as Card
const expense = { id: 'example-expense', description: 'Coto', amount: 32000, currency: 'ARS', date: '2026-10-03', category: 'Alimentos', is_want: false } as DuplicateExpenseSnapshot

export function MercadoPagoDesignExamples() {
  const [view, setView] = useState('lista')
  const [selected, setSelected] = useState<MercadoPagoMovement | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [ids, setIds] = useState(new Set<string>())
  return <main className="mx-auto min-h-screen max-w-md bg-bg-primary px-5 py-6">
    <p className="rounded-input bg-warning/10 p-3 text-xs text-text-secondary">Ejemplos visuales con datos ficticios. No consultan Mercado Pago ni registran movimientos.</p>
    <label className="mt-4 block text-xs text-text-secondary" htmlFor="mp-example">Pantalla</label>
    <select id="mp-example" value={view} onChange={event => { setView(event.target.value); setSelected(null) }} className="mb-6 mt-2 min-h-11 w-full rounded-input border border-border-subtle bg-bg-primary px-3 text-sm">
      {['lista','vacía','conectado','sin conectar','onboarding','compra','gasto','duplicado'].map(value => <option key={value}>{value}</option>)}
    </select>
    <h1 className="type-title text-text-primary">Mercado Pago</h1>
    {(view === 'lista' || view === 'vacía') && <MercadoPagoReviewInbox buckets={classifyMercadoPagoMovements(view === 'vacía' ? [] : movements)} onOpen={movement => { if (movement.attention === 'possible_duplicate') setView('duplicado'); else if (isReviewableMercadoPagoCardPurchase(movement)) setView('compra'); else if (isReviewableMercadoPagoExpense(movement)) setView('gasto'); else setSelected(movement) }} selectionMode={selectionMode} onEnterSelection={() => setSelectionMode(true)} onCancelSelection={() => setSelectionMode(false)} selectedIds={ids} onToggle={movement => setIds(current => { const next = new Set(current); if (next.has(movement.candidateId)) next.delete(movement.candidateId); else next.add(movement.candidateId); return next })} />}
    {selected && <div className="mt-6"><MercadoPagoReviewDetail movement={selected} /><button type="button" onClick={() => setSelected(null)} className="min-h-11 text-sm text-primary">Cerrar detalle</button></div>}
    {(view === 'conectado' || view === 'sin conectar') && <div inert><MercadoPagoConnectionView state={{state: view === 'conectado' ? 'connected' : 'not_connected', lastSyncAt: null, sources: { payments: {status:'success',count:0}, reports: {status:'pending',count:0} }}} onManage={() => undefined} /></div>}
    {view === 'onboarding' && <div inert><MercadoPagoSetupView state={{available:true,state:'connected',initialImport:{status:'not_started',preset:null,startedAt:null,completedAt:null}}} preset="30d" setPreset={() => undefined} busy={false} error={null} onStart={() => undefined} onResume={() => undefined} onDisconnect={() => undefined} /></div>}
    {view === 'compra' && <div inert className="mt-6"><p className="mb-4 text-sm text-text-secondary">Elegí la tarjeta y categoría. Se suma a tus compromisos.</p><ParsePreview data={{amount:120000,currency:'ARS',description:'Mercado Libre',category:'Muebles y Hogar',is_want:false,payment_method:'CREDIT',card_id:card.id,installments:3,date:'2026-10-03'}} cards={[card]} accounts={[]} onConfirm={async () => { throw new Error('Ejemplo sin registro') }} onSave={() => undefined} onCancel={() => undefined} embedded immutableProviderEvidence aliasSource="mercadopago" confirmLabel="Registrar" /></div>}
    {view === 'gasto' && <div inert className="mt-6"><p className="mb-4 text-sm text-text-secondary">Elegí la categoría antes de registrar.</p><ParsePreview data={{amount:32000,currency:'ARS',description:'YPF',category:'Auto/Combustible',is_want:false,card_id:null,payment_method:'DEBIT',date:'2026-10-03'}} cards={[]} accounts={[]} fixedAccount={{id:'example-account',name:'Mercado Pago'}} onConfirm={async () => { throw new Error('Ejemplo sin registro') }} onSave={() => undefined} onCancel={() => undefined} embedded immutableProviderEvidence aliasSource="mercadopago" confirmLabel="Registrar" /></div>}
    {view === 'duplicado' && <div inert><MercadoPagoDuplicateView data={{expenses:[expense],fingerprint:'example'}} onLink={() => undefined} onKeep={() => undefined} /></div>}
  </main>
}
