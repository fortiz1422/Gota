import { notFound } from 'next/navigation'
import { MercadoPagoDesignExamples } from '@/components/_exploration/MercadoPagoDesignExamples'

export const dynamic = 'force-dynamic'
export default function MercadoPagoDesignPage() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  return <MercadoPagoDesignExamples />
}
