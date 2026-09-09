import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('Settings calm editorial migration', () => {
  it('docks management actions at the safe-area footer', () => {
    const source = read('../components/ui/ManagementSurface.tsx')

    expect(source).toContain('extendIntoBottomSafeArea')
    expect(source).toContain('fillAvailableHeight')
    expect(source).toContain('data-management-footer')
    expect(source.indexOf('data-management-scroll')).toBeLessThan(source.indexOf('data-management-footer'))
    expect(source).toContain('pb-[max(12px,env(safe-area-inset-bottom))]')
  })

  it('supports compact choice and confirmation descendants', () => {
    const choice = read('../components/ui/ChoiceSurface.tsx')
    const confirmation = read('../components/ui/ConfirmationSurface.tsx')

    expect(choice).toContain("appearance?: 'brand' | 'compact'")
    expect(choice).toContain('data-choice-appearance={appearance}')
    expect(choice).toContain('fillAvailableHeight={compact}')
    expect(confirmation).toContain("appearance?: 'brand' | 'compact'")
    expect(confirmation).toContain('data-confirmation-appearance={appearance}')
    expect(confirmation).toContain('fillAvailableHeight={compact}')
  })

  it('uses compact task chrome across every Settings task descendant', () => {
    const files = [
      '../components/settings/AccountBottomSheet.tsx',
      '../components/settings/CardsSection.tsx',
      '../components/settings/SubscriptionBottomSheet.tsx',
      '../components/settings/CounterpartyAliasesPanel.tsx',
      '../components/settings/SharedReceiptDevicesPanel.tsx',
      '../components/settings/AccountSection.tsx',
      '../components/settings/DeleteAccountControl.tsx',
    ]

    for (const file of files) {
      expect(read(file)).toContain('appearance="compact"')
    }
  })

  it('keeps Settings confirmations and choices inside compact chrome', () => {
    const files = [
      '../components/settings/AccountsSection.tsx',
      '../components/settings/CardsSection.tsx',
      '../components/settings/SubscriptionBottomSheet.tsx',
      '../components/settings/CounterpartyAliasesPanel.tsx',
      '../components/settings/SharedReceiptDevicesPanel.tsx',
      '../components/settings/HeroBalanceModeSheet.tsx',
    ]

    for (const file of files) {
      expect(read(file)).toContain('appearance="compact"')
    }
  })

  it('uses calm white semantic modules and line fields in editable forms', () => {
    const cards = read('../components/settings/CardsSection.tsx')
    const subscriptions = read('../components/settings/SubscriptionBottomSheet.tsx')
    const aliases = read('../components/settings/CounterpartyAliasesPanel.tsx')
    const devices = read('../components/settings/SharedReceiptDevicesPanel.tsx')
    const access = read('../components/settings/AccountSection.tsx')

    expect(cards).toContain('data-card-edit-information')
    expect(cards).toContain('data-card-edit-cycle')
    expect(subscriptions).toContain('data-subscription-edit-charge')
    expect(aliases).toContain('data-counterparty-edit-information')
    expect(devices).toContain('surface-module block rounded-card')
    expect(access).toContain('data-password-edit')

    for (const source of [cards, subscriptions, aliases, devices, access]) {
      expect(source).toContain('border-b border-border-strong')
    }
  })

  it('pushes standalone card creation to the same bottom grammar as accounts', () => {
    const cards = read('../components/settings/CardsSection.tsx')
    const accounts = read('../components/settings/AccountsSection.tsx')

    for (const source of [cards, accounts]) {
      expect(source).toContain("standalone ? 'flex min-h-full flex-col' : undefined")
      expect(source).toContain("standalone ? 'mt-auto pt-4' : 'mt-4'")
    }
  })
})
