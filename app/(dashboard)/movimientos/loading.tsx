export default function MovimientosLoading() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div
        className="mx-auto max-w-md px-4 pt-safe"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pt-5">
          <div className="skeleton h-5 w-28 rounded-full" />
          <div className="skeleton h-8 w-40 rounded-full" />
        </div>

        {/* StripOperativo */}
        <div className="flex items-stretch">
          {['a', 'b', 'c'].map((k, i) => (
            <>
              {i > 0 && (
                <div key={`d${k}`} style={{ width: '1px', background: 'rgba(144,164,176,0.25)', alignSelf: 'stretch' }} />
              )}
              <div key={k} className="flex flex-1 flex-col items-center px-[14px] py-1 gap-[6px]">
                <div className="skeleton h-2 w-16 rounded-full" />
                <div className="skeleton h-[18px] w-14 rounded-full" />
                <div className="skeleton h-2 w-20 rounded-full" />
              </div>
            </>
          ))}
        </div>

        {/* Movement rows */}
        <div className="space-y-0">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 py-3">
              <div className="skeleton h-[38px] w-[38px] shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="skeleton h-3.5 w-2/3 rounded" />
                <div className="skeleton h-2.5 w-1/3 rounded" />
              </div>
              <div className="skeleton h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
