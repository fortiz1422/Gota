'use client'

// Copied into app/landing/performance-audit/page.tsx by CI only. Never a shipped route.
import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { TourProvider } from '@/components/tour/TourProvider'
import { AnonymousBannerToneProvider } from '@/components/anonymous-banner/AnonymousBannerToneProvider'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'
import fixture from '@/e2e/performance/fixture-data.json'

export default function PerformanceFixture() {
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])

  return (
    <ReactQueryProvider>
      <TourProvider onboardingCompleted tourCompleted>
        <AnonymousBannerToneProvider>
          <div data-performance-ready={ready}>
            <DashboardShell
              selectedMonth="2026-10"
              viewCurrency="ARS"
              userEmail="fixture@example.invalid"
              isAnonymous={false}
              initialData={fixture as DashboardApiData}
              initialQuote={null}
            />
          </div>
        </AnonymousBannerToneProvider>
      </TourProvider>
    </ReactQueryProvider>
  )
}
