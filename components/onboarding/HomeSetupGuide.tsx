'use client'

/** Coverage guidance stays available after dismissing the first-expense invitation. */
export function HomeSetupGuide({
  hasCards,
  onAccounts,
  onCards,
}: {
  hasCards: boolean
  onAccounts: () => void
  onCards: () => void
}) {
  return (
    <section className="card-s5 p-4" aria-labelledby="home-setup-title">
      <h2
        id="home-setup-title"
        className="text-text-primary text-[15px] font-semibold"
      >
        Tu punto de partida
      </h2>
      <p className="text-text-secondary mt-2 text-[13px] leading-5">
        El saldo parte de lo que cargaste en tus cuentas. Los nuevos movimientos
        lo actualizan. No vuelvas a cargar gastos que ya estén incluidos en ese
        saldo.
      </p>
      <p className="text-text-secondary mt-2 text-[13px] leading-5">
        {hasCards
          ? 'Los compromisos aparecen a medida que cargás consumos o deuda de tus tarjetas.'
          : 'Todavía no cargaste tarjetas. El disponible considera solo lo registrado en Gota; no incluye deudas que no hayas cargado.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <button
          type="button"
          onClick={onAccounts}
          className="text-primary min-h-11 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Agregar o revisar cuentas
        </button>
        <button
          type="button"
          onClick={onCards}
          className="text-primary inline-flex min-h-11 items-center text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {hasCards ? 'Revisar tarjetas' : 'Agregar una tarjeta'}
        </button>
      </div>
      <p className="text-text-dim mt-1 text-[12px] leading-5">
        Podés completar esto después. No hace falta cargar todo para empezar.
      </p>
    </section>
  )
}
