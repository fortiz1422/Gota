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
    footerSafeArea,
    initialFocusRef,
  }: {
    children: ReactNode
    footer: ReactNode
    title: string
    appearance?: string
    canvasTone?: string
    footerSafeArea?: string
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
      createElement(
        'footer',
        {
          'data-task-footer': true,
          'data-footer-safe-area': footerSafeArea ?? 'minimum',
        },
        footer
      )
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
    expect(taskSurface).toContain("footerSafeArea?: 'minimum' | 'exact'")
    expect(taskSurface).toContain("footerSafeArea = 'minimum'")
    expect(taskSurface).toContain("footerSafeArea === 'exact'")
    expect(taskSurface).toContain("'pb-[env(safe-area-inset-bottom)]'")
    expect(taskSurface).toContain("'pb-[max(12px,env(safe-area-inset-bottom))]'")
  })

  it('opts create CTAs into exact safe-area geometry and preserves edit default', () => {
    const createSources = [
      read('../components/dashboard/IncomeModal.tsx'),
      read('../components/dashboard/TransferForm.tsx'),
    ]
    const editSources = [
      read('../components/movimientos/IncomeEditSheet.tsx'),
      read('../components/movimientos/TransferEditSheet.tsx'),
    ]

    for (const source of createSources) {
      expect(source).toContain('footerSafeArea="exact"')
      expect(source).toContain('data-primary-action')
      expect(source.indexOf('<InlineError')).toBeLessThan(
        source.indexOf('data-primary-action')
      )
    }
    expect(createSources[1]).not.toContain('Cancelar')

    for (const source of editSources) {
      expect(source).not.toContain('footerSafeArea=')
    }

  })

  it('copies ParsePreview classes for income chips, categories, and all currency selectors', () => {
    const createSource = read('../components/dashboard/IncomeModal.tsx')
    const editSource = read('../components/movimientos/IncomeEditSheet.tsx')
    const parsePreview = read('../components/dashboard/ParsePreview.tsx')
    const chipBase =
      'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors'
    const chipActive = 'border-primary bg-primary/15 text-primary'
    const chipInactive = 'border-border-ocean bg-primary/[0.03] text-text-tertiary'
    const selectClass =
      'w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none'
    const currencyBase = 'flex rounded-input bg-bg-tertiary p-1'
    const currencyButton =
      'rounded-button px-3 py-1.5 text-sm font-medium transition-colors'

    expect(parsePreview).toContain(chipBase)
    expect(parsePreview).toContain(chipActive)
    expect(parsePreview).toContain(chipInactive)
    expect(parsePreview).toContain(selectClass)
    expect(parsePreview).toContain(currencyBase)
    expect(parsePreview).toContain(currencyButton)

    for (const source of [createSource, editSource]) {
      expect(source).toContain(chipBase)
      expect(source).toContain(chipActive)
      expect(source).toContain(chipInactive)
      expect(source).toContain(selectClass)
      expect(source).toContain(currencyBase)
      expect(source).toContain(currencyButton)
      expect(source).not.toContain('grid grid-cols-3')
      expect(source).not.toContain('surface-module')
    }

    for (const source of surfaceFiles) {
      expect(read(source)).toContain(currencyBase)
      expect(read(source)).toContain(currencyButton)
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
    expect(renders[0]).toContain('data-footer-safe-area="exact"')
    expect(renders[1]).toContain('data-footer-safe-area="exact"')
    expect(renders[2]).toContain('data-footer-safe-area="minimum"')
    expect(renders[3]).toContain('data-footer-safe-area="minimum"')

    for (const html of renders.slice(0, 2)) {
      const footer = html.slice(html.indexOf('<footer'))
      expect((footer.match(/<button/g) ?? []).length).toBe(1)
      expect(footer).toContain('data-primary-action')
    }
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

  it('simulates the real formatted feedback loop, deletion, and final canonical payload amount', () => {
    let canonical = ''
    for (const key of '130000') {
      canonical = normalizeMonetaryInput(
        `${formatMonetaryInput(canonical)}${key}`,
        canonical
      )
    }

    expect(formatMonetaryInput(canonical)).toBe('130.000')
    expect(Number(canonical)).toBe(130000)

    const displayAfterDeletion = formatMonetaryInput(canonical).slice(0, -1)
    canonical = normalizeMonetaryInput(displayAfterDeletion, canonical)
    expect(formatMonetaryInput(canonical)).toBe('13.000')
    expect(Number(canonical)).toBe(13000)
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
