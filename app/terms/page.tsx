import Link from 'next/link'
export const metadata = { title: 'Condiciones de uso | Gota' }
export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-6 px-6 py-12">
      <Link href="/landing" className="text-primary">
        Volver a Gota
      </Link>
      <h1 className="text-3xl font-bold">Condiciones de uso</h1>
      <p>
        Gota es una aplicación de registro personal en etapa de prueba. Sus
        resultados dependen de los movimientos, saldos y compromisos que
        cargues. Revisá cada propuesta antes de guardarla.
      </p>
      <p>
        Gota no mueve tu dinero ni reemplaza los saldos y resúmenes de tus
        bancos. Los importes que muestra pueden estar incompletos si falta
        información.
      </p>
      <p>
        Sin cuenta, el acceso depende de la sesión de este navegador. Necesitás
        internet para guardar y consultar movimientos. Creá una cuenta antes de
        cerrar sesión o borrar los datos del navegador si querés conservar el
        acceso.
      </p>
      <p>
        Usá el servicio para tus propios registros. No intentes acceder a datos
        de otras personas ni automatizar solicitudes para abusar del servicio.
      </p>
      <Link href="/privacy" className="text-primary inline-block underline">
        Privacidad y manejo de datos
      </Link>
    </main>
  )
}
