'use client'

import { TrendUp } from '@phosphor-icons/react'
import type { AnalyticsHeroData } from '@/lib/analytics/analytics-overview'
import { formatAmount } from '@/lib/format'

interface Props {
  hero: AnalyticsHeroData
  currency: 'ARS' | 'USD'
}

function toneClass(tone: AnalyticsHeroData['visualTone']): string {
  if (tone === 'warning') return 'text-warning'
  if (tone === 'positive') return 'text-success'
  return 'text-primary'
}

export function AnalyticsHero({ hero, currency }: Props) {
  return (
    <section className="px-[22px] py-[18px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[30px] font-extrabold leading-[1.06] tracking-[-0.03em] text-text-primary">
            {hero.headline}
          </p>
          <p className="mt-4 type-hero tabular-nums text-text-primary">
            {formatAmount(hero.amount, currency)}
          </p>
          {hero.subcopy ? (
            <p className="mt-3 text-[13px] font-medium text-text-secondary">{hero.subcopy}</p>
          ) : null}
          {hero.driver ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-pill bg-black/[0.04] px-3 py-1.5 text-[12px] font-medium text-text-secondary">
              <span className={`inline-flex ${toneClass(hero.visualTone)}`}>
                <TrendUp size={14} weight="duotone" />
              </span>
              <span>{hero.driver.label}</span>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 self-end pb-1">
          <svg width="68" height="46" viewBox="0 0 68 46" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
