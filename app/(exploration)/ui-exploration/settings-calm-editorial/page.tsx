import { SettingsCalmEditorialPilot, type SettingsPilotScenario } from '@/components/_exploration/SettingsCalmEditorialPilot'

const SCENARIOS = new Set<SettingsPilotScenario>(['cards', 'accounts', 'account', 'subscription', 'access', 'alias', 'devices', 'passkeys', 'delete'])

export default async function SettingsCalmEditorialPilotPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const { scenario } = await searchParams
  const initialScenario = scenario && SCENARIOS.has(scenario as SettingsPilotScenario)
    ? scenario as SettingsPilotScenario
    : 'cards'

  return <SettingsCalmEditorialPilot initialScenario={initialScenario} />
}
