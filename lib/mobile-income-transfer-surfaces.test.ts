import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildIncomePayload,
  buildTransferPayload,
  normalizeMonetaryInput,
} from '@/lib/mobile-income-transfer-surfaces'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const surfaceFiles = [
  '../components/dashboard/IncomeModal.tsx',
  '../components/dashboard/TransferForm.tsx',
  '../components/movimientos/IncomeEditSheet.tsx',
  '../components/movimientos/TransferEditSheet.tsx',
]

describe('mobile income and transfer surfaces', () => {
  it('uses the canonical compact task contract for create and edit', () => {
    for (const file of surfaceFiles) {
      const source = read(file)
      expect(source).toContain("import { TaskSurface } from '@/components/ui/TaskSurface'")
      expect(source).toContain('appearance="compact"')
      expect(source).toContain('initialFocusRef=')
      expect(source).toContain('<InlineError')
      expect(source).not.toContain("from '@/components/ui/Modal'")
      expect(source).not.toContain('alert(')
      expect(source).toContain('type="button"')
    }
    const taskSurface = read('../components/ui/TaskSurface.tsx')
    expect(taskSurface).toContain('data-task-scroll')
    expect(taskSurface).toContain('data-task-footer')
    expect(taskSurface).toContain('env(safe-area-inset-bottom)')
  })

  it('keeps the create/edit endpoint and mutation contracts explicit', () => {
    const [incomeCreate, transferCreate, incomeEdit, transferEdit] = surfaceFiles.map(read)
    expect(incomeCreate).toContain("fetch('/api/income-entries'")
    expect(incomeCreate).toContain("method: 'POST'")
    expect(transferCreate).toContain("fetch('/api/transfers'")
    expect(transferCreate).toContain("method: 'POST'")
    expect(incomeEdit).toContain("method: 'PATCH'")
    expect(incomeEdit).toContain("method: 'DELETE'")
    expect(transferEdit).toContain("method: 'PATCH'")
    expect(transferEdit).toContain("method: 'DELETE'")
  })

  it('uses compact nested confirmations for both destructive editors', () => {
    for (const file of surfaceFiles.slice(2)) {
      const source = read(file)
      expect(source).toContain("import { ConfirmationSurface }")
      expect(source).toContain('<ConfirmationSurface')
      expect(source).toContain('appearance="compact"')
      expect(source).not.toContain('confirmDelete ?')
    }
  })

  it('normalizes the supported monetary display forms without changing numbers', () => {
    expect(normalizeMonetaryInput('1.305,50')).toBe('1305.50')
    expect(normalizeMonetaryInput('1234.56')).toBe('1234.56')
    expect(normalizeMonetaryInput('1,234.56')).toBe('1234.56')
  })

  it('builds exact income create and edit payloads', () => {
    expect(buildIncomePayload({
      accountId: 'account-1',
      amount: '1305.50',
      currency: 'ARS',
      description: ' Sueldo ',
      category: 'salary',
      date: '2026-09-10',
      recurringIncomeId: 'recurring-1',
    })).toEqual({
      account_id: 'account-1',
      amount: 1305.5,
      currency: 'ARS',
      description: 'Sueldo',
      category: 'salary',
      date: '2026-09-10',
      recurring_income_id: 'recurring-1',
    })

    expect(buildIncomePayload({
      accountId: null,
      amount: '1305.50',
      currency: 'USD',
      description: '',
      category: 'other',
      date: '2026-09-10',
      recurring: { day_of_month: 15 },
    })).toEqual({
      account_id: null,
      amount: 1305.5,
      currency: 'USD',
      description: '',
      category: 'other',
      date: '2026-09-10',
      recurring: { day_of_month: 15 },
    })
  })

  it('builds exact transfer create and edit payloads', () => {
    expect(buildTransferPayload({
      fromAccountId: 'from',
      toAccountId: 'to',
      amountFrom: '1305.50',
      amountTo: '1.25',
      currencyFrom: 'ARS',
      currencyTo: 'USD',
      exchangeRate: '1044.4',
      date: '2026-09-10',
      note: ' Ahorro ',
    })).toEqual({
      from_account_id: 'from',
      to_account_id: 'to',
      amount_from: 1305.5,
      amount_to: 1.25,
      currency_from: 'ARS',
      currency_to: 'USD',
      exchange_rate: 1044.4,
      date: '2026-09-10',
      note: 'Ahorro',
    })

    expect(buildTransferPayload({
      fromAccountId: 'from',
      toAccountId: 'to',
      amountFrom: '100',
      amountTo: '100',
      currencyFrom: 'ARS',
      currencyTo: 'ARS',
      exchangeRate: '',
      date: '2026-09-10',
      note: '',
    }).exchange_rate).toBeNull()
  })
})
