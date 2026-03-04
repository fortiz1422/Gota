export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-md px-6 pt-safe pb-6">

        {/* Title */}
        <div className="skeleton h-9 w-48 rounded-full mb-9" />

        {/* Preferencias */}
        <div className="mb-10">
          <div className="skeleton h-3 w-24 rounded-full mb-4" />
          <div className="flex flex-col gap-4">
            <div className="skeleton h-[72px] w-full rounded-card" />
            <div className="skeleton h-[72px] w-full rounded-card" />
            <div className="skeleton h-[72px] w-full rounded-card" />
          </div>
        </div>

        {/* Cuenta */}
        <div>
          <div className="skeleton h-3 w-16 rounded-full mb-4" />
          <div className="skeleton h-[120px] w-full rounded-card" />
        </div>

      </div>
    </div>
  )
}
