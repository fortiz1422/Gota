import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const SETTINGS_LINE_INPUT_FILES = [

  '../components/settings/AccountSection.tsx',
  '../components/settings/CardsSection.tsx',
  '../components/settings/CounterpartyAliasesPanel.tsx',
  '../components/settings/DeleteAccountControl.tsx',
  '../components/settings/SharedReceiptDevicesPanel.tsx',
  '../components/settings/SubscriptionBottomSheet.tsx',
]

describe('Settings line input focus and number format', () => {
  it('keeps the approved account line-input contract as the canonical reference', () => {
    const source = read('../components/settings/AccountBottomSheet.tsx')

    expect(source).toContain('const editInputClass =')
    expect(source).toContain('focus-visible:!outline-none')
    expect(source).toContain('focus-visible:ring-0')
  })

  it.each(SETTINGS_LINE_INPUT_FILES)('%s suppresses the global rectangular focus outline locally', (path) => {
    const source = read(path)
    const lineControls = source.match(/className="[^"]*focus:ring-0[^"]*"/g) ?? []

    expect(lineControls.length).toBeGreaterThan(0)
    for (const control of lineControls) {
      expect(control).toContain('focus-visible:!outline-none')
      expect(control).toContain('focus-visible:ring-0')
    }
  })

  it('keeps subscription amounts locale-formatted while the payload consumes canonical state', () => {
    const source = read('../components/settings/SubscriptionBottomSheet.tsx')

    expect(source).toContain("import { formatArDecimal, parseArDecimalInput } from '@/lib/ar-input'")
    expect(source).toContain('value={formatArDecimal(amount)}')
    expect(source).toContain('setAmount(parseArDecimalInput(event.target.value))')
    expect(source).toContain('const numericAmount = Number(amount)')
  })

  it('does not locale-group card suffixes or calendar days', () => {
    const cards = read('../components/settings/CardsSection.tsx')
    const subscriptions = read('../components/settings/SubscriptionBottomSheet.tsx')

    expect(cards).toContain('value={lastFour}')
    expect(cards).not.toContain('value={formatArDecimal(lastFour)}')
    expect(subscriptions).toContain('value={dayOfMonth}')
    expect(subscriptions).not.toContain('value={formatArDecimal(dayOfMonth)}')
  })
})
