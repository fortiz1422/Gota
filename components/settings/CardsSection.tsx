'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretRight, CreditCard, Plus, Trash } from '@phosphor-icons/react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { ConfirmationSurface } from '@/components/ui/ConfirmationSurface'
import { addMonths } from '@/lib/dates'
import { buildCardLastFourPayload, validateCardLastFour } from '@/lib/shared-receipts-ui'
import type { Account, Card } from '@/types/database'

function closingInfo(closingDay: number, month: string): { diff: number; label: string } {
  const [year, monthNumber] = month.split('-').map(Number)
  const closing = new Date(year, monthNumber - 1, closingDay)
  const today = new Date()
  closing.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((closing.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return { diff, label: 'Cierra hoy' }
  if (diff > 0) return { diff, label: `Cierra en ${diff}d` }
  return { diff, label: `Cerró hace ${Math.abs(diff)}d` }
}

function dateForDay(month: string, day: number | null): string {
  if (!day) return ''
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

function dayFromDate(value: string): number | null {
  if (!value) return null
  return Number(value.split('-')[2]) || null
}

interface CardTaskProps {
  card: Card | null
  month: string
  accounts: Account[]
  triggerElement: HTMLElement | null
  onClose: () => void
  onSaved: (card: Card) => void
  onRemoved: (id: string) => void
}

function CardTask({ card, month, accounts, triggerElement, onClose, onSaved, onRemoved }: CardTaskProps) {
  const isNew = card === null
  const [name, setName] = useState(card?.name ?? '')
  const [lastFour, setLastFour] = useState(card?.last_four ?? '')
  const [closingDate, setClosingDate] = useState(dateForDay(month, card?.closing_day ?? null))
  const dueMonth = addMonths(month, 1)
  const [dueDate, setDueDate] = useState(dateForDay(dueMonth, card?.due_day ?? null))
  const [accountId, setAccountId] = useState(card?.account_id ?? '')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiveTrigger, setArchiveTrigger] = useState<HTMLElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const lastFourResult = validateCardLastFour(lastFour)
    if (!lastFourResult.valid) {
      setError(lastFourResult.message)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const response = await fetch(isNew ? '/api/cards' : `/api/cards/${card.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          closing_day: dayFromDate(closingDate),
          due_day: dayFromDate(dueDate),
          account_id: accountId || null,
          ...buildCardLastFourPayload(lastFour),
        }),
      })
      if (!response.ok) throw new Error()
      onSaved(await response.json() as Card)
      onClose()
    } catch {
      setError(isNew ? 'No pudimos agregar la tarjeta.' : 'No pudimos guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!card) return
    setRemoving(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${card.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      onRemoved(card.id)
      setConfirmArchive(false)
      onClose()
    } catch {
      setError('No pudimos archivar la tarjeta.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <TaskSurface
      open
      onClose={onClose}
      triggerElement={triggerElement}
      initialFocusRef={nameRef}
      eyebrow="TARJETAS"
      title={isNew ? 'Nueva tarjeta' : card.name}
      description={isNew ? 'Cargá su identidad y, si querés, dejá el ciclo configurado ahora.' : 'Revisá identidad, ciclo y cuenta asociada.'}
      footer={
        <button type="button" onClick={() => void save()} disabled={saving || !name.trim()} className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Guardando…' : isNew ? 'Agregar tarjeta' : 'Guardar cambios'}
        </button>
      }
    >
      <div className="space-y-5">
        {error ? <p role="alert" className="rounded-input bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-text-secondary">Nombre</span>
          <input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Visa Galicia" className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-3 text-sm text-text-primary" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-text-secondary">Últimos 4 dígitos <span className="font-normal text-text-tertiary">(opcional)</span></span>
          <input inputMode="numeric" autoComplete="off" maxLength={4} value={lastFour} onChange={(event) => { setLastFour(event.target.value); setError(null) }} placeholder="1234" className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-3 text-sm text-text-primary" />
          <span className="mt-1 block text-xs text-text-tertiary">Sólo se guarda el sufijo para reconocerla: •••• 1234.</span>
        </label>
        <section className="rounded-card border border-border-strong bg-bg-primary p-4">
          <h3 className="text-sm font-semibold text-text-primary">Ciclo habitual</h3>
          <p className="mt-1 text-xs leading-5 text-text-tertiary">Estas fechas son la referencia habitual. Los resúmenes pueden tener fechas exactas propias.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs text-text-secondary">Cierre</span><input type="date" value={closingDate} min={`${month}-01`} max={`${month}-31`} onChange={(event) => setClosingDate(event.target.value)} className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-2 py-3 text-xs text-text-primary" /></label>
            <label className="block"><span className="mb-1 block text-xs text-text-secondary">Vencimiento</span><input type="date" value={dueDate} min={`${dueMonth}-01`} max={`${dueMonth}-31`} onChange={(event) => setDueDate(event.target.value)} className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-2 py-3 text-xs text-text-primary" /></label>
          </div>
        </section>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-text-secondary">Cuenta asociada</span>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-3 text-sm text-text-primary">
            <option value="">Sin cuenta asociada</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        {!isNew && card ? (
          <button type="button" onClick={(event) => { setArchiveTrigger(event.currentTarget); setConfirmArchive(true) }} disabled={removing} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-button border border-danger/30 text-sm font-semibold text-danger disabled:opacity-50">
            <Trash size={17} /> Archivar tarjeta
          </button>
        ) : null}
        <ConfirmationSurface
          open={confirmArchive}
          onClose={() => setConfirmArchive(false)}
          onConfirm={() => void remove()}
          triggerElement={archiveTrigger}
          eyebrow="ARCHIVAR TARJETA"
          title={`¿Archivar ${card?.name ?? 'esta tarjeta'}?`}
          description="Deja de estar disponible para nuevas compras y conserva la historia existente."
          confirmLabel="Archivar tarjeta"
          busy={removing}
          destructive
        >
          Los movimientos y ciclos vinculados permanecen en Gota. Si nunca tuvo movimientos, la tarjeta puede quitarse definitivamente.
        </ConfirmationSurface>
      </div>
    </TaskSurface>
  )
}

function CardEmptyState({ onAdd }: { onAdd: (trigger: HTMLElement) => void }) {
  return (
    <section className="rounded-card border border-dashed border-border-strong px-5 py-8 text-center">
      <CreditCard size={25} className="mx-auto text-text-tertiary" />
      <p className="mt-3 text-sm font-semibold text-text-primary">Todavía no agregaste tarjetas</p>
      <p className="mt-1 text-xs leading-5 text-text-tertiary">Sumá una para ordenar cierres, vencimientos y pagos.</p>
      <button type="button" onClick={(event) => onAdd(event.currentTarget)} className="mt-4 min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white">Agregar primera tarjeta</button>
    </section>
  )
}

export function CardsSection({ cards: initialCards, standalone = false, month, accounts }: { standalone?: boolean; cards: Card[]; month: string; accounts: Account[] }) {
  const router = useRouter()
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [editor, setEditor] = useState<Card | null | undefined>(undefined)
  const [taskTrigger, setTaskTrigger] = useState<HTMLElement | null>(null)

  const openEditor = (card: Card | null, trigger: HTMLElement) => {
    setTaskTrigger(trigger)
    setEditor(card)
  }

  const handleSaved = (saved: Card) => {
    setCards((previous) => {
      const index = previous.findIndex((card) => card.id === saved.id)
      if (index < 0) return [...previous, saved]
      const next = [...previous]
      next[index] = saved
      return next
    })
    router.refresh()
  }

  const handleRemoved = (id: string) => {
    setCards((previous) => previous.filter((card) => card.id !== id))
    router.refresh()
  }

  const summary = cards.length === 0 ? 'Sin tarjetas' : `${cards.length} tarjeta${cards.length === 1 ? '' : 's'}`

  const content = (
    <div>
      {cards.length === 0 ? <CardEmptyState onAdd={(trigger) => openEditor(null, trigger)} /> : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-strong bg-bg-primary">
          {cards.map((card) => {
            const info = card.closing_day ? closingInfo(card.closing_day, month) : null
            const accountName = accounts.find((account) => account.id === card.account_id)?.name
            return (
              <li key={card.id}>
                <button type="button" onClick={(event) => openEditor(card, event.currentTarget)} className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-primary/5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning"><CreditCard size={17} weight="duotone" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold leading-5 text-text-primary">{card.name}</span>
                    <span className="mt-0.5 block break-words text-xs leading-5 text-text-tertiary">{accountName ? `${accountName} · ` : ''}{card.last_four ? `•••• ${card.last_four}` : 'Sin identificación'}</span>
                  </span>
                  {info ? <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${info.diff >= 0 && info.diff <= 5 ? 'bg-warning/10 text-warning' : 'bg-bg-tertiary text-text-tertiary'}`}>{info.label}</span> : <span className="shrink-0 text-[10px] text-text-tertiary">Sin ciclo</span>}
                  <CaretRight size={14} className="shrink-0 text-text-dim" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {cards.length > 0 ? <button type="button" onClick={(event) => openEditor(null, event.currentTarget)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-primary text-sm font-semibold text-white"><Plus size={16} /> Agregar tarjeta</button> : null}
    </div>
  )

  return (
    <>
      {standalone ? content : (
        <CollapsibleSection standalone={false} icon={<CreditCard weight="duotone" size={18} className="text-text-primary icon-duotone" />} title="Tarjetas" summary={summary}>
          {content}
        </CollapsibleSection>
      )}
      {editor !== undefined ? <CardTask key={editor?.id ?? 'new'} card={editor} month={month} accounts={accounts} triggerElement={taskTrigger} onClose={() => setEditor(undefined)} onSaved={handleSaved} onRemoved={handleRemoved} /> : null}
    </>
  )
}
