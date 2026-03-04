export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-md px-4 pt-safe" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 160 }}>

        {/* DashboardHeader */}
        <div className="px-6 pt-5">
          <div className="skeleton h-8 w-32 rounded-full" />
        </div>

        {/* SaldoVivo */}
        <div className="px-2 py-6">
          <div className="skeleton h-3 w-16 rounded-full mb-3" />
          <div className="skeleton h-12 w-56 rounded-full mb-5" />
          <div className="flex gap-2.5">
            <div className="skeleton flex-1 h-[62px] rounded-full" />
            <div className="skeleton flex-1 h-[62px] rounded-full" />
          </div>
        </div>

        {/* FiltroEstoico */}
        <div className="px-2">
          <div className="skeleton h-1.5 w-full rounded-full" />
        </div>

        {/* Ultimos5 */}
        <div className="px-2">
          <div className="skeleton h-3 w-24 rounded-full mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 py-3.5">
              <div className="skeleton w-[38px] h-[38px] rounded-full shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="skeleton h-3 w-3/4 rounded-full" />
                <div className="skeleton h-2.5 w-1/2 rounded-full" />
              </div>
              <div className="skeleton h-3 w-16 rounded-full" />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
