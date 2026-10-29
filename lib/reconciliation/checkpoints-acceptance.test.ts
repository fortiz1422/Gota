import { afterEach, describe, expect, it, vi } from 'vitest'
import type { createClient } from '@/lib/supabase/server'
import type { Account } from '@/types/database'
import { buildLiveBalanceBreakdown } from '@/lib/live-balance'
import {
  getBalanceForAccount,
  getCurrentBalanceBreakdown,
} from '@/lib/current-account-balance'
import { applyCommand } from './commands'
import {
  acceptAdjustment,
  addCheckpoint,
  balanceAfterReverse,
  balanceAfterUnlink,
  balanceCorrection,
  checkpointDay,
  closeExplanation,
  emptyWorkspace,
  homeBalance,
  liveCorrection,
  moneyToMinor,
  observedResidual,
  remaining,
  resolveAdjustment,
  resolveObservation,
  reverseAdjustment,
  undoResolution,
  unexplained,
  unpostedGap,
  type MovementEvidence,
  type Workspace,
} from './domain'
import { reconciliationErrorMessage } from './errors'
import { ledgerSnapshot, readCorrections } from './repository'
import { nextReconciliationAccount } from './queue'
import { balanceCheckTask, hasPendingExplanation } from './tasks'

const admin = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => admin,
}))
vi.mock('@/lib/format', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/format')>('@/lib/format')
  return { ...actual, todayAR: () => '2026-10-24' }
})

const ACCOUNT = '10000000-0000-4000-8000-0000000000a1'
const CLOSED = '10000000-0000-4000-8000-0000000000b2'
const FRESH = '10000000-0000-4000-8000-0000000000c3'
const DOLLARS = '10000000-0000-4000-8000-0000000000d4'
const EXPENSE_ID = '20000000-0000-4000-8000-000000000030'
const LATER_ID = '20000000-0000-4000-8000-000000000010'
const CP = '30000000-0000-4000-8000-0000000000c1'
const ADJ = '30000000-0000-4000-8000-0000000000a2'
const RES = '30000000-0000-4000-8000-0000000000e3'
const FP = 'ab'.repeat(16)
const OBSERVED = '2026-10-07T15:00:00.000Z'
const PRIOR = '2026-10-06T15:00:00.000Z'
const AFTER = '2026-10-08T15:00:00.000Z'
const FRIDAY = '2026-10-09T18:00:00.000Z'
const SATURDAY = '2026-10-10T13:00:00.000Z'
const EXPECTED = 50_000_000
const CONFIRMED = 42_000_000

afterEach(() => {
  vi.unstubAllEnvs()
  admin.from.mockReset()
  admin.rpc.mockReset()
})

function bank(id: string, name: string, ars: number, usd: number): Account {
  return {
    id,
    name,
    type: 'bank',
    is_primary: id === ACCOUNT,
    opening_balance_ars: ars,
    opening_balance_usd: usd,
  } as Account
}

function priorMovement(
  overrides: Partial<MovementEvidence> = {}
): MovementEvidence {
  return {
    id: EXPENSE_ID,
    kind: 'expense',
    accountId: ACCOUNT,
    currency: 'ARS',
    effect: -3_000_000,
    occurredAt: PRIOR,
    includedBeforeCheckpoint: false,
    ...overrides,
  }
}

function observe(included: string[] = []): Workspace {
  return addCheckpoint(emptyWorkspace(ACCOUNT, 'ARS'), {
    id: CP,
    observedAt: OBSERVED,
    expected: EXPECTED,
    confirmed: CONFIRMED,
    includedMovementIds: included,
  })
}

function publish(state = observe()): Workspace {
  return acceptAdjustment(state, {
    id: ADJ,
    checkpointId: CP,
    currentExpected: EXPECTED,
    now: OBSERVED,
  })
}

function explain(state = publish()): Workspace {
  return resolveAdjustment(state, {
    id: RES,
    adjustmentId: ADJ,
    movement: priorMovement(),
    now: OBSERVED,
    confirmedIncludedInBalance: true,
  })
}

function pesos(state: Workspace, expenses: number[] = []): number {
  const correction = liveCorrection(state) / 100
  return buildLiveBalanceBreakdown({
    accounts: [bank(ACCOUNT, 'BBVA', 500_000, 200)],
    currency: 'ARS',
    incomes: [],
    debitExpenses: expenses.map((amount) => ({
      account_id: ACCOUNT,
      amount,
    })),
    cardPayments: [],
    transfers: [],
    reconciliationCorrections:
      correction === 0 ? [] : [{ account_id: ACCOUNT, amount: correction }],
  })[0].saldo
}

/** Selección de GET /api/reconciliation y de la campana: cuenta y moneda, sin `visited`. */
function rebuiltQueue(
  accounts: { id: string; name: string }[],
  rows: { account_id: string; currency: 'ARS' | 'USD'; state: Workspace }[],
  currency: 'ARS' | 'USD',
  now: Date
) {
  return accounts.flatMap((account) => {
    const row = rows.find(
      (item) => item.account_id === account.id && item.currency === currency
    )
    const task = balanceCheckTask(account, currency, row?.state ?? null, now)
    return task ? [task] : []
  })
}

function thenable(result: {
  data: unknown
  error: { message: string } | null
}) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => query,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  }
  return query
}

function supabase(options: {
  rows: Record<string, Record<string, unknown>[]>
  failingTable?: string
}) {
  return {
    from(table: string) {
      let data: Record<string, unknown>[] = (options.rows[table] ?? []).map((row, index) => ({ id: `${table}-${index}`, ...row }))
      let from = 0, to = Infinity
      const query = {
        range: (start: number, end: number) => { from = start; to = end; return query },
        select: () => query,
        order: () => query,
        eq: (key: string, value: unknown) => {
          data = data.filter((row) => row[key] === value)
          return query
        },
        neq: (key: string, value: unknown) => {
          data = data.filter((row) => row[key] !== value)
          return query
        },
        in: (key: string, values: unknown[]) => {
          data = data.filter((row) => values.includes(row[key]))
          return query
        },
        lt: (key: string, value: string) => {
          data = data.filter(
            (row) => Date.parse(String(row[key])) < Date.parse(value)
          )
          return query
        },
        lte: (key: string, value: string) => {
          data = data.filter((row) => String(row[key]) <= value)
          return query
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(
            options.failingTable === table
              ? { data: null, error: { message: 'down' } }
              : { data: data.slice(from, to + 1), count: data.length, error: null }
          ).then(resolve),
      }
      return query
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>
}

/** Same breakdown Home and POST /api/reconciliation use, including posted corrections. */
async function apiLedger(
  state: Workspace,
  expenses: { id: string; amount: number; date: string }[]
) {
  vi.stubEnv('BALANCE_RECONCILIATION_SCHEMA_READY', 'true')
  admin.from.mockReturnValue(
    thenable({
      data: [{ account_id: ACCOUNT, currency: 'ARS', state }],
      error: null,
    })
  )
  const client = supabase({
    rows: {
      accounts: [
        {
          id: ACCOUNT,
          user_id: 'user',
          name: 'BBVA',
          type: 'bank',
          is_primary: true,
          archived: false,
          opening_balance_ars: 500_000,
          opening_balance_usd: 200,
        },
      ],
      expenses: expenses.map((expense) => ({
        id: expense.id,
        user_id: 'user',
        account_id: ACCOUNT,
        amount: expense.amount,
        currency: 'ARS',
        category: 'Comida',
        payment_method: 'DEBIT',
        date: expense.date,
      })),
      income_entries: [],
      transfers: [],
      yield_daily_entries: [],
      instruments: [],
    },
  })
  const params = { supabase: client, userId: 'user', currency: 'ARS' as const }
  const [homeRows, postedRows] = await Promise.all([
    getCurrentBalanceBreakdown(params),
    getCurrentBalanceBreakdown({ ...params, postedOnly: true }),
  ])
  const home = getBalanceForAccount(homeRows, ACCOUNT)
  const posted = getBalanceForAccount(postedRows, ACCOUNT)
  if (home === null || posted === null) throw new Error('balance_missing')
  return {
    home,
    posted,
    homeMinor: moneyToMinor(home.toFixed(2)),
    postedMinor: moneyToMinor(posted.toFixed(2)),
  }
}

describe('checkpoints de saldo', () => {
  it('caso a: 500.000 contra 420.000 dejan 80.000 sin publicar', () => {
    const state = observe()
    const checkpoint = state.checkpoints[0]
    expect(state.step).toBe('discrepancy')
    expect(state.accountId).toBe(ACCOUNT)
    expect(state.currency).toBe('ARS')
    expect(checkpoint.previousId).toBeNull()
    expect(checkpointDay(checkpoint.observedAt)).toBe('2026-10-07')
    expect(checkpoint.delta).toBe(-8_000_000)
    expect(observedResidual(state, checkpoint)).toBe(-8_000_000)
    expect(observedResidual(state, checkpoint) / 100).toBe(-80_000)
    expect(state.adjustments).toHaveLength(0)
    expect(balanceCorrection(state)).toBe(0)
    expect(unexplained(state)).toBe(-8_000_000)
    expect(liveCorrection(state)).toBe(-8_000_000)
    expect(pesos(state)).toBe(420_000)
  })

  it('caso b: un gasto previo de 30.000 baja lo pendiente a 50.000 sin segundo descuento', () => {
    const posted = publish()
    expect(balanceCorrection(posted)).toBe(-8_000_000)
    expect(pesos(posted)).toBe(420_000)

    const state = explain()
    expect(remaining(state, state.adjustments[0]) / 100).toBe(-50_000)
    expect(balanceCorrection(state) / 100).toBe(-50_000)
    expect(pesos(state, [30_000])).toBe(420_000)
    expect(state.resolutions[0]).toMatchObject({
      movementId: EXPENSE_ID,
      movementKind: 'expense',
      effect: -3_000_000,
      occurredAt: PRIOR,
      reversedAt: null,
    })
    expect(() =>
      resolveAdjustment(state, {
        id: '30000000-0000-4000-8000-0000000000e4',
        adjustmentId: ADJ,
        movement: priorMovement(),
        now: OBSERVED,
        confirmedIncludedInBalance: true,
      })
    ).toThrow('already_resolved')
    expect(balanceCorrection(state)).toBe(-5_000_000)

    const alreadyInside = publish(observe([`expense:${EXPENSE_ID}`]))
    expect(() => explain(alreadyInside)).toThrow('already_in_checkpoint')
    expect(balanceCorrection(alreadyInside)).toBe(-8_000_000)
    expect(pesos(alreadyInside)).toBe(420_000)
  })

  it('G03-D/E: saldo vivo 420.000 y pendiente 50.000 antes y después de publicar', () => {
    const state = resolveObservation(observe(), {
      id: RES,
      movement: priorMovement(),
      now: OBSERVED,
      confirmedIncludedInBalance: true,
    })
    expect(state.adjustments).toEqual([])
    expect(observedResidual(state, state.checkpoints[0]) / 100).toBe(-50_000)
    expect(unexplained(state)).toBe(-5_000_000)
    expect(balanceCorrection(state)).toBe(0)
    expect(liveCorrection(state)).toBe(-5_000_000)
    expect(pesos(state, [30_000])).toBe(420_000)
    expect(
      balanceCheckTask(
        { id: ACCOUNT, name: 'BBVA' },
        'ARS',
        state,
        new Date(OBSERVED)
      )?.label
    ).toBe('Seguir con BBVA')

    const posted = acceptAdjustment(state, {
      id: ADJ,
      checkpointId: CP,
      currentExpected: 47_000_000,
      now: OBSERVED,
    })
    expect(unexplained(posted)).toBe(0)
    expect(balanceCorrection(posted) / 100).toBe(-50_000)
    expect(liveCorrection(posted) / 100).toBe(-50_000)
    expect(remaining(posted, posted.adjustments[0]) / 100).toBe(-50_000)
    expect(pesos(posted, [30_000])).toBe(420_000)
    expect(posted.resolutions).toHaveLength(1)
  })

  it('caso c: un gasto posterior baja el saldo y after_checkpoint lo rechaza', () => {
    const state = explain()
    expect(() =>
      resolveAdjustment(state, {
        id: '30000000-0000-4000-8000-0000000000e5',
        adjustmentId: ADJ,
        movement: priorMovement({
          id: LATER_ID,
          effect: -1_000_000,
          occurredAt: AFTER,
        }),
        now: AFTER,
        confirmedIncludedInBalance: true,
      })
    ).toThrow('after_checkpoint')
    expect(reconciliationErrorMessage('after_checkpoint')).toBe(
      'Ese movimiento ocurrió después de confirmar el saldo. Revisá la fecha.'
    )
    expect(balanceCorrection(state)).toBe(-5_000_000)
    expect(remaining(state, state.adjustments[0])).toBe(-5_000_000)
    expect(state.resolutions).toHaveLength(1)
    expect(pesos(state, [30_000, 10_000])).toBe(410_000)
  })

  it('unexplained distingue lo que falta publicar de la corrección ya publicada', async () => {
    const open = observe()
    expect(unexplained(open)).toBe(-8_000_000)
    expect(balanceCorrection(open)).toBe(0)
    const explained = resolveObservation(open, {
      id: RES,
      movement: priorMovement(),
      now: OBSERVED,
      confirmedIncludedInBalance: true,
    })
    expect(unexplained(explained)).toBe(-5_000_000)
    expect(balanceCorrection(explained)).toBe(0)
    const posted = publish()
    expect(unexplained(posted)).toBe(0)
    expect(balanceCorrection(posted)).toBe(-8_000_000)
    expect(liveCorrection(posted)).toBe(balanceCorrection(posted))

    vi.stubEnv('BALANCE_RECONCILIATION_SCHEMA_READY', 'true')
    const usd = addCheckpoint(emptyWorkspace(ACCOUNT, 'USD'), {
      id: '30000000-0000-4000-8000-0000000000d1',
      observedAt: OBSERVED,
      expected: 20_000,
      confirmed: 12_000,
      includedMovementIds: [],
    })
    admin.from.mockReturnValue(
      thenable({
        data: [
          { account_id: ACCOUNT, currency: 'ARS', state: open },
          { account_id: ACCOUNT, currency: 'USD', state: usd },
        ],
        error: null,
      })
    )
    await expect(readCorrections('user')).resolves.toEqual([
      { account_id: ACCOUNT, currency: 'ARS', amount: -80_000 },
      { account_id: ACCOUNT, currency: 'USD', amount: -80 },
    ])
    await expect(
      readCorrections('user', { postedOnly: true })
    ).resolves.toEqual([])
    expect(pesos(open)).toBe(420_000)
    expect(liveCorrection(usd)).toBe(-8_000)
    expect(liveCorrection(open)).not.toBe(liveCorrection(usd))
  })

  it('G03-F: desvincular una resolución de checkpoint no mueve el saldo y el preview coincide', () => {
    const linked = resolveObservation(observe(), {
      id: RES,
      movement: priorMovement(),
      now: OBSERVED,
      confirmedIncludedInBalance: true,
    })
    expect(linked.resolutions[0].adjustmentId).toBe(`checkpoint:${CP}`)
    expect(pesos(linked, [30_000])).toBe(420_000)
    const shown = moneyToMinor(pesos(linked, [30_000]).toFixed(2))
    expect(balanceAfterUnlink(shown, linked, linked.resolutions[0])).toBe(shown)

    const undone = undoResolution(linked, RES, FRIDAY)
    expect(undone.resolutions[0].reversedAt).toBe(FRIDAY)
    expect(unexplained(undone)).toBe(-5_000_000)
    expect(unpostedGap(undone)).toBe(-5_000_000)
    expect(balanceCorrection(undone)).toBe(0)
    expect(liveCorrection(undone)).toBe(-5_000_000)
    expect(pesos(undone, [30_000])).toBe(420_000)
    expect(() =>
      resolveObservation(undone, {
        id: '30000000-0000-4000-8000-0000000000e8',
        movement: priorMovement({ id: LATER_ID, effect: -8_000_000 }),
        now: FRIDAY,
        confirmedIncludedInBalance: true,
      })
    ).toThrow('effect_exceeds_gap')
    const replaced = resolveObservation(undone, {
      id: '30000000-0000-4000-8000-0000000000e9',
      movement: priorMovement({
        id: '20000000-0000-4000-8000-000000000050',
        effect: -5_000_000,
      }),
      now: FRIDAY,
      confirmedIncludedInBalance: true,
    })
    expect(unpostedGap(replaced)).toBe(0)
    expect(pesos(replaced, [30_000, 50_000])).toBe(420_000)
    const undoneHome = moneyToMinor(pesos(undone, [30_000]).toFixed(2))
    expect(balanceAfterUnlink(undoneHome, undone, undone.resolutions[0])).toBe(
      undoneHome
    )

    const posted = acceptAdjustment(undone, {
      id: ADJ,
      checkpointId: CP,
      currentExpected: 47_000_000,
      now: FRIDAY,
    })
    expect(posted.adjustments).toHaveLength(1)
    expect(balanceCorrection(posted)).toBe(-5_000_000)
    expect(unexplained(posted)).toBe(0)
    expect(pesos(posted, [30_000])).toBe(420_000)
    expect(posted.resolutions).toHaveLength(1)
  })

  it('el ledger de la API mantiene Home en 420.000 en los dos caminos', async () => {
    const expense = { id: EXPENSE_ID, amount: 30_000, date: PRIOR }
    const later = { id: LATER_ID, amount: 10_000, date: AFTER }
    const explainedFirst = resolveObservation(observe(), {
      id: RES,
      movement: priorMovement(),
      now: OBSERVED,
      confirmedIncludedInBalance: true,
    })
    const adjustedFirst = explain()
    const paths = [
      {
        name: 'explicar antes de ajustar',
        open: explainedFirst,
        closed: closeExplanation(
          acceptAdjustment(explainedFirst, {
            id: ADJ,
            checkpointId: CP,
            currentExpected: (await apiLedger(explainedFirst, [expense]))
              .postedMinor,
            now: OBSERVED,
          }),
          ADJ
        ),
      },
      {
        name: 'ajustar y después explicar',
        open: adjustedFirst,
        closed: closeExplanation(adjustedFirst, ADJ),
      },
    ]
    for (const [index, path] of paths.entries()) {
      const openLedger = await apiLedger(path.open, [expense])
      expect(openLedger.home, path.name).toBe(420_000)
      expect(homeBalance(openLedger.postedMinor, path.open)).toBe(
        openLedger.homeMinor
      )
      const unlinked = undoResolution(path.open, RES, FRIDAY)
      const unlinkedLedger = await apiLedger(unlinked, [expense])
      expect(
        balanceAfterUnlink(
          openLedger.homeMinor,
          path.open,
          path.open.resolutions[0]
        )
      ).toBe(unlinkedLedger.homeMinor)
      const withLater = await apiLedger(path.open, [expense, later])
      const laterUnlinked = await apiLedger(unlinked, [expense, later])
      expect(withLater.home, path.name).toBe(410_000)
      expect(
        balanceAfterUnlink(
          withLater.homeMinor,
          path.open,
          path.open.resolutions[0]
        )
      ).toBe(laterUnlinked.homeMinor)
      const laterMove = priorMovement({
        id: LATER_ID,
        effect: -1_000_000,
        occurredAt: AFTER,
      })
      if (path.open.adjustments.length) {
        expect(() =>
          resolveAdjustment(path.open, {
            id: '30000000-0000-4000-8000-0000000000e5',
            adjustmentId: path.open.adjustments[0].id,
            movement: laterMove,
            now: AFTER,
            confirmedIncludedInBalance: true,
          })
        ).toThrow('after_checkpoint')
      } else {
        expect(() =>
          resolveObservation(path.open, {
            id: '30000000-0000-4000-8000-0000000000e5',
            movement: laterMove,
            now: AFTER,
            confirmedIncludedInBalance: true,
          })
        ).toThrow('after_checkpoint')
      }

      const closedLedger = await apiLedger(path.closed, [expense])
      expect(closedLedger.home, path.name).toBe(420_000)
      const bookMinor = moneyToMinor(
        (closedLedger.posted - balanceCorrection(path.closed) / 100).toFixed(2)
      )
      const anchors = [closedLedger.postedMinor, bookMinor]
      for (const [anchorIndex, anchor] of anchors.entries()) {
        const again = applyCommand(
          path.closed,
          {
            requestId: `30000000-0000-4000-8000-000000000c${index}${anchorIndex}`,
            version: 1,
            fingerprint: FP,
            action: 'confirm',
            amount: '420000.00',
          },
          { now: FRIDAY, expected: anchor, movementIds: [] }
        )
        const againLedger = await apiLedger(again, [expense])
        expect(againLedger.home, path.name).toBe(420_000)
        expect(homeBalance(againLedger.postedMinor, again)).toBe(
          againLedger.homeMinor
        )
      }
    }
  })

  it('desvincular un checkpoint al 100% deja seguir resolviendo o cerrar', () => {
    const linked = resolveObservation(observe(), {
      id: RES,
      movement: priorMovement({ effect: -8_000_000 }),
      now: OBSERVED,
      confirmedIncludedInBalance: true,
    })
    expect(unpostedGap(linked)).toBe(0)
    expect(pesos(linked, [80_000])).toBe(420_000)
    const undone = undoResolution(linked, RES, FRIDAY)
    expect(unpostedGap(undone)).toBe(0)
    expect(hasPendingExplanation(undone)).toBe(true)
    expect(pesos(undone, [80_000])).toBe(420_000)
    const replaced = resolveObservation(undone, {
      id: '30000000-0000-4000-8000-0000000000e4',
      movement: priorMovement({
        id: '20000000-0000-4000-8000-000000000080',
        effect: -8_000_000,
      }),
      now: FRIDAY,
      confirmedIncludedInBalance: true,
    })
    expect(pesos(replaced, [80_000, 80_000])).toBe(420_000)
    const closed = acceptAdjustment(undone, {
      id: '30000000-0000-4000-8000-0000000000a4',
      checkpointId: CP,
      currentExpected: 42_000_000,
      now: FRIDAY,
    })
    expect(closed.step).toBe('resolved')
    expect(hasPendingExplanation(closed)).toBe(false)
    expect(balanceCorrection(closed)).toBe(0)
    expect(pesos(closed, [80_000])).toBe(420_000)
  })

  it('caso e: desvincular y revertir conservan el rastro y no acumulan', () => {
    const linked = explain()
    expect(() => reverseAdjustment(linked, ADJ, OBSERVED)).toThrow(
      'undo_resolutions_first'
    )
    expect(balanceCorrection(linked)).toBe(-5_000_000)
    expect(balanceAfterUnlink(42_000_000, linked, linked.resolutions[0])).toBe(
      39_000_000
    )

    const undone = undoResolution(linked, RES, FRIDAY)
    expect(undone.resolutions).toHaveLength(1)
    expect(undone.resolutions[0]).toMatchObject({
      id: RES,
      adjustmentId: ADJ,
      movementId: EXPENSE_ID,
      movementKind: 'expense',
      effect: -3_000_000,
      occurredAt: PRIOR,
      compensatedAt: OBSERVED,
      reversedAt: FRIDAY,
    })
    expect(undone.checkpoints).toEqual(linked.checkpoints)
    expect(balanceCorrection(undone)).toBe(-8_000_000)
    expect(pesos(undone, [30_000])).toBe(390_000)

    const reversed = reverseAdjustment(undone, ADJ, FRIDAY)
    expect(reversed.adjustments[0]).toMatchObject({
      id: ADJ,
      checkpointId: CP,
      reversedAt: FRIDAY,
    })
    expect(remaining(reversed, reversed.adjustments[0])).toBe(0)
    expect(balanceCorrection(reversed)).toBe(0)
    expect(unexplained(reversed)).toBe(-8_000_000)
    expect(reversed.checkpoints[0].id).toBe(CP)
    expect(balanceAfterReverse(39_000_000, undone, ADJ)).toBe(39_000_000)
    expect(pesos(reversed, [30_000])).toBe(390_000)
    expect(() =>
      acceptAdjustment(reversed, {
        id: '30000000-0000-4000-8000-0000000000a8',
        checkpointId: CP,
        currentExpected: 47_000_000,
        now: FRIDAY,
      })
    ).toThrow('balance_changed')
    expect(reversed.adjustments).toHaveLength(1)

    const again = acceptAdjustment(reversed, {
      id: '30000000-0000-4000-8000-0000000000a8',
      checkpointId: CP,
      currentExpected: EXPECTED,
      now: FRIDAY,
    })
    expect(again.adjustments).toHaveLength(2)
    expect(again.adjustments[0].reversedAt).toBe(FRIDAY)
    expect(balanceCorrection(again)).toBe(-8_000_000)
    expect(pesos(again)).toBe(420_000)
    expect(pesos(again, [30_000])).toBe(390_000)
  })

  it('caso f: ARS y USD no se mezclan y el período queda explícito', async () => {
    const ars = explain()
    expect(ars.accountId).toBe(ACCOUNT)
    expect(ars.currency).toBe('ARS')
    expect(checkpointDay(ars.checkpoints[0].observedAt)).toBe('2026-10-07')
    expect(() =>
      resolveAdjustment(ars, {
        id: '30000000-0000-4000-8000-0000000000e6',
        adjustmentId: ADJ,
        movement: priorMovement({ currency: 'USD' }),
        now: OBSERVED,
        confirmedIncludedInBalance: true,
      })
    ).toThrow('wrong_account_or_currency')
    expect(() =>
      resolveAdjustment(ars, {
        id: '30000000-0000-4000-8000-0000000000e7',
        adjustmentId: ADJ,
        movement: priorMovement({ id: LATER_ID, accountId: DOLLARS }),
        now: OBSERVED,
        confirmedIncludedInBalance: true,
      })
    ).toThrow('wrong_account_or_currency')
    expect(balanceCorrection(ars)).toBe(-5_000_000)

    const baseline = addCheckpoint(emptyWorkspace(ACCOUNT, 'ARS'), {
      id: '30000000-0000-4000-8000-0000000000b0',
      observedAt: '2026-10-01T15:00:00.000Z',
      expected: EXPECTED,
      confirmed: EXPECTED,
      includedMovementIds: [],
    })
    const next = addCheckpoint(baseline, {
      id: CP,
      observedAt: OBSERVED,
      expected: EXPECTED,
      confirmed: CONFIRMED,
      includedMovementIds: [],
    })
    const adjusted = acceptAdjustment(next, {
      id: ADJ,
      checkpointId: CP,
      currentExpected: EXPECTED,
      now: OBSERVED,
    })
    expect(() =>
      resolveAdjustment(adjusted, {
        id: RES,
        adjustmentId: ADJ,
        movement: priorMovement({ occurredAt: '2026-10-01T15:00:00.000Z' }),
        now: OBSERVED,
        confirmedIncludedInBalance: true,
      })
    ).toThrow('outside_interval')
    expect(reconciliationErrorMessage('outside_interval')).toBe(
      'La fecha pertenece a una confirmación anterior. Revisá el movimiento.'
    )
    expect(balanceCorrection(adjusted)).toBe(-8_000_000)
    expect(checkpointDay('2026-10-01T15:00:00.000Z')).toBe('2026-10-01')

    const usd = acceptAdjustment(
      addCheckpoint(emptyWorkspace(ACCOUNT, 'USD'), {
        id: '30000000-0000-4000-8000-0000000000d9',
        observedAt: OBSERVED,
        expected: 20_000,
        confirmed: 12_000,
        includedMovementIds: [],
      }),
      {
        id: '30000000-0000-4000-8000-0000000000da',
        checkpointId: '30000000-0000-4000-8000-0000000000d9',
        currentExpected: 20_000,
        now: OBSERVED,
      }
    )
    expect(usd.currency).toBe('USD')
    expect(balanceCorrection(usd) / 100).toBe(-80)
    vi.stubEnv('BALANCE_RECONCILIATION_SCHEMA_READY', 'true')
    admin.from.mockReturnValue(
      thenable({
        data: [
          { account_id: ACCOUNT, currency: 'ARS', state: ars },
          { account_id: ACCOUNT, currency: 'USD', state: usd },
        ],
        error: null,
      })
    )
    const client = supabase({
      rows: {
        accounts: [
          {
            id: ACCOUNT,
            user_id: 'user',
            name: 'BBVA',
            type: 'bank',
            is_primary: true,
            archived: false,
            opening_balance_ars: 500_000,
            opening_balance_usd: 200,
          },
        ],
        expenses: [
          {
            user_id: 'user',
            account_id: ACCOUNT,
            amount: 30_000,
            currency: 'ARS',
            category: 'Supermercado',
            payment_method: 'DEBIT',
            date: PRIOR,
          },
          {
            user_id: 'user',
            account_id: ACCOUNT,
            amount: 40,
            currency: 'USD',
            category: 'Supermercado',
            payment_method: 'DEBIT',
            date: PRIOR,
          },
          {
            user_id: 'user',
            account_id: ACCOUNT,
            amount: 1_000,
            currency: 'ARS',
            category: 'Supermercado',
            payment_method: 'DEBIT',
            date: '2026-10-25T02:59:59.000Z',
          },
          {
            user_id: 'user',
            account_id: ACCOUNT,
            amount: 99_999,
            currency: 'ARS',
            category: 'Supermercado',
            payment_method: 'DEBIT',
            date: '2026-10-25T04:00:00.000Z',
          },
        ],
      },
    })
    const arsRows = await getCurrentBalanceBreakdown({
      supabase: client,
      userId: 'user',
      currency: 'ARS',
    })
    const usdRows = await getCurrentBalanceBreakdown({
      supabase: client,
      userId: 'user',
      currency: 'USD',
    })
    expect(arsRows.map((row) => [row.id, row.saldo])).toEqual([
      [ACCOUNT, 419_000],
    ])
    expect(usdRows.map((row) => [row.id, row.saldo])).toEqual([[ACCOUNT, 80]])
  })

  it('caso g: dato ausente o error no se convierte en cero', async () => {
    for (const value of ['', ' ', 'NaN', 'undefined', '1.001'])
      expect(() => moneyToMinor(value)).toThrow('invalid_money')
    const command = {
      version: 0,
      fingerprint: FP,
    }
    expect(() =>
      applyCommand(
        emptyWorkspace(ACCOUNT, 'ARS'),
        { ...command, requestId: CP, action: 'confirm' },
        { now: OBSERVED, expected: EXPECTED, movementIds: [] }
      )
    ).toThrow('invalid_money')
    expect(() =>
      applyCommand(
        publish(),
        {
          ...command,
          requestId: RES,
          version: 1,
          action: 'resolve',
          targetId: ADJ,
          included: true,
        },
        { now: OBSERVED, expected: EXPECTED, movementIds: [] }
      )
    ).toThrow('movement_required')
    expect(() =>
      resolveObservation(emptyWorkspace(ACCOUNT, 'ARS'), {
        id: RES,
        movement: priorMovement(),
        now: OBSERVED,
        confirmedIncludedInBalance: true,
      })
    ).toThrow('checkpoint_missing')
    expect(() =>
      resolveAdjustment(publish(), {
        id: RES,
        adjustmentId: ADJ,
        movement: priorMovement({ effect: 0 }),
        now: OBSERVED,
        confirmedIncludedInBalance: true,
      })
    ).toThrow('no_account_effect')
    expect(() =>
      buildLiveBalanceBreakdown({
        accounts: [bank(ACCOUNT, 'BBVA', 500_000, 200)],
        currency: 'ARS',
        incomes: [],
        debitExpenses: [],
        cardPayments: [],
        transfers: [],
        reconciliationCorrections: [{ account_id: 'missing', amount: -80_000 }],
      })
    ).toThrow('reconciliation_account_missing')

    vi.stubEnv('BALANCE_RECONCILIATION_SCHEMA_READY', 'true')
    admin.from.mockReturnValue(
      thenable({ data: null, error: { message: 'down' } })
    )
    await expect(readCorrections('user')).rejects.toThrow(
      'reconciliation_unavailable'
    )
    admin.from.mockReturnValue(
      thenable({
        data: [
          {
            account_id: ACCOUNT,
            currency: 'ARS',
            state: { adjustments: null },
          },
        ],
        error: null,
      })
    )
    await expect(readCorrections('user')).rejects.toThrow(TypeError)
    admin.rpc.mockResolvedValue({ data: {}, error: null })
    await expect(ledgerSnapshot('user')).rejects.toThrow('ledger_unavailable')
    admin.rpc.mockResolvedValue({ data: null, error: { message: 'down' } })
    await expect(ledgerSnapshot('user')).rejects.toThrow('ledger_unavailable')
    await expect(
      getCurrentBalanceBreakdown({
        supabase: supabase({
          rows: {
            accounts: [
              {
                id: ACCOUNT,
                user_id: 'user',
                name: 'BBVA',
                type: 'bank',
                is_primary: true,
                archived: false,
                opening_balance_ars: 500_000,
                opening_balance_usd: 200,
              },
            ],
          },
          failingTable: 'expenses',
        }),
        userId: 'user',
        currency: 'ARS',
      })
    ).rejects.toThrow('balance_unavailable')
  })

  it('retoma días después el checkpoint pendiente sin republicar el ajuste', () => {
    const pending: Workspace = {
      ...explain(),
      draft: {
        amount: '30000',
        description: 'Supermercado',
        category: 'Supermercado',
        date: '2026-10-06',
      },
    }
    const restored = JSON.parse(JSON.stringify(pending)) as Workspace
    expect(restored.checkpoints).toHaveLength(1)
    expect(restored.checkpoints[0].id).toBe(CP)
    expect(restored.draft).toEqual(pending.draft)
    expect(balanceCorrection(restored)).toBe(-5_000_000)
    expect(remaining(restored, restored.adjustments[0])).toBe(-5_000_000)
    const replay = {
      version: 2,
      fingerprint: FP,
    }
    expect(() =>
      applyCommand(
        restored,
        {
          ...replay,
          requestId: CP,
          action: 'confirm',
          amount: '420000.00',
        },
        { now: FRIDAY, expected: EXPECTED, movementIds: [] }
      )
    ).toThrow('duplicate_checkpoint')
    expect(() =>
      applyCommand(
        restored,
        {
          ...replay,
          requestId: '30000000-0000-4000-8000-000000000099',
          action: 'adjust',
          targetId: CP,
        },
        { now: FRIDAY, expected: 47_000_000, movementIds: [] }
      )
    ).toThrow('already_adjusted')
    expect(restored.checkpoints).toHaveLength(1)
    expect(restored.adjustments).toHaveLength(1)
    expect(balanceCorrection(restored)).toBe(-5_000_000)

    const accounts = [
      { id: CLOSED, name: 'Nación' },
      { id: ACCOUNT, name: 'BBVA' },
      { id: FRESH, name: 'Efectivo' },
      { id: DOLLARS, name: 'Dólares' },
    ]
    const rows = [
      {
        account_id: CLOSED,
        currency: 'ARS' as const,
        state: addCheckpoint(emptyWorkspace(CLOSED, 'ARS'), {
          id: '30000000-0000-4000-8000-0000000000c9',
          observedAt: OBSERVED,
          expected: 10_000_000,
          confirmed: 10_000_000,
          includedMovementIds: [],
        }),
      },
      { account_id: ACCOUNT, currency: 'ARS' as const, state: restored },
      {
        account_id: DOLLARS,
        currency: 'USD' as const,
        state: addCheckpoint(emptyWorkspace(DOLLARS, 'USD'), {
          id: '30000000-0000-4000-8000-0000000000d8',
          observedAt: OBSERVED,
          expected: 20_000,
          confirmed: 12_000,
          includedMovementIds: [],
        }),
      },
    ]
    const friday = rebuiltQueue(accounts, rows, 'ARS', new Date(FRIDAY))
    expect(
      friday.map((task) => [task.accountId, task.label, task.currency])
    ).toEqual([
      [ACCOUNT, 'Seguir con BBVA', 'ARS'],
      [FRESH, 'Confirmá tu saldo de Efectivo', 'ARS'],
      [DOLLARS, 'Confirmá tu saldo de Dólares', 'ARS'],
    ])
    expect(friday[0].href).toBe(`/reconciliation/${ACCOUNT}?currency=ARS`)
    expect(
      nextReconciliationAccount(
        friday.map((task) => ({
          id: task.accountId,
          name: task.accountName,
        })),
        ACCOUNT,
        []
      )?.id
    ).toBe(FRESH)

    const saturday = rebuiltQueue(accounts, rows, 'ARS', new Date(SATURDAY))
    expect(saturday.map((task) => [task.accountId, task.label])).toEqual([
      [CLOSED, 'Confirmá tu saldo de Nación'],
      [ACCOUNT, 'Seguir con BBVA'],
      [FRESH, 'Confirmá tu saldo de Efectivo'],
      [DOLLARS, 'Confirmá tu saldo de Dólares'],
    ])
    expect(balanceCorrection(restored)).toBe(-5_000_000)
    expect(restored.checkpoints).toHaveLength(1)

    const dollars = rebuiltQueue(accounts, rows, 'USD', new Date(FRIDAY))
    expect(dollars.find((task) => task.accountId === DOLLARS)).toMatchObject({
      currency: 'USD',
      label: 'Seguir con Dólares',
      href: `/reconciliation/${DOLLARS}?currency=USD`,
    })
    expect(dollars.find((task) => task.accountId === ACCOUNT)?.label).toBe(
      'Confirmá tu saldo de BBVA'
    )
  })
})
