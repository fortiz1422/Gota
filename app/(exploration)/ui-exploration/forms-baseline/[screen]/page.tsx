import { FormsBaseline } from '@/components/_exploration/FormsBaseline'
import { notFound } from 'next/navigation'

export default async function FormsBaselinePage({ params }: { params: Promise<{ screen: string }> }) {
  // Fixtures must never submit to a signed-in user's real production account.
  if (process.env.NODE_ENV !== 'development') notFound()
  const { screen } = await params
  return <FormsBaseline screen={screen} />
}
