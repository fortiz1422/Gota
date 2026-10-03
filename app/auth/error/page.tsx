import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-app max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold text-text-primary">No se completó el ingreso</h1>
      <p className="text-text-secondary">
        No pudimos validar tu sesión. El enlace puede haber vencido o el ingreso puede haber
        vuelto a un entorno distinto del que lo inició.
      </p>
      <p className="text-text-secondary">
        Volvé a abrir Gota en el mismo navegador desde el que empezaste. Si sigue pasando,
        revisaremos la configuración de acceso antes de pedirte otro intento.
      </p>
      <Link href="/login" className="rounded-xl bg-text-primary px-4 py-3 text-center text-white">
        Volver a Gota
      </Link>
    </main>
  )
}
