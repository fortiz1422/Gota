import { notFound } from 'next/navigation'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { MercadoPagoReviewClient } from '@/components/mercadopago/MercadoPagoReviewClient'
export default function MercadoPagoBatchFixture() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <ReactQueryProvider>
      <p className="text-center text-xs">Vista de prueba · Datos ficticios</p>
      <MercadoPagoReviewClient />
    </ReactQueryProvider>
  )
}
