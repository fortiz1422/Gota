import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TabBar } from '@/components/navigation/TabBar'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { AnonymousBanner } from '@/components/AnonymousBanner'
import { OnboardingNudgeBanner } from '@/components/OnboardingNudgeBanner'
import { AnonymousBannerToneProvider } from '@/components/anonymous-banner/AnonymousBannerToneProvider'
import { GotaAssistant } from '@/components/assistant/GotaAssistant'
import { TourProvider } from '@/components/tour/TourProvider'
import { FF_GOTA_ASSISTANT } from '@/lib/flags'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: config } = await supabase
    .from('user_config')
    .select('onboarding_completed, tour_completed')
    .eq('user_id', user.id)
    .single()

  const onboardingCompleted = config?.onboarding_completed ?? false
  const tourCompleted = config?.tour_completed ?? false

  return (
    <ReactQueryProvider>
      <TourProvider onboardingCompleted={onboardingCompleted} tourCompleted={tourCompleted}>
        <AnonymousBannerToneProvider>
          <div className="relative min-h-app bg-bg-primary">
            <div
              aria-hidden="true"
              className="blue-zone pointer-events-none absolute inset-x-0 top-0"
              style={{ height: 'calc(env(safe-area-inset-top) + 14rem)' }}
            />
            <div className="relative z-10">
              <main className="pb-tab-bar">{children}</main>
              <TabBar />
              {FF_GOTA_ASSISTANT && <GotaAssistant />}
              <AnonymousBanner initialIsAnonymous={user.is_anonymous === true} />
              <OnboardingNudgeBanner />
            </div>
          </div>
        </AnonymousBannerToneProvider>
      </TourProvider>
    </ReactQueryProvider>
  )
}
