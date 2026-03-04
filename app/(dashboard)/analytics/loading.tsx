export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-md px-4 pt-safe pb-6" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* DashboardHeader */}
        <div className="px-6 pt-5">
          <div className="skeleton h-8 w-32 rounded-full" />
        </div>

        {/* MonthlyTrends */}
        <div className="px-2">
          <div className="skeleton h-[160px] w-full rounded-card" />
        </div>

        {/* NeedWantBreakdown */}
        <div className="px-2">
          <div className="skeleton h-3 w-28 rounded-full mb-5" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mb-[18px]">
              <div className="flex justify-between items-center mb-2">
                <div className="skeleton h-3 w-28 rounded-full" />
                <div className="skeleton h-3 w-12 rounded-full" />
              </div>
              <div className="skeleton h-[5px] w-full rounded-full" />
            </div>
          ))}
        </div>

        {/* CategoryDistribution */}
        <div className="px-2">
          <div className="skeleton h-3 w-24 rounded-full mb-5" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-[18px]">
              <div className="flex justify-between items-center mb-2">
                <div className="skeleton h-3 w-32 rounded-full" />
                <div className="skeleton h-3 w-8 rounded-full" />
              </div>
              <div className="skeleton h-[5px] w-full rounded-full" />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
