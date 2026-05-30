import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TabBar } from '@/components/navigation/TabBar'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { AnonymousBanner } from '@/components/AnonymousBanner'
import { OnboardingNudgeBanner } from '@/components/OnboardingNudgeBanner'
import { AnonymousBannerToneProvider } from '@/components/anonymous-banner/AnonymousBannerToneProvider'
import { TourProvider } from '@/components/tour/TourProvider'

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
            <main className="pb-tab-bar">{children}</main>
            <TabBar />
            <AnonymousBanner initialIsAnonymous={user.is_anonymous === true} />
            <OnboardingNudgeBanner />
          </div>
        </AnonymousBannerToneProvider>
      </TourProvider>
    </ReactQueryProvider>
  )
}
