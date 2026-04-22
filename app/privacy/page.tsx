import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacidad y datos | Gota',
  description: 'Politica de privacidad y manejo de datos de Gota.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-md px-5 py-10">
        <Link href="/" className="type-meta text-text-tertiary hover:text-text-secondary">
          Volver
        </Link>

        <h1 className="mt-6 type-title text-text-primary">Privacidad y datos</h1>
        <p className="mt-3 type-body text-text-secondary">
          Gota guarda informacion financiera personal para mostrar balances, gastos,
          cuentas, tarjetas, ingresos, transferencias y suscripciones.
        </p>

        <section className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Datos que guardamos</h2>
          <p className="type-body text-text-secondary">
            Guardamos los datos que cargas en la app y configuraciones necesarias para
            operar tu cuenta. Esto incluye movimientos, cuentas, tarjetas, ciclos de
            tarjeta, ingresos, instrumentos, suscripciones y preferencias.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">SmartInput e IA</h2>
          <p className="type-body text-text-secondary">
            Cuando usas SmartInput, el texto que escribis se envia a un proveedor de IA
            para interpretar el gasto y completar una propuesta editable. No se usa para
            publicidad ni para entrenar un modelo propio de Gota.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Metricas y errores</h2>
          <p className="type-body text-text-secondary">
            Registramos eventos de producto y errores tecnicos para mejorar la app. La
            instrumentacion esta pensada para no guardar montos, descripciones libres,
            emails ni payloads financieros completos.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Borrado de cuenta</h2>
          <p className="type-body text-text-secondary">
            Desde Configuracion podes pedir el borrado de tu cuenta. El flujo elimina los
            datos financieros asociados y luego elimina el usuario de autenticacion. Es
            una accion irreversible.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Contacto</h2>
          <p className="type-body text-text-secondary">
            Si necesitas revisar o borrar datos y no podes hacerlo desde la app, contacta
            al responsable del producto por el canal de soporte vigente.
          </p>
        </section>
      </div>
    </main>
  )
}
