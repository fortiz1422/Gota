'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  parseSetupBalance,
  type AccountSetupInput,
  type SetupAccount,
  type SetupAccountType,
  type SetupCurrency,
} from '@/lib/onboarding-setup'
import styles from './landing-flow.module.css'

const chips: Array<{ label: string; type: SetupAccountType; custom?: boolean }> = [
  { label: 'Cuenta principal', type: 'bank' },
  { label: 'Banco', type: 'bank' },
  { label: 'Mercado Pago', type: 'digital' },
  { label: 'Otro…', type: 'bank', custom: true },
]

function formatBalance(value: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)
}

type Props = {
  initialAccount?: SetupAccount | null
  initialCurrency: SetupCurrency
  isAnonymous?: boolean
  saving?: boolean
  error?: string | null
  onContinue: (input: AccountSetupInput) => void
}

export function AccountStep({
  initialAccount,
  initialCurrency,
  isAnonymous = false,
  saving = false,
  error,
  onContinue,
}: Props) {
  const matched = chips.find((chip) => !chip.custom && chip.label === initialAccount?.name)
  const [chip, setChip] = useState(matched?.label ?? (initialAccount ? 'Otro…' : 'Cuenta principal'))
  const [customName, setCustomName] = useState(matched || !initialAccount ? '' : initialAccount.name)
  const [currency, setCurrency] = useState<SetupCurrency>(initialCurrency)
  const [main, setMain] = useState(
    initialAccount
      ? formatBalance(initialCurrency === 'ARS' ? initialAccount.opening_balance_ars : initialAccount.opening_balance_usd)
      : '',
  )
  const [other, setOther] = useState(
    initialAccount
      ? formatBalance(initialCurrency === 'ARS' ? initialAccount.opening_balance_usd : initialAccount.opening_balance_ars)
      : '',
  )
  const [showOther, setShowOther] = useState(
    Boolean(initialCurrency === 'ARS' ? initialAccount?.opening_balance_usd : initialAccount?.opening_balance_ars),
  )
  const [validation, setValidation] = useState<string | null>(null)
  const selected = chips.find((item) => item.label === chip) ?? chips[0]
  const name = selected.custom ? customName.trim() : selected.label

  function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const mainBalance = parseSetupBalance(main)
    const otherBalance = showOther ? parseSetupBalance(other) : 0
    if (!name || mainBalance === null || otherBalance === null) {
      setValidation('Completá el nombre y un saldo válido. Si no tenés dinero en esa cuenta, escribí 0.')
      return
    }
    setValidation(null)
    onContinue({
      name,
      type: selected.type,
      currency,
      balanceARS: currency === 'ARS' ? mainBalance : otherBalance,
      balanceUSD: currency === 'USD' ? mainBalance : otherBalance,
    })
  }

  const otherLabel = currency === 'ARS' ? 'dólares' : 'pesos'
  const otherPrefix = currency === 'ARS' ? 'USD' : '$'
  const message = validation ?? error

  return (
    <form className={styles.screen} onSubmit={submit}>
      <div className={styles.top}>
        <span />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.wordmark} src="/brand/gota-wordmark-primary.svg" alt="Gota" />
        <span />
      </div>
      <div className={styles.progress}>
        <span>Paso 1 de 2</span>
        <div className={styles.track}><span style={{ width: '50%' }} /></div>
      </div>
      <p className={styles.eyebrow}>Tu cuenta</p>
      <h1 className={styles.title}>¿Desde qué <em>cuenta</em> arrancamos?</h1>
      <div className={styles.field}>
        <span className={styles.label}>Nombre</span>
        <div className={styles.chips}>
          {chips.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`${styles.chip} ${chip === item.label ? styles.chipOn : ''}`}
              aria-pressed={chip === item.label}
              onClick={() => setChip(item.label)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {selected.custom ? (
          <input
            className={`${styles.amount} ${styles.dayInput} mt-3`}
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="Nombre de la cuenta"
            autoComplete="off"
          />
        ) : null}
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Moneda principal</span>
        <div className={styles.segment}>
          <button type="button" className={currency === 'ARS' ? styles.segmentOn : ''} onClick={() => setCurrency('ARS')}>Pesos</button>
          <button type="button" className={currency === 'USD' ? styles.segmentOn : ''} onClick={() => setCurrency('USD')}>Dólares</button>
        </div>
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Saldo actual</span>
        <label className={styles.amount}>
          <span className={styles.amountPrefix}>{currency === 'ARS' ? '$' : 'USD'}</span>
          <input
            inputMode="decimal"
            value={main}
            onChange={(event) => setMain(event.target.value)}
            aria-label="Saldo actual"
          />
        </label>
        <p className={styles.help}>Poné el saldo que ves ahora. Los gastos que ya pagaste están incluidos.</p>
      </div>
      <div className={styles.field}>
        {showOther ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className={styles.label} style={{ margin: 0 }}>Saldo en {otherLabel}</span>
              <button type="button" className={styles.linkButton} onClick={() => { setShowOther(false); setOther('') }}>Quitar</button>
            </div>
            <label className={`${styles.amount} ${styles.dayInput}`}>
              <span className={styles.amountPrefix}>{otherPrefix}</span>
              <input inputMode="decimal" value={other} onChange={(event) => setOther(event.target.value)} aria-label={`Saldo en ${otherLabel}`} />
            </label>
          </>
        ) : (
          <button type="button" className={styles.linkButton} onClick={() => setShowOther(true)}>
            + Sumar saldo en {otherLabel} (opcional)
          </button>
        )}
      </div>
      {isAnonymous ? (
        <nav className={styles.quietLinks} aria-label="Opciones de inicio">
          <Link href="/landing">← Conocer Gota</Link>
          <Link href="/login?intent=existing">Ya tengo cuenta</Link>
        </nav>
      ) : null}
      {message ? <p role="alert" className={styles.error}>{message}</p> : null}
      <div className={styles.grow} />
      <div className={styles.footer}>
        <button className={styles.cta} type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Seguir'} {!saving ? <b>→</b> : null}
        </button>
        <p className={styles.signature}>Gota, tu plata clara.</p>
      </div>
    </form>
  )
}
