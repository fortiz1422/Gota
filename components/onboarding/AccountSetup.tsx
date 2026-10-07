'use client'

import { useState, type FormEvent } from 'react'
import { Bank, Wallet, Money, ArrowRight, Check } from '@phosphor-icons/react'
import {
  parseSetupBalance,
  type AccountSetupInput,
  type SetupAccount,
  type SetupAccountType,
  type SetupCurrency,
} from '@/lib/onboarding-setup'
import styles from './onboarding.module.css'

const kinds = [
  { value: 'bank', label: 'Banco', icon: Bank },
  { value: 'digital', label: 'Billetera', icon: Wallet },
  { value: 'cash', label: 'Efectivo', icon: Money },
] as const
const suggestions = [
  { name: 'BBVA', type: 'bank' },
  { name: 'Banco Nación', type: 'bank' },
  { name: 'Mercado Pago', type: 'digital' },
  { name: 'Efectivo', type: 'cash' },
] as const

export type AccountSetupProps = {
  initialAccount?: SetupAccount | null
  initialCurrency?: SetupCurrency
  isAnonymous?: boolean
  saving?: boolean
  error?: string | null
  onSave: (input: AccountSetupInput) => void
}

export function AccountSetup({
  initialAccount,
  initialCurrency = 'ARS',
  isAnonymous = false,
  saving = false,
  error,
  onSave,
}: AccountSetupProps) {
  const [name, setName] = useState(initialAccount?.name ?? '')
  const [type, setType] = useState<SetupAccountType>(
    initialAccount?.type ?? 'bank'
  )
  const [currency, setCurrency] = useState<SetupCurrency>(initialCurrency)
  const [ars, setArs] = useState(
    initialAccount
      ? String(initialAccount.opening_balance_ars).replace('.', ',')
      : ''
  )
  const [usd, setUsd] = useState(
    initialAccount
      ? String(initialAccount.opening_balance_usd).replace('.', ',')
      : ''
  )
  const [both, setBoth] = useState(
    Boolean(
      initialCurrency === 'ARS'
        ? initialAccount?.opening_balance_usd
        : initialAccount?.opening_balance_ars
    )
  )
  const [validation, setValidation] = useState<string | null>(null)
  const mainAmount = currency === 'ARS' ? ars : usd
  const otherAmount = currency === 'ARS' ? usd : ars
  const mainBalance = parseSetupBalance(mainAmount)
  const otherBalance = both ? parseSetupBalance(otherAmount) : 0
  const valid =
    name.trim().length > 0 && mainBalance !== null && otherBalance !== null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    if (!valid) {
      setValidation(
        'Completá el nombre y un saldo válido. Si no tenés dinero en esa cuenta, escribí 0.'
      )
      return
    }
    setValidation(null)
    onSave({
      name: name.trim(),
      type,
      currency,
      balanceARS: currency === 'ARS' ? mainBalance : otherBalance,
      balanceUSD: currency === 'USD' ? mainBalance : otherBalance,
    })
  }
  const message = validation ?? error

  return (
    <main className={styles.setup}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/gota-wordmark-primary.svg"
            width="104"
            height="32"
            alt="Gota"
          />
          <span className={styles.headerNote}>
            {isAnonymous ? 'Sin cuenta · con tus datos' : 'Tu punto de partida'}
          </span>
        </header>
        <div className={styles.layout}>
          <section className={styles.intro}>
            <p className={styles.eyebrow}>EMPECEMOS POR LO SIMPLE</p>
            <h1>
              ¿Dónde tenés
              <br />
              tu plata?
            </h1>
            <p className={styles.lead}>
              Sumá tu cuenta principal. Después podés agregar las demás, a tu
              ritmo.
            </p>
            <div className={styles.promise}>
              <div className={styles.promiseIcon}>
                <Wallet size={24} />
              </div>
              <div>
                <strong>Una cuenta. Tu primer paso.</strong>
                <p>
                  Solo registramos tus datos. No conectamos tu banco ni movemos
                  dinero.
                </p>
              </div>
            </div>
          </section>
          <form className={styles.form} onSubmit={submit} aria-busy={saving}>
            <fieldset disabled={saving} className={styles.fields}>
              <legend className={styles.srOnly}>Tu cuenta principal</legend>
              <label className={styles.label} htmlFor="setup-name">
                Nombre de la cuenta
              </label>
              <input
                id="setup-name"
                className={styles.input}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setValidation(null)
                }}
                maxLength={60}
                placeholder="Por ejemplo, BBVA"
                autoComplete="off"
                required
              />
              <div
                className={styles.suggestions}
                aria-label="Nombres sugeridos"
              >
                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion.name}
                    onClick={() => {
                      setName(suggestion.name)
                      setType(suggestion.type)
                      setValidation(null)
                    }}
                    aria-pressed={name === suggestion.name}
                  >
                    {suggestion.name}
                  </button>
                ))}
              </div>
              <fieldset className={styles.typeGroup}>
                <legend className={styles.label}>Tipo de cuenta</legend>
                <div className={styles.kinds}>
                  {kinds.map((kind) => (
                    <label
                      key={kind.value}
                      className={`${styles.kind} ${type === kind.value ? styles.selected : ''}`}
                    >
                      <input
                        type="radio"
                        name="account-kind"
                        value={kind.value}
                        checked={type === kind.value}
                        onChange={() => setType(kind.value)}
                      />
                      <kind.icon
                        size={23}
                        weight={type === kind.value ? 'duotone' : 'regular'}
                        aria-hidden
                      />
                      <span>{kind.label}</span>
                      {type === kind.value && (
                        <Check
                          size={12}
                          className={styles.kindCheck}
                          aria-hidden
                        />
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className={styles.balanceHeading}>
                <label className={styles.label} htmlFor="setup-balance">
                  Saldo actual
                </label>
                <label className={styles.currency}>
                  Moneda
                  <select
                    aria-label="Moneda principal"
                    value={currency}
                    onChange={(event) => {
                      setCurrency(event.target.value as SetupCurrency)
                      setValidation(null)
                    }}
                  >
                    <option value="ARS">Pesos · ARS</option>
                    <option value="USD">Dólares · USD</option>
                  </select>
                </label>
              </div>
              <div className={styles.amount}>
                <span aria-hidden>{currency === 'ARS' ? '$' : 'USD'}</span>
                <input
                  id="setup-balance"
                  inputMode="decimal"
                  type="text"
                  value={mainAmount}
                  onChange={(event) => {
                    if (currency === 'ARS') setArs(event.target.value)
                    else setUsd(event.target.value)
                    setValidation(null)
                  }}
                  placeholder="0,00"
                  aria-describedby="balance-help"
                  required
                />
              </div>
              <p className={styles.hint} id="balance-help">
                Lo que tenés hoy, no tu sueldo ni el límite de una tarjeta. Cero
                también es un saldo.
              </p>
              <label className={styles.both}>
                <input
                  type="checkbox"
                  checked={both}
                  onChange={(event) => setBoth(event.target.checked)}
                />
                También tengo {currency === 'ARS' ? 'dólares' : 'pesos'} en esta
                cuenta
              </label>
              {both && (
                <div className={styles.other}>
                  <label className={styles.label} htmlFor="setup-other-balance">
                    Saldo en {currency === 'ARS' ? 'dólares' : 'pesos'}
                  </label>
                  <input
                    id="setup-other-balance"
                    className={styles.input}
                    inputMode="decimal"
                    value={otherAmount}
                    onChange={(event) =>
                      currency === 'ARS'
                        ? setUsd(event.target.value)
                        : setArs(event.target.value)
                    }
                    placeholder="0,00"
                    required
                  />
                </div>
              )}
              <p className={styles.hint}>
                Después, registrá solo gastos que todavía no estén incluidos en
                este saldo.
              </p>
              <details className={styles.help}>
                <summary>¿Desde cuándo empiezo a registrar?</summary>
                <p>
                  Desde este saldo, cargá movimientos que todavía no estén
                  incluidos. Si anotás una compra que ya descontó tu banco, se
                  descontaría otra vez.
                </p>
              </details>
            </fieldset>
            {message && (
              <p role="alert" className={styles.error}>
                {message}
              </p>
            )}
            <button type="submit" disabled={saving} className={styles.primary}>
              {saving
                ? 'Guardando tu cuenta…'
                : initialAccount
                  ? 'Guardar y abrir Gota'
                  : 'Crear cuenta y abrir Gota'}
              {!saving && <ArrowRight size={18} aria-hidden />}
            </button>
            <p className={styles.footerNote}>
              {isAnonymous
                ? 'Tus datos se guardan en Gota. Después podés vincular un mail para recuperar el acceso.'
                : 'Podés editar la cuenta y sus saldos desde Configuración.'}
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}
