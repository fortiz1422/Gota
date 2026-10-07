'use client'
import Link from 'next/link'
import { useState } from 'react'
import { AnonymousAccountUpgradeSheet } from './AnonymousAccountUpgradeSheet'

export function AnonymousLogin({ destination, existingAccount = false }: { destination: string; existingAccount?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <main className="min-h-app bg-bg-primary px-6 py-16">
      <div className="mx-auto max-w-md space-y-5">
        <h1 className="text-2xl font-bold">{existingAccount ? 'Ingresar a tu cuenta' : 'Ya empezaste sin cuenta'}</h1>
        <p className="text-text-secondary text-sm leading-6">
          {existingAccount
            ? 'Entrá con el mail o Google de tu cuenta habitual. No hace falta completar la cuenta de prueba.'
            : 'Podés seguir con tus movimientos o crear una cuenta para recuperar el acceso desde otro dispositivo.'}
        </p>
        <Link
          href={destination}
          className="bg-primary block rounded-xl px-5 py-4 text-center font-semibold text-white"
        >
          Seguir usando Gota
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="text-primary w-full py-3 font-semibold"
        >
          {existingAccount ? 'Ingresar a mi cuenta' : 'Crear cuenta o ingresar'}
        </button>
        <Link
          href="/landing"
          className="text-text-secondary block text-center text-sm"
        >
          Volver a la landing
        </Link>
      </div>
      <AnonymousAccountUpgradeSheet
        existingAccountOnly={existingAccount}
        open={open}
        onClose={() => setOpen(false)}
      />
    </main>
  )
}
