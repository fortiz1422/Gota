'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretRight, CreditCard, Plus, Trash } from '@phosphor-icons/react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { ConfirmationSurface } from '@/components/ui/ConfirmationSurface'
import { CardSetupForm } from '@/components/cards/CardSetupForm'
import { describeCardSetup } from '@/lib/card-setup-state'
import { todayAR } from '@/lib/format'
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

interface CardTaskProps {
  card: Card | null
  month: string
  accounts: Account[]
  triggerElement: HTMLElement | null
  onClose: () => void
  onSaved: (card: Card) => void
  onRemoved: (id: string) => void
}

function CardTask({ card, accounts, triggerElement, onClose, onSaved, onRemoved }: CardTaskProps) {
  const isNew = card === null
  const [removing, setRemoving] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiveTrigger, setArchiveTrigger] = useState<HTMLElement | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      appearance="compact"
      navigationTitle={isNew ? 'Nueva tarjeta' : 'Editar tarjeta'}
      triggerElement={triggerElement}
      eyebrow="TARJETAS"
      title={isNew ? 'Nueva tarjeta' : card.name}
      description={isNew ? 'Cargá su identidad y, si querés, dejá el ciclo configurado ahora.' : 'Revisá identidad, ciclo y cuenta asociada.'}
      footer={null}
    >
      <div className="space-y-5">
        {error ? <p role="alert" className="rounded-input bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <section data-card-edit-information data-card-edit-cycle className="border-b border-border-strong">
          <CardSetupForm
            variant="app"
            accounts={accounts}
            defaultAccountId={card?.account_id}
            initial={card}
            requireAnswer={isNew || card?.statement_answer != null}
            submitLabel={isNew ? 'Guardar tarjeta' : 'Guardar cambios'}
            onSubmit={async (input) => {
              const response = await fetch(isNew ? '/api/cards' : `/api/cards/${card.id}`, {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
              })
              if (!response.ok) throw new Error(isNew ? 'No pudimos agregar la tarjeta.' : 'No pudimos guardar los cambios.')
              onSaved(await response.json() as Card)
              onClose()
            }}
          />
        </section>
        {!isNew && card ? (
          <button data-card-edit-archive type="button" onClick={(event) => { setArchiveTrigger(event.currentTarget); setConfirmArchive(true) }} disabled={removing} className="surface-module flex min-h-[66px] w-full items-center justify-center gap-2 rounded-card border border-danger/15 bg-white text-sm font-semibold text-danger disabled:opacity-50">
            <Trash size={17} /> Archivar tarjeta
          </button>
        ) : null}
        <ConfirmationSurface
          appearance="compact"
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
    <div className={standalone ? 'flex min-h-full flex-col' : undefined}>
      {cards.length === 0 ? <CardEmptyState onAdd={(trigger) => openEditor(null, trigger)} /> : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-strong bg-bg-primary">
          {cards.map((card) => {
            const info = card.closing_day ? closingInfo(card.closing_day, month) : null
            const accountName = accounts.find((account) => account.id === card.account_id)?.name
            const setup = describeCardSetup(card, [], todayAR())
            return (
              <li key={card.id} className="flex items-stretch">
                <button type="button" onClick={() => router.push(`/tarjetas/${card.id}`)} className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-primary/5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning"><CreditCard size={17} weight="duotone" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold leading-5 text-text-primary">{card.name}</span>
                    <span className="mt-0.5 block break-words text-xs leading-5 text-text-tertiary">{setup.tracked && setup.cycleLine && setup.cycleLine !== 'Sin fechas' ? setup.cycleLine : `${accountName ? `${accountName} · ` : ''}${card.last_four ? `•••• ${card.last_four}` : 'Sin identificación'}`}</span>
                  </span>
                  {setup.tracked && setup.listLabel ? <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${setup.listTone === 'ok' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{setup.listLabel}</span> : info ? <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${info.diff >= 0 && info.diff <= 5 ? 'bg-warning/10 text-warning' : 'bg-bg-tertiary text-text-tertiary'}`}>{info.label}</span> : <span className="shrink-0 text-[10px] text-text-tertiary">Sin ciclo</span>}
                  <CaretRight size={14} className="shrink-0 text-text-dim" />
                </button>
                <button type="button" onClick={(event) => openEditor(card, event.currentTarget)} className="px-3 text-xs font-semibold text-primary">
                  Editar
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {cards.length > 0 ? <div className={standalone ? 'mt-auto pt-4' : 'mt-4'}><button type="button" onClick={(event) => openEditor(null, event.currentTarget)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-primary text-sm font-semibold text-white"><Plus size={16} /> Agregar tarjeta</button></div> : null}
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
