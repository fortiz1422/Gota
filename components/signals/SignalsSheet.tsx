'use client'

import { useEffect, useId, useRef, useState, type RefObject, type KeyboardEvent } from 'react'
import { X } from '@phosphor-icons/react'
import { FullScreenSheet } from '@/components/ui/FullScreenSheet'
import type { SignalCenterModel, SignalOccurrence } from '@/lib/intelligence/signal-center'
import { nextSignalTab, type SignalCenterTab } from '@/lib/intelligence/signal-center-display'
import { SignalDetailView } from './SignalDetailView'
import { SignalsCoverageView } from './SignalsCoverageView'
import { SignalsNowView } from './SignalsNowView'

interface Props {
  open: boolean
  onClose: () => void
  model: SignalCenterModel | null
  loading?: boolean
  error?: string | null
  amountsVisible: boolean
  isHistoricalContext?: boolean
  triggerRef?: RefObject<HTMLElement | null>
  onRetry?: () => void
  onViewed?: (versions: string[]) => void
  onSignalOpened?: (signal: SignalOccurrence) => void
  onCoverageOpened?: () => void
  onNavigate?: (href: string, signal: SignalOccurrence) => void
  onAsk?: (question: string, signal: SignalOccurrence) => void
}

const TABS: Array<{ value: SignalCenterTab; label: string }> = [
  { value: 'now', label: 'Ahora' },
  { value: 'coverage', label: 'Cobertura' },
]

export function SignalsSheet({
  open,
  onClose,
  model,
  loading = false,
  error = null,
  amountsVisible,
  isHistoricalContext = false,
  triggerRef,
  onRetry,
  onViewed,
  onSignalOpened,
  onCoverageOpened,
  onNavigate,
  onAsk,
}: Props) {
  const titleId = useId()
  const tabsId = useId()
  const [tab, setTab] = useState<SignalCenterTab>('now')
  const [detail, setDetail] = useState<SignalOccurrence | null>(null)
  const tabRefs = useRef<Record<SignalCenterTab, HTMLButtonElement | null>>({ now: null, coverage: null })
  const notifiedVersions = useRef(new Set<string>())

  useEffect(() => {
    if (!open || !model || !onViewed) return
    const versions = model.signals
      .map(({ version }) => version)
      .filter((version) => !notifiedVersions.current.has(version))
    if (versions.length === 0) return
    versions.forEach((version) => notifiedVersions.current.add(version))
    onViewed(versions)
  }, [model, onViewed, open])

  function closeSheet() {
    setDetail(null)
    setTab('now')
    onClose()
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = nextSignalTab(tab, event.key)
    if (!next) return
    event.preventDefault()
    setTab(next)
    if (next === 'coverage') onCoverageOpened?.()
    tabRefs.current[next]?.focus()
  }

  return (
    <FullScreenSheet
      open={open}
      onClose={closeSheet}
      labelledBy={titleId}
      triggerRef={triggerRef}
      extendIntoTopSafeArea
    >
      {detail ? (
        <SignalDetailView
          signal={detail}
          amountsVisible={amountsVisible}
          onBack={() => setDetail(null)}
          onNavigate={onNavigate ? (href) => {
            const selectedSignal = detail
            closeSheet()
            onNavigate(href, selectedSignal)
          } : undefined}
          onAsk={onAsk ? (question) => {
            const selectedSignal = detail
            closeSheet()
            onAsk(question, selectedSignal)
          } : undefined}
        />
      ) : (
        <div className="min-h-full bg-bg-secondary">
          <div
            className="blue-zone px-5 pb-7 text-white"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">Centro personal</p>
                <h2 id={titleId} className="mt-1 text-[25px] font-extrabold tracking-[-0.02em]">Señales</h2>
              </div>
              <button type="button" onClick={closeSheet} aria-label="Cerrar Señales" className="header-glass grid h-11 w-11 place-items-center rounded-full">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 max-w-[310px] text-sm leading-relaxed text-white/75">
              {isHistoricalContext
                ? 'Señales de hoy, aunque Home esté mostrando otro mes.'
                : 'Lo que Gota detectó en tu plata, con la evidencia que usó.'}
            </p>
          </div>

          <div className="relative -mt-4 px-5">
            <div id={tabsId} role="tablist" aria-label="Vistas de Señales" className="card-s5 flex gap-1 p-1.5">
              {TABS.map(({ value, label }) => {
                const selected = tab === value
                return (
                  <button
                    key={value}
                    ref={(element) => { tabRefs.current[value] = element }}
                    id={`${tabsId}-${value}-tab`}
                    role="tab"
                    type="button"
                    aria-selected={selected}
                    aria-controls={`${tabsId}-${value}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => {
                      setTab(value)
                      if (value === 'coverage') onCoverageOpened?.()
                    }}
                    onKeyDown={handleTabKeyDown}
                    className={`min-h-11 flex-1 rounded-[13px] px-4 text-sm font-bold transition-colors ${selected ? 'bg-primary text-white' : 'text-text-secondary'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div
            id={`${tabsId}-${tab}-panel`}
            role="tabpanel"
            aria-labelledby={`${tabsId}-${tab}-tab`}
            tabIndex={0}
          >
            {tab === 'now' ? (
              <SignalsNowView
                signals={model?.signals ?? []}
                coverage={model?.coverage ?? []}
                dataQuality={model?.dataQuality ?? 'insufficient'}
                amountsVisible={amountsVisible}
                loading={loading}
                error={error}
                isHistoricalContext={isHistoricalContext}
                onRetry={onRetry}
                onSelectSignal={(signal) => {
                  setDetail(signal)
                  onSignalOpened?.(signal)
                }}
              />
            ) : loading ? (
              <p role="status" className="px-6 py-12 text-center text-sm font-semibold text-text-secondary">Cargando cobertura…</p>
            ) : error ? (
              <p role="alert" className="mx-5 mt-6 rounded-[18px] bg-danger-soft p-5 text-sm text-danger">{error}</p>
            ) : (
              <SignalsCoverageView coverage={model?.coverage ?? []} />
            )}
          </div>
        </div>
      )}
    </FullScreenSheet>
  )
}
