import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TabBar } from '@/components/navigation/TabBar'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <ReactQueryProvider>
    <div className="relative min-h-screen bg-bg-primary">
      <main className="pb-tab-bar">{children}</main>
        <TabBar />
    </div>
    </ReactQueryProvider>
  )
}
