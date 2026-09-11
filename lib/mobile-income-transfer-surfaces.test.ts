import { readFileSync } from 'node:fs'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  buildIncomePayload,
  buildTransferPayload,
  formatMonetaryInput,
  normalizeMonetaryInput,
} from '@/lib/mobile-income-transfer-surfaces'
import type { Account, IncomeEntry, Transfer } from '@/types/database'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('@/components/ui/TaskSurface', () => ({
  TaskSurface: ({
    children,
    footer,
    title,
    appearance,
    canvasTone,
    initialFocusRef,
  }: {
    children: ReactNode
    footer: ReactNode
    title: string
    appearance?: string
    canvasTone?: string
    initialFocusRef?: unknown
  }) =>
    createElement(
      'div',
      {
        'data-task-surface': title,
        'data-task-appearance': appearance,
        'data-task-canvas-tone': canvasTone,
        'data-has-initial-focus': String(Boolean(initialFocusRef)),
      },
      children,
      footer
    ),
}))

vi.mock('@/components/ui/ConfirmationSurface', () => ({
  ConfirmationSurface: ({
    children,
    title,
    appearance,
    open,
  }: {
    children: ReactNode
    title: string
    appearance?: string
    open: boolean
  }) =>
    open
      ? createElement(
          'div',
          {
            'data-confirmation-surface': title,
            'data-confirmation-appearance': appearance,
          },
          children
        )
      : null,
}))

import { IncomeModal } from '@/components/dashboard/IncomeModal'
import { TransferForm } from '@/components/dashboard/TransferForm'
import { IncomeEditSheet } from '@/components/movimientos/IncomeEditSheet'
import { TransferEditSheet } from '@/components/movimientos/TransferEditSheet'

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8')

const surfaceFiles = [
  '../components/dashboard/IncomeModal.tsx',
  '../components/dashboard/TransferForm.tsx',
  '../components/movimientos/IncomeEditSheet.tsx',
  '../components/movimientos/TransferEditSheet.tsx',
]

const accounts = [
  {
    id: 'bank-1',
    name: 'BNA',
    type: 'bank',
    is_primary: true,
    archived: false,
  },
  {
    id: 'bank-2',
    name: 'Mendel',
    type: 'digital',
    is_primary: false,
    archived: false,
  },
] as Account[]

const income = {
  id: 'income-1',
  account_id: 'bank-1',
  amount: 1305.5,
  currency: 'ARS',
  category: 'salary',
  description: 'Sueldo',
  date: '2026-09-10T12:00:00.000Z',
} as IncomeEntry

const transfer = {
  id: 'transfer-1',
  from_account_id: 'bank-1',
  to_account_id: 'bank-2',
  amount_from: 1305.5,
  amount_to: 1305.5,
  currency_from: 'ARS',
  currency_to: 'ARS',
  exchange_rate: null,
  date: '2026-09-10',
  note: null,
} as Transfer

describe('mobile income and transfer surfaces', () => {
  it('uses the canonical compact task contract for create and edit', () => {
    for (const file of surfaceFiles) {
      const source = read(file)
      expect(source).toContain(
        "import { TaskSurface } from '@/components/ui/TaskSurface'"
      )
      expect(source).toContain('appearance="compact"')
      expect(source).toContain('initialFocusRef=')
      expect(source).toContain('<InlineError')
      expect(source).toContain('focus-visible:!outline-none')
      expect(source).not.toContain("from '@/components/ui/Modal'")
      expect(source).not.toContain('alert(')
      expect(source).toContain('type="button"')
    }
    const taskSurface = read('../components/ui/TaskSurface.tsx')
    expect(taskSurface).toContain('data-task-scroll')
    expect(taskSurface).toContain('data-task-footer')
    expect(taskSurface).toContain('env(safe-area-inset-bottom)')
    expect(taskSurface).toContain("canvasTone?: 'standard'")
    expect(taskSurface).toContain(
      "canvasTone === 'standard' ? 'bg-bg-primary' : 'bg-bg-secondary'"
    )
  })

  it('keeps income account chips and category selects structurally separated from the footer', () => {
    const createSource = read('../components/dashboard/IncomeModal.tsx')
    const editSource = read('../components/movimientos/IncomeEditSheet.tsx')

    for (const source of [createSource, editSource]) {
      expect(source).toContain('rounded-full border')
      expect(source).toContain('border-primary bg-primary/15 text-primary')
      expect(source).toContain('border-border-ocean bg-primary/[0.03] text-text-tertiary')
      expect(source).toContain('rounded-input border border-transparent bg-bg-tertiary')
      expect(source).not.toContain('grid grid-cols-3')
      expect(source).not.toContain('surface-module')
    }

    expect(createSource).not.toContain('Cancelar')
    const editFooterStart = editSource.indexOf('footer={')
    const editFooterEnd = editSource.indexOf('      >', editFooterStart)
    const editFooter = editSource.slice(editFooterStart, editFooterEnd)
    expect(editFooter).not.toContain('deleteTriggerRef')
    expect(editFooter).not.toContain('Eliminar ingreso')
    expect(editSource).toContain('ref={deleteTriggerRef}')
    expect(editSource).toContain('onClick={() => setConfirmDelete(true)}')
    expect(editSource).toContain('border-danger/25')
  })

  it('renders all four real components through the compact task contract', () => {
    const renders = [
      renderToStaticMarkup(
        createElement(IncomeModal, {
          accounts,
          defaultCurrency: 'ARS',
          onClose: vi.fn(),
        })
      ),
      renderToStaticMarkup(
        createElement(TransferForm, {
          accounts,
          onClose: vi.fn(),
        })
      ),
      renderToStaticMarkup(
        createElement(IncomeEditSheet, {
          entry: income,
          accounts,
          onClose: vi.fn(),
          onUpdate: vi.fn(),
        })
      ),
      renderToStaticMarkup(
        createElement(TransferEditSheet, {
          transfer,
          accounts,
          onClose: vi.fn(),
          onUpdate: vi.fn(),
        })
      ),
    ]

    for (const html of renders) {
      expect(html).toContain('data-task-appearance="compact"')
      expect(html).toContain('data-has-initial-focus="true"')
    }
    expect(renders[0]).toContain('data-task-surface="Registrar ingreso"')
    expect(renders[0]).toContain('data-task-canvas-tone="standard"')
    expect(renders[1]).toContain('data-task-surface="Transferencia"')
    expect(renders[1]).not.toContain('data-task-canvas-tone="standard"')
    expect(renders[2]).toContain('data-task-surface="Editar ingreso"')
    expect(renders[2]).toContain('data-task-canvas-tone="standard"')
    expect(renders[3]).toContain('data-task-surface="Editar transferencia"')
    expect(renders[3]).not.toContain('data-task-canvas-tone="standard"')
  })

  it('preserves the Efectivo fallback without a persisted cash account', () => {
    const createHtml = renderToStaticMarkup(
      createElement(IncomeModal, {
        accounts,
        defaultCurrency: 'ARS',
        onClose: vi.fn(),
      })
    )
    const editHtml = renderToStaticMarkup(
      createElement(IncomeEditSheet, {
        entry: income,
        accounts,
        onClose: vi.fn(),
        onUpdate: vi.fn(),
      })
    )

    expect(createHtml).toContain('Efectivo')
    expect(editHtml).toContain('Efectivo')
  })

  it('keeps the create/edit endpoint and mutation contracts explicit', () => {
    const [incomeCreate, transferCreate, incomeEdit, transferEdit] =
      surfaceFiles.map(read)
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
      expect(source).toContain('import { ConfirmationSurface }')
      expect(source).toContain('<ConfirmationSurface')
      expect(source).toContain('appearance="compact"')
      expect(source).not.toContain('confirmDelete ?')
    }
  })

  it('normalizes the supported monetary display forms without changing numbers', () => {
    expect(normalizeMonetaryInput('1.305,50')).toBe('1305.50')
    expect(normalizeMonetaryInput('1234.56')).toBe('1234.56')
    expect(normalizeMonetaryInput('1,234.56')).toBe('1234.56')
    expect(normalizeMonetaryInput('343.604')).toBe('343604')
    expect(Number(normalizeMonetaryInput('343.604'))).toBe(343604)
  })

  it('simulates incremental typing and preserves the final canonical payload amount', () => {
    const displays = ['1', '13', '130', '1.300', '13.000', '130.000']
    const canonical = displays.map(normalizeMonetaryInput)

    expect(canonical).toEqual(['1', '13', '130', '1300', '13000', '130000'])
    expect(formatMonetaryInput(canonical.at(-1) ?? '')).toBe('130.000')
    expect(Number(canonical.at(-1))).toBe(130000)
  })

  it('builds exact income create and edit payloads', () => {
    expect(
      buildIncomePayload({
        accountId: 'account-1',
        amount: '1305.50',
        currency: 'ARS',
        description: ' Sueldo ',
        category: 'salary',
        date: '2026-09-10',
        recurringIncomeId: 'recurring-1',
      })
    ).toEqual({
      account_id: 'account-1',
      amount: 1305.5,
      currency: 'ARS',
      description: 'Sueldo',
      category: 'salary',
      date: '2026-09-10',
      recurring_income_id: 'recurring-1',
    })

    expect(
      buildIncomePayload({
        accountId: null,
        amount: '1305.50',
        currency: 'USD',
        description: '',
        category: 'other',
        date: '2026-09-10',
        recurring: { day_of_month: 15 },
      })
    ).toEqual({
      account_id: null,
      amount: 1305.5,
      currency: 'USD',
      description: '',
      category: 'other',
      date: '2026-09-10',
      recurring: { day_of_month: 15 },
    })

    expect(
      buildIncomePayload({
        accountId: 'account-1',
        amount: '343604',
        currency: 'ARS',
        description: '',
        category: 'other',
        date: '2026-09-10',
      }).amount
    ).toBe(343604)
  })

  it('builds exact transfer create and edit payloads', () => {
    expect(
      buildTransferPayload({
        fromAccountId: 'from',
        toAccountId: 'to',
        amountFrom: '1305.50',
        amountTo: '1.25',
        currencyFrom: 'ARS',
        currencyTo: 'USD',
        exchangeRate: '1044.4',
        date: '2026-09-10',
        note: ' Ahorro ',
      })
    ).toEqual({
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

    expect(
      buildTransferPayload({
        fromAccountId: 'from',
        toAccountId: 'to',
        amountFrom: '100',
        amountTo: '100',
        currencyFrom: 'ARS',
        currencyTo: 'ARS',
        exchangeRate: '',
        date: '2026-09-10',
        note: '',
      }).exchange_rate
    ).toBeNull()
  })
})
