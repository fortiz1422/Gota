'use client'

import { useState } from 'react'
import { CreditCard } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
import { describeCardSetup, type StatementAnswer } from '@/lib/card-setup-state'
import { todayAR } from '@/lib/format'
import { CardSetupForm, type CardSetupSubmit } from '@/components/cards/CardSetupForm'
import type { SetupAccount, SetupCurrency } from '@/lib/onboarding-setup'
import type { Card } from '@/types/database'
import styles from './landing-flow.module.css'

type Props = {
  account: SetupAccount
  currency: SetupCurrency
  cards: Card[]
  saving?: boolean
  onBack: () => void
  onSaveCard: (input: CardSetupSubmit) => Promise<void>
  onOpen: () => void
  onSkip: () => void
}

export function CardsStep({ account, currency, cards, saving = false, onBack, onSaveCard, onOpen, onSkip }: Props) {
  const [adding, setAdding] = useState(false)
  const balance = currency === 'USD' ? account.opening_balance_usd : account.opening_balance_ars
  const today = todayAR()

  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        <button type="button" className={styles.back} onClick={onBack}>← Atrás</button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.wordmark} src="/brand/gota-wordmark-primary.svg" alt="Gota" />
        <span />
      </div>
      <div className={styles.progress}>
        <span>Paso 2 de 2</span>
        <div className={styles.track}><span style={{ width: '100%' }} /></div>
      </div>
      <p className={styles.eyebrow}>Tus tarjetas</p>
      <h1 className={styles.title}>¿Pagás <em>tarjetas</em> desde esta cuenta?</h1>
      <p className={styles.lead}>{account.name} · {formatAmount(balance, currency)}</p>
      {cards.length === 0 ? (
        <div className={`${styles.card} ${styles.cardDashed} ${styles.field}`}>
          <div className={styles.icon} style={{ margin: '0 auto 12px' }}><CreditCard size={20} /></div>
          <p className="m-0 text-[15px] text-[#536770]">Todavía no agregaste tarjetas.</p>
          <button type="button" className={`${styles.linkButton} mt-2.5`} onClick={() => setAdding(true)}>+ Agregar tarjeta</button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {cards.map((card) => {
            const described = describeCardSetup(card, [], today)
            return (
              <div key={card.id} className={styles.card}>
                <div className={styles.row}>
                  <div className={styles.icon}><CreditCard size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-semibold">{card.name}</p>
                    <p className="m-0 text-[13px] text-[#536770]">Se paga desde {account.name}</p>
                  </div>
                  {described.listLabel ? <span className={styles.tag}>{described.listLabel}</span> : null}
                </div>
                {described.answerPhrase ? <p className="mb-0 mt-3 text-[13px] text-[#536770]">{described.answerPhrase}</p> : null}
              </div>
            )
          })}
          <button type="button" className={styles.linkButton} onClick={() => setAdding(true)}>+ Agregar otra tarjeta</button>
        </div>
      )}
      <div className={styles.grow} />
      <div className={styles.footer}>
        {cards.length === 0 ? (
          <>
            <button type="button" className={styles.cta} onClick={() => setAdding(true)}>Agregar tarjeta <b>→</b></button>
            <p className="mt-4 text-center">
              <button type="button" className={styles.linkButton} style={{ color: '#536770' }} disabled={saving} onClick={onSkip}>
                Saltear por ahora
              </button>
            </p>
          </>
        ) : (
          <button type="button" className={styles.cta} disabled={saving} onClick={onOpen}>
            {saving ? 'Abriendo…' : 'Abrir Gota'} {!saving ? <b>→</b> : null}
          </button>
        )}
        <p className={styles.signature}>Gota, tu plata clara.</p>
      </div>
      {adding ? (
        <>
          <button type="button" className={styles.sheetBackdrop} aria-label="Cerrar" onClick={() => setAdding(false)} />
          <div className={styles.sheet} role="dialog" aria-label="Agregar tarjeta">
            <div className={styles.grab} />
            <p className="m-0 text-[20px] font-semibold tracking-[-0.03em]">Agregar tarjeta</p>
            <CardSetupForm
              accounts={[{ id: account.id, name: account.name }]}
              defaultAccountId={account.id}
              submitLabel="Guardar tarjeta"
              onSubmit={async (input) => {
                await onSaveCard(input)
                setAdding(false)
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

export type { StatementAnswer }
