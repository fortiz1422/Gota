'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle, X, PencilSimple } from '@phosphor-icons/react'
import { SmartInput } from '@/components/dashboard/SmartInput'
import type { Account, Card } from '@/types/database'
import styles from './onboarding.module.css'

const GUIDE_EVENT = 'gota:first-expense-guide-dismissed'
function subscribeDismissal(listener: () => void) {
  window.addEventListener('storage', listener)
  window.addEventListener(GUIDE_EVENT, listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener(GUIDE_EVENT, listener)
  }
}

export function FirstExpenseGuide({
  accounts,
  cards,
  onAfterSave,
  onDismiss,
}: {
  accounts: Account[]
  cards: Card[]
  onAfterSave: () => void
  onDismiss?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [saved, setSaved] = useState(false)

  const accountId =
    accounts.find((account) => account.is_primary)?.id ?? accounts[0]?.id
  const storageKey = `gota.first-expense-guide.v1:${accountId ?? ''}`
  const storedDismissal = useSyncExternalStore(
    subscribeDismissal,
    () => {
      try {
        return Boolean(
          accountId && window.localStorage.getItem(storageKey) === 'dismissed'
        )
      } catch {
        return false
      }
    },
    () => false
  )
  function dismiss() {
    setDismissed(true)
    try {
      if (accountId) window.localStorage.setItem(storageKey, 'dismissed')
    } catch {
      /* Session-only dismissal if storage is blocked. */
    }
    window.dispatchEvent(new Event(GUIDE_EVENT))
    onDismiss?.()
  }

  if (dismissed || storedDismissal) return null
  return (
    <section className={styles.guide} aria-labelledby="first-expense-title">
      <div className={styles.guideTop}>
        <span className={styles.guideIcon}>
          {saved ? <CheckCircle size={23} /> : <PencilSimple size={23} />}
        </span>
        <button
          type="button"
          aria-label="Cerrar guía del primer gasto"
          className={styles.dismiss}
          onClick={dismiss}
        >
          <X size={17} />
        </button>
      </div>
      <p className={styles.eyebrow}>
        {saved ? 'YA EMPEZASTE' : 'TU PRIMER MOVIMIENTO'}
      </p>
      <h2 id="first-expense-title">
        {saved ? 'Tu gasto quedó guardado.' : 'Un gasto. Así de simple.'}
      </h2>
      <p className={styles.guideLead}>
        {saved
          ? 'Lo encontrás en tus últimos movimientos. Podés seguir cargando cuando quieras.'
          : 'Escribí como lo contarías. Revisás los datos antes de guardar.'}
      </p>
      {saved ? (
        <Link className={styles.guideAction} href="/movimientos">
          Ver movimientos <ArrowRight size={16} />
        </Link>
      ) : (
        <>
          {!open && (
            <div className={styles.example}>
              <span>Ejemplo · no se guarda</span>
              <p>“café 2500 con débito”</p>
            </div>
          )}
          <p className={styles.balanceWarning}>
            Elegí un gasto que todavía no esté incluido en el saldo que
            cargaste.
          </p>
          {open ? (
            <div className={styles.guideComposer}>
              <SmartInput
                accounts={accounts}
                cards={cards}
                previewMode="embedded"
                focusSignal={1}
                onAfterSave={() => {
                  setSaved(true)
                  onAfterSave()
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              className={styles.guideAction}
              onClick={() => setOpen(true)}
            >
              Cargar mi primer gasto <ArrowRight size={16} />
            </button>
          )}
          <button type="button" className={styles.later} onClick={dismiss}>
            Lo hago después
          </button>
        </>
      )}
    </section>
  )
}
