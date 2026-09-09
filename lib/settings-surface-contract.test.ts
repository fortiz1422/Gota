import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('Settings surface contracts', () => {
  it('opens financial destinations as management surfaces', () => {
    const source = read('../components/settings/SettingsDetail.tsx')
    expect(source).toContain("import { ManagementSurface }")
    expect(source).toContain('<ManagementSurface')
    expect(source).not.toContain('<FullScreenSheet')
  })

  it('separates alias management from alias editing', () => {
    const source = read('../components/settings/CounterpartyAliasesPanel.tsx')
    expect(source).toContain('<ManagementSurface')
    expect(source).toContain('<TaskSurface')
    expect(source).not.toContain('<Modal')
  })

  it('separates device management from credential creation', () => {
    const source = read('../components/settings/SharedReceiptDevicesPanel.tsx')
    expect(source).toContain('<ManagementSurface')
    expect(source).toContain('<TaskSurface')
    expect(source).not.toContain('<Modal')
  })

  it('uses a task surface for password changes', () => {
    const source = read('../components/settings/AccountSection.tsx')
    expect(source).toContain('<TaskSurface')
    expect(source).not.toContain('<Modal')
    expect(source).toContain('passwordTriggerRef')
    expect(source).toContain('triggerRef={passwordTriggerRef}')
  })

  it('chooses an account type before opening the account task', () => {
    const list = read('../components/settings/AccountsSection.tsx')
    const task = read('../components/settings/AccountBottomSheet.tsx')
    expect(list).toContain('<ChoiceSurface')
    expect(task).toContain('<TaskSurface')
    expect(task).not.toContain('<Modal')
    expect(task).toContain('<InlineError')
    expect(task).not.toContain("alert('")
    expect(list).toContain('accountBalancesError')
    expect(list).toContain('No pudimos cargar los saldos')
    expect(list).toContain('Reintentar')
  })

  it('opens card creation and editing as tasks instead of expanding rows', () => {
    const source = read('../components/settings/CardsSection.tsx')
    expect(source).toContain('<TaskSurface')
    expect(source).not.toContain('<Modal')
    expect(source).not.toContain('expandedId')
    expect(source).not.toContain('block truncate')
  })

  it('shares the same complete profile composition with the legacy settings entry', () => {
    const source = read('../components/settings/CuentaSheet.tsx')
    expect(source).toContain('<SettingsPreferences')
    expect(source).toContain('<AccountSection')
    expect(source).toContain('<FullScreenSheet')
    expect(source).toContain('Reintentar')
    expect(source).not.toContain('<Modal')
  })

  it('uses a choice surface for the Saldo Vivo reading preference', () => {
    const source = read('../components/settings/HeroBalanceModeSheet.tsx')
    expect(source).toContain('<ChoiceSurface')
    expect(source).not.toContain('<Modal')
  })

  it('isolates irreversible account deletion in a confirmation task', () => {
    const source = read('../components/settings/DeleteAccountControl.tsx')
    expect(source).toContain('<TaskSurface')
    expect(source).toContain('ELIMINAR')
  })

  it('keeps the quick account entry on the same management and task contracts', () => {
    const source = read('../components/settings/CuentasSubSheet.tsx')
    expect(source).toContain('<ManagementSurface')
    expect(source).toContain('<AccountsSection')
    expect(source).toContain('Reintentar')
    expect(source).not.toContain('<Modal')
  })

  it('uses accessible confirmation surfaces instead of browser prompts', () => {
    const files = [
      '../components/settings/AccountBottomSheet.tsx',
      '../components/settings/CardsSection.tsx',
      '../components/settings/CounterpartyAliasesPanel.tsx',
      '../components/settings/SharedReceiptDevicesPanel.tsx',
      '../components/auth/PasskeysPanel.tsx',
    ]
    for (const file of files) {
      const source = read(file)
      expect(source).not.toContain('window.confirm')
      expect(source).toContain('ConfirmationSurface')
    }
  })
})
