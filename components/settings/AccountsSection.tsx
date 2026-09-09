'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bank, CaretRight, Plus, Star, Wallet } from '@phosphor-icons/react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { ChoiceSurface } from '@/components/ui/ChoiceSurface'
import { AccountBottomSheet } from '@/components/settings/AccountBottomSheet'
import type { Account, AccountPeriodBalance, AccountType } from '@/types/database'

interface Props {
  standalone?: boolean
  initialAccounts: Account[]
  month: string
  onChanged?: () => void
}

const TYPE_LABEL: Record<string, string> = { bank: 'Banco', digital: 'Digital', cash: 'Efectivo' }

function balanceLabels(balance: AccountPeriodBalance | undefined, account: Account): string[] {
  const ars = balance?.balance_ars ?? account.opening_balance_ars
  const usd = balance?.balance_usd ?? account.opening_balance_usd
  const labels: string[] = []
  if (ars !== 0) labels.push(ars.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }))
  if (usd !== 0) labels.push(usd.toLocaleString('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }))
  return labels
}

export function AccountsSection({ initialAccounts, month, standalone = false, onChanged }: Props) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [editing, setEditing] = useState<Account | null | undefined>(undefined)
  const [creatingType, setCreatingType] = useState<AccountType>('bank')
  const [choosingType, setChoosingType] = useState(false)
  const [taskTrigger, setTaskTrigger] = useState<HTMLElement | null>(null)
  const [balanceState, setBalanceState] = useState<{ month: string; balances: Record<string, AccountPeriodBalance>; error: boolean }>({ month: '', balances: {}, error: false })
  const [balanceLoadAttempt, setBalanceLoadAttempt] = useState(0)

  const active = accounts.filter((account) => !account.archived)
  const periodBalances = balanceState.month === month ? balanceState.balances : {}
  const accountBalancesError = balanceState.month === month && balanceState.error

  useEffect(() => {
    if (active.length === 0) return
    fetch(`/api/account-balances?month=${month}`)
      .then((response) => {
        if (!response.ok) throw new Error()
        return response.json()
      })
      .then((data: AccountPeriodBalance[]) => {
        const map: Record<string, AccountPeriodBalance> = {}
        for (const balance of data) map[balance.account_id] = balance
        setBalanceState({ month, balances: map, error: false })
      })
      .catch(() => setBalanceState({ month, balances: {}, error: true }))
  }, [month, active.length, balanceLoadAttempt])

  const handleSaved = (saved: Account) => {
    setAccounts((previous) => {
      const index = previous.findIndex((account) => account.id === saved.id)
      if (index < 0) return [...previous, saved]
      const updated = [...previous]
      updated[index] = saved
      return saved.is_primary
        ? updated.map((account) => account.id === saved.id ? account : { ...account, is_primary: false })
        : updated
    })
    router.refresh()
    onChanged?.()
  }

  const handleDeleted = (id: string) => {
    setAccounts((previous) => previous.filter((account) => account.id !== id))
    router.refresh()
    onChanged?.()
  }

  const openTypeChoice = (trigger: HTMLElement) => {
    setTaskTrigger(trigger)
    setChoosingType(true)
  }

  const chooseType = (type: AccountType) => {
    setCreatingType(type)
    setChoosingType(false)
    setEditing(null)
  }

  const openEdit = (account: Account, trigger: HTMLElement) => {
    setTaskTrigger(trigger)
    setEditing(account)
  }

  const summary = active.length === 0 ? 'Sin cuentas' : `${active.length} cuenta${active.length === 1 ? '' : 's'}`

  const content = (
    <div className={standalone ? 'flex min-h-full flex-col' : undefined}>
      {accountBalancesError ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-input bg-warning/10 px-3 py-2.5">
          <p className="text-xs leading-5 text-text-secondary">No pudimos cargar los saldos de este período.</p>
          <button type="button" onClick={() => { setBalanceState((current) => ({ ...current, error: false })); setBalanceLoadAttempt((attempt) => attempt + 1) }} className="min-h-11 shrink-0 text-xs font-semibold text-primary">Reintentar</button>
        </div>
      ) : null}
      {active.length === 0 ? (
        <div className="rounded-card border border-dashed border-border-strong px-5 py-8 text-center">
          <Bank size={25} className="mx-auto text-text-tertiary" />
          <p className="mt-3 text-sm font-semibold text-text-primary">Todavía no agregaste cuentas</p>
          <p className="mt-1 text-xs leading-5 text-text-tertiary">Sumá dónde está tu dinero para leer saldos y movimientos.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-strong bg-bg-primary">
          {active.map((account) => {
            const labels = balanceLabels(periodBalances[account.id], account)
            return (
              <li key={account.id}>
                <button type="button" onClick={(event) => openEdit(account, event.currentTarget)} className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-primary/5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {account.type === 'cash' ? <Wallet size={17} weight="duotone" /> : <Bank size={17} weight="duotone" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                      <span className="truncate">{account.name}</span>
                      {account.is_primary ? <Star size={12} weight="fill" className="shrink-0 text-warning" /> : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-tertiary">{TYPE_LABEL[account.type] ?? account.type}</span>
                  </span>
                  <span className="max-w-[118px] shrink-0 text-right">
                    {labels.map((label) => <span key={label} className="block whitespace-nowrap text-xs tabular-nums text-text-secondary">{label}</span>)}
                  </span>
                  <CaretRight size={14} className="shrink-0 text-text-dim" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className={standalone ? 'mt-auto pt-4' : 'mt-4'}>
        <button type="button" onClick={(event) => openTypeChoice(event.currentTarget)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-primary text-sm font-semibold text-white">
          <Plus size={16} /> Agregar cuenta
        </button>
      </div>
    </div>
  )

  return (
    <>
      {standalone ? content : (
        <CollapsibleSection standalone={false} icon={<Bank weight="duotone" size={18} className="text-text-primary icon-duotone" />} title="Cuentas" summary={summary}>
          {content}
        </CollapsibleSection>
      )}

      <ChoiceSurface
        appearance="compact"
        open={choosingType}
        onClose={() => setChoosingType(false)}
        triggerElement={taskTrigger}
        eyebrow="NUEVA CUENTA"
        title="¿Qué tipo de cuenta es?"
        description="Elegí primero el tipo para mostrar sólo la configuración que corresponde."
      >
        <div className="space-y-3">
          {([
            ['bank', 'Cuenta bancaria', 'Banco, caja de ahorro o cuenta corriente', Bank],
            ['digital', 'Billetera digital', 'Mercado Pago u otra cuenta digital', Wallet],
            ['cash', 'Efectivo', 'Dinero fuera de una cuenta', Wallet],
          ] as const).map(([type, title, description, Icon]) => (
            <button key={type} type="button" onClick={() => chooseType(type)} className="flex min-h-[76px] w-full items-center gap-3 rounded-card border border-border-strong bg-bg-primary px-4 py-3 text-left hover:bg-primary/5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon size={19} weight="duotone" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">{title}</span><span className="mt-0.5 block text-xs leading-5 text-text-tertiary">{description}</span></span>
              <CaretRight size={14} className="text-text-dim" />
            </button>
          ))}
        </div>
      </ChoiceSurface>

      {editing !== undefined ? (
        <AccountBottomSheet
          account={editing}
          type={editing?.type ?? creatingType}
          month={month}
          onSave={handleSaved}
          onDelete={handleDeleted}
          onClose={() => setEditing(undefined)}
          triggerElement={taskTrigger}
        />
      ) : null}
    </>
  )
}
