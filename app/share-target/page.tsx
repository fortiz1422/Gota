import { ShareTargetBridge } from '@/components/share-target/ShareTargetBridge'

export default async function ShareTargetPage({
  searchParams,
}: {
  searchParams: Promise<{ shareTargetId?: string }>
}) {
  const { shareTargetId } = await searchParams

  return <ShareTargetBridge shareTargetId={shareTargetId ?? null} />
}
