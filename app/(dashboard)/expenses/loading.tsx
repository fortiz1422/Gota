export default function ExpensesLoading() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-md px-4 pb-6 pt-safe">

        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <div className="skeleton h-9 w-9 rounded-full shrink-0" />
          <div className="skeleton h-4 w-16 rounded-full" />
        </div>

        {/* Filters card */}
        <div className="mb-4 rounded-card bg-bg-secondary border border-border-ocean p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="skeleton h-8 w-8 rounded-full" />
            <div className="skeleton h-4 w-28 rounded-full" />
            <div className="skeleton h-8 w-8 rounded-full" />
          </div>
          <div className="skeleton h-9 w-full rounded-full mb-2" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-7 flex-1 rounded-full" />
            ))}
          </div>
        </div>

        {/* Expense list */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-card bg-bg-tertiary">
              <div className="skeleton h-8 w-8 rounded-full shrink-0" />
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
