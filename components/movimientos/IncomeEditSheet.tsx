'use client'

import { useRef, useState } from 'react'
import { Bank, DeviceMobileSpeaker, Star, Wallet } from '@phosphor-icons/react'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { ConfirmationSurface } from '@/components/ui/ConfirmationSurface'
import { InlineError } from '@/components/ui/InlineError'
import { dateInputToISO } from '@/lib/format'
import { buildIncomePayload, formatMonetaryInput, normalizeMonetaryInput } from '@/lib/mobile-income-transfer-surfaces'
import type { Account, IncomeEntry, IncomeCategory } from '@/types/database'

const CATEGORIES: { value: IncomeCategory; label: string }[] = [{ value: 'salary', label: 'Sueldo' }, { value: 'freelance', label: 'Freelance' }, { value: 'other', label: 'Otro' }]
const labelClass = 'mb-2 block type-meta font-semibold text-text-secondary'
const fieldClass = 'w-full border-0 border-b border-border-strong bg-transparent px-0 py-3 type-body text-text-primary outline-none focus:border-primary focus:ring-0 focus-visible:outline-none'

function AccountIcon({ type, size = 15 }: { type: Account['type']; size?: number }) {
  if (type === 'cash') return <Wallet weight="duotone" size={size} />
  if (type === 'digital') return <DeviceMobileSpeaker weight="duotone" size={size} />
  return <Bank weight="duotone" size={size} />
}

interface Props { entry: IncomeEntry; accounts: Account[]; onClose: () => void; onUpdate: () => void }

export function IncomeEditSheet({ entry, accounts, onClose, onUpdate }: Props) {
  const amountRef = useRef<HTMLInputElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const [amount, setAmount] = useState(String(entry.amount))
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(entry.currency)
  const [category, setCategory] = useState<IncomeCategory>(entry.category)
  const [description, setDescription] = useState(entry.description ?? '')
  const [date, setDate] = useState(entry.date.substring(0, 10))
  const [selectedKey, setSelectedKey] = useState<string | null>(entry.account_id)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const bankDigital = accounts.filter((a) => a.type !== 'cash')
  const cashAccount = accounts.find((a) => a.type === 'cash') ?? null
  const effectiveKey = selectedKey === cashAccount?.id ? 'cash' : selectedKey
  const resolveAccountId = () => effectiveKey === 'cash' ? cashAccount?.id ?? null : effectiveKey

  async function handleSave() {
    const num = Number(amount)
    if (!num || num <= 0) { setError('Ingresá un monto mayor a cero.'); return }
    setError(null); setIsSaving(true)
    try {
      const res = await fetch(`/api/income-entries/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildIncomePayload({ accountId: resolveAccountId(), amount, currency, category, description, date: dateInputToISO(date) })) })
      if (!res.ok) throw new Error('Error al guardar. Intentá de nuevo.')
      onUpdate()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al guardar. Intentá de nuevo.') } finally { setIsSaving(false) }
  }
  async function handleDelete() {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/income-entries/${entry.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar.')
      onUpdate()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al eliminar.'); setIsSaving(false); setConfirmDelete(false) }
  }

  return <>
    <TaskSurface open onClose={onClose} appearance="compact" eyebrow="INGRESOS" title="Editar ingreso" description="Actualizá los datos sin cambiar su naturaleza." initialFocusRef={amountRef}
      footer={<><InlineError message={error} className="mb-3" /><button type="button" onClick={() => { void handleSave() }} disabled={isSaving} className="min-h-12 w-full rounded-button bg-primary px-4 type-body-lg text-white disabled:opacity-45">{isSaving ? 'Guardando…' : 'Guardar cambios'}</button><button ref={deleteTriggerRef} type="button" onClick={() => setConfirmDelete(true)} disabled={isSaving} className="mt-1 min-h-11 w-full type-body text-danger disabled:opacity-50">Eliminar ingreso</button></>}
    >
      <div className="space-y-7 pb-2">
        <section><p className="type-micro text-primary">MONTO</p><div className="mt-2 flex items-baseline gap-2 border-b border-border-strong"><span className="type-amount text-text-secondary">{currency === 'ARS' ? '$' : 'US$'}</span><input ref={amountRef} id="income-edit-amount" type="text" inputMode="decimal" value={formatMonetaryInput(amount)} onChange={(e) => setAmount(normalizeMonetaryInput(e.target.value))} aria-label="Monto" className="min-w-0 flex-1 border-0 bg-transparent py-3 type-amount text-text-primary outline-none focus:ring-0 focus-visible:outline-none" /><fieldset className="flex gap-1 pb-2"><legend className="sr-only">Moneda</legend>{(['ARS', 'USD'] as const).map((c) => <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)} className={`rounded-button px-2 py-1 type-meta ${currency === c ? 'bg-primary text-white' : 'text-text-tertiary'}`}>{c}</button>)}</fieldset></div></section>
        {accounts.length > 0 && <section><label className={labelClass}>¿A dónde entra?</label><div className="flex gap-2 overflow-x-auto pb-1">{[...bankDigital, ...(cashAccount ? [cashAccount] : [])].map((acc) => { const key = acc.type === 'cash' ? 'cash' : acc.id; return <button key={key} type="button" onClick={() => setSelectedKey(key === 'cash' ? cashAccount?.id ?? null : key)} aria-pressed={effectiveKey === key} className={`flex shrink-0 items-center gap-2 border-b px-1 py-2 type-body ${effectiveKey === key ? 'border-primary text-primary' : 'border-transparent text-text-tertiary'}`}><AccountIcon type={acc.type} /><span>{acc.name}</span>{acc.is_primary && <Star weight="fill" size={11} />}</button> })}</div></section>}
        <fieldset><legend className={labelClass}>Categoría</legend><div className="grid grid-cols-3 gap-2">{CATEGORIES.map((cat) => <button key={cat.value} type="button" aria-pressed={category === cat.value} onClick={() => setCategory(cat.value)} className={`min-h-11 border-b type-body ${category === cat.value ? 'border-primary text-primary' : 'border-border-subtle text-text-tertiary'}`}>{cat.label}</button>)}</div></fieldset>
        <div><label htmlFor="income-edit-description" className={labelClass}>Descripción <span className="normal-case font-normal text-text-muted">(opcional)</span></label><input id="income-edit-description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={100} className={fieldClass} /></div>
        <div><label htmlFor="income-edit-date" className={labelClass}>Fecha</label><input id="income-edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} /></div>
      </div>
    </TaskSurface>
    <ConfirmationSurface open={confirmDelete} onClose={() => { if (!isSaving) setConfirmDelete(false) }} onConfirm={() => { void handleDelete() }} triggerElement={deleteTriggerRef.current} appearance="compact" destructive title="Eliminar ingreso" description="Esta acción elimina el ingreso y no se puede deshacer." confirmLabel="Eliminar ingreso" busy={isSaving}><p>Se conservarán las demás operaciones y cuentas.</p></ConfirmationSurface>
  </>
}
