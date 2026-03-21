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
      {/* Fade abisal — enmascara el scroll antes de llegar a los elementos flotantes */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          zIndex: 45,
          pointerEvents: 'none',
          background: 'linear-gradient(to bottom, transparent, var(--color-bg-primary))',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />
        <TabBar />
    </div>
    </ReactQueryProvider>
  )
}
