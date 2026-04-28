'use client'

import type { AnalyticsHeroData } from '@/lib/analytics/analytics-overview'
import { formatAmount } from '@/lib/format'

interface Props {
  hero: AnalyticsHeroData
  currency: 'ARS' | 'USD'
}

function splitSubcopy(text: string): { label: string; delta: string | null } {
  const parts = text.split(' ')
  const last = parts[parts.length - 1]
  if (/^[+\-−]?\d+%$/.test(last)) {
    return { label: parts.slice(0, -1).join(' '), delta: last }
  }
  return { label: text, delta: null }
}

export function AnalyticsHero({ hero, currency }: Props) {
  return (
    <section className="px-[22px] py-[18px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-secondary truncate">
            {hero.headline.length > 28 ? `${hero.headline.slice(0, 28)}…` : hero.headline}
          </p>
          <p className="mt-4 type-hero tabular-nums text-text-primary">
            {formatAmount(hero.amount, currency)}
          </p>
          {hero.subcopy ? (() => {
            const { label, delta } = splitSubcopy(hero.subcopy)
            return (
              <p className="mt-3 text-[13px] text-text-secondary">
                {label}
                {delta && (
                  <span
                    className="ml-1"
                    style={{ color: 'var(--color-success)', fontWeight: 700 }}
                  >
                    {delta}
                  </span>
                )}
              </p>
            )
          })() : null}
          {hero.driver ? (
            <p className="mt-3 text-[13px] text-text-secondary">
              {hero.driver.label}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 self-end pb-1">
          <svg
            width="68"
            height="46"
            viewBox="0 0 68 46"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ overflow: 'visible' }}
          >
            <path
              d="M0,38 L11,24 L22,30 L33,14 L46,20 L57,34 L68,26 L68,46 L0,46 Z"
              fill="rgba(33,120,168,0.07)"
            />
            <polyline
              points="0,38 11,24 22,30 33,14 46,20 57,34 68,26"
              stroke="#2178A8"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="68" cy="26" r="7" fill="rgba(33,120,168,0.15)" />
            <circle cx="68" cy="26" r="3.5" fill="#2178A8" />
          </svg>
        </div>
      </div>
    </section>
  )
}
