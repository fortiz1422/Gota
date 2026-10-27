import { ShareTargetBridge } from '@/components/share-target/ShareTargetBridge'

export default async function ShareTargetPage({
  searchParams,
}: {
  searchParams: Promise<{ shareTargetId?: string; error?: string }>
}) {
  const { shareTargetId, error } = await searchParams

  return (
    <ShareTargetBridge
      shareTargetId={shareTargetId ?? null}
      shareError={error ?? null}
    />
  )
}
