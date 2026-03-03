import { TabBar } from '@/components/navigation/TabBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
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
          background: 'linear-gradient(to bottom, transparent, #060a0e)',
        }}
      />
      <TabBar />
    </div>
  )
}
