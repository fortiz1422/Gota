import { createHash, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentAccountBalance } from '@/lib/current-account-balance'
import {
  CommandSchema,
  applyCommand,
  type Command,
} from '@/lib/reconciliation/commands'
import {
  emptyWorkspace,
  moneyToMinor,
  checkpointDay,
  remaining,
  observedResidual,
  type MovementEvidence,
} from '@/lib/reconciliation/domain'
import { dateInputToISO } from '@/lib/format'
import {
  ledgerSnapshot,
  readReceipt,
  readWorkspaces,
  reconciliationEnabled,
  saveWorkspace,
  saveTransferReconciliation,
} from '@/lib/reconciliation/repository'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { balanceCheckTask } from '@/lib/reconciliation/tasks'
import { reconciliationErrorMessage } from '@/lib/reconciliation/errors'

const selection = z.object({
  accountId: z.string().uuid(),
  currency: z.enum(['ARS', 'USD']),
})
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
async function context(request: Request) {
  if (
    !reconciliationEnabled() ||
    process.env.BALANCE_RECONCILIATION_SCHEMA_READY !== 'true'
  )
    throw new Error('disabled')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.is_anonymous) throw new Error('unauthorized')
  if (!checkRateLimit(`balance-reconciliation:${user.id}`, 60, 60_000))
    throw new Error('rate_limit')
  const { accountId, currency } = selection.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )
  const { data: account, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .eq('archived', false)
    .single()
  if (error || !account) throw new Error('account_unavailable')
  const before = await ledgerSnapshot(user.id)
  const [rows, balance] = await Promise.all([
    readWorkspaces(user.id),
    getCurrentAccountBalance({
      supabase,
      userId: user.id,
      accountId,
      currency,
    }),
  ])
  const after = await ledgerSnapshot(user.id)
  if (before.fingerprint !== after.fingerprint || balance === null)
    throw new Error('state_changed')
  const row = rows.find(
    (r) => r.account_id === accountId && r.currency === currency
  )
  return {
    supabase,
    user,
    account,
    accountId,
    currency,
    rows,
    snapshot: after,
    row,
    state: row?.state ?? emptyWorkspace(accountId, currency),
    expected: moneyToMinor(balance.toFixed(2)),
  }
}
async function evidence(
  ctx: Awaited<ReturnType<typeof context>>,
  command: Command
): Promise<{
  movement: MovementEvidence
  expense?: Record<string, unknown>
  income?: Record<string, unknown>
  transfer?: Record<string, unknown>
  peerAccountId?: string
  peerCurrency?: 'ARS' | 'USD'
  peerEffect?: number
}> {
  const checkpoint = command.targetId
    ? ctx.state.checkpoints.find(
        (c) =>
          c.id ===
          ctx.state.adjustments.find((a) => a.id === command.targetId)
            ?.checkpointId
      )
    : ctx.state.checkpoints.at(-1)
  if (!checkpoint) throw new Error('stale_checkpoint')
  if (command.draft) {
    const draft = command.draft
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
      new Date(`${draft.date}T00:00:00Z`).toISOString().slice(0, 10) !==
        draft.date
    )
      throw new Error('date_required')
    if (draft.kind === 'transfer') {
      const amount = moneyToMinor(draft.amount)
      if (
        amount < 100 ||
        !draft.counterAccountId ||
        draft.counterAccountId === ctx.accountId ||
        !draft.direction
      )
        throw new Error('invalid_transfer')
      const { data: peer, error } = await ctx.supabase
        .from('accounts')
        .select('id')
        .eq('id', draft.counterAccountId)
        .eq('user_id', ctx.user.id)
        .eq('archived', false)
        .single()
      if (error || !peer) throw new Error('account_unavailable')
      if (
        draft.date === checkpointDay(checkpoint.observedAt) &&
        !command.sameDayBefore
      )
        throw new Error('same_day_confirmation')
      const id = randomUUID()
      const effect = draft.direction === 'in' ? amount : -amount
      return {
        movement: {
          id,
          kind: 'transfer',
          accountId: ctx.accountId,
          currency: ctx.currency,
          effect,
          occurredAt: `${draft.date}T00:00:00-03:00`,
          includedBeforeCheckpoint: false,
        },
        peerAccountId: peer.id,
        peerCurrency: ctx.currency,
        peerEffect: -effect,
        transfer: {
          id,
          from_account_id: effect < 0 ? ctx.accountId : peer.id,
          to_account_id: effect > 0 ? ctx.accountId : peer.id,
          amount_from: amount / 100,
          amount_to: amount / 100,
          currency_from: ctx.currency,
          currency_to: ctx.currency,
          date: draft.date,
        },
      }
    }
    const kind = draft.kind ?? 'expense'
    const amount = moneyToMinor(draft.amount)
    if (
      amount < 100 ||
      !draft.description.trim() ||
      !draft.category.trim() ||
      draft.category === 'Pago de Tarjetas' ||
      (kind === 'income' &&
        !['salary', 'freelance', 'other'].includes(draft.category))
    )
      throw new Error(kind === 'income' ? 'invalid_income' : 'invalid_expense')
    if (
      draft.date === checkpointDay(checkpoint.observedAt) &&
      !command.sameDayBefore
    )
      throw new Error('same_day_confirmation')
    const id = randomUUID()
    const row = {
      id,
      account_id: ctx.accountId,
      currency: ctx.currency,
      amount: amount / 100,
      description: draft.description.trim(),
      category: draft.category,
      date: dateInputToISO(draft.date),
    }
    return {
      movement: {
        id,
        kind,
        accountId: ctx.accountId,
        currency: ctx.currency,
        effect: kind === 'income' ? amount : -amount,
        occurredAt: `${draft.date}T00:00:00-03:00`,
        includedBeforeCheckpoint: false,
      },
      ...(kind === 'income'
        ? { income: row }
        : {
            expense: {
              ...row,
              payment_method: ctx.account.type === 'cash' ? 'CASH' : 'DEBIT',
            },
          }),
    }
  }
  if (!command.movementId || !command.movementKind)
    throw new Error('movement_required')
  const table =
    command.movementKind === 'expense'
      ? 'expenses'
      : command.movementKind === 'income'
        ? 'income_entries'
        : 'transfers'
  const { data, error } = await ctx.supabase
    .from(table)
    .select('*')
    .eq('id', command.movementId)
    .eq('user_id', ctx.user.id)
    .single()
  if (error || !data) throw new Error('movement_unavailable')
  const row = data as unknown as Record<string, unknown>
  let effect = 0
  let peerAccountId: string | undefined
  let peerCurrency: 'ARS' | 'USD' | undefined
  let peerEffect: number | undefined
  if (command.movementKind === 'transfer') {
    if (
      row.from_account_id === ctx.accountId &&
      row.currency_from === ctx.currency
    ) {
      effect -= moneyToMinor(String(row.amount_from))
      peerAccountId = String(row.to_account_id)
      peerCurrency = row.currency_to as 'ARS' | 'USD'
      peerEffect = moneyToMinor(String(row.amount_to))
    }
    if (
      row.to_account_id === ctx.accountId &&
      row.currency_to === ctx.currency
    ) {
      effect += moneyToMinor(String(row.amount_to))
      peerAccountId = String(row.from_account_id)
      peerCurrency = row.currency_from as 'ARS' | 'USD'
      peerEffect = -moneyToMinor(String(row.amount_from))
    }
    if (!effect || !peerAccountId || peerAccountId === ctx.accountId)
      throw new Error('invalid_transfer')
    const { data: peer, error: peerError } = await ctx.supabase
      .from('accounts')
      .select('id')
      .eq('id', peerAccountId)
      .eq('user_id', ctx.user.id)
      .eq('archived', false)
      .single()
    if (peerError || !peer) throw new Error('account_unavailable')
  } else {
    if (row.account_id !== ctx.accountId || row.currency !== ctx.currency)
      throw new Error('wrong_account_or_currency')
    if (command.movementKind === 'income')
      effect = moneyToMinor(String(row.amount))
    else if (
      ['CASH', 'DEBIT', 'TRANSFER'].includes(String(row.payment_method)) &&
      row.category !== 'Pago de Tarjetas'
    )
      effect = -moneyToMinor(String(row.amount))
    else throw new Error('unsupported_movement')
  }
  const date = String(row.date).slice(0, 10)
  if (date === checkpointDay(checkpoint.observedAt) && !command.sameDayBefore)
    throw new Error('same_day_confirmation')
  return {
    peerAccountId,
    peerCurrency,
    peerEffect,
    movement: {
      id: command.movementId,
      kind: command.movementKind,
      accountId: ctx.accountId,
      currency: ctx.currency,
      effect,
      occurredAt: `${date}T00:00:00-03:00`,
      includedBeforeCheckpoint: checkpoint.includedMovementIds.includes(
        `${command.movementKind}:${command.movementId}`
      ),
    },
  }
}
function failure(error: unknown) {
  const code = error instanceof Error ? error.message : 'unavailable'
  const status =
    code === 'disabled'
      ? 404
      : code === 'unauthorized'
        ? 401
        : code === 'rate_limit'
          ? 429
          : ['state_changed', 'balance_changed'].includes(code)
            ? 409
            : error instanceof z.ZodError
              ? 400
              : 422
  return json(
    {
      error: reconciliationErrorMessage(code),
      code: error instanceof z.ZodError ? 'invalid_input' : code,
    },
    status
  )
}
export async function GET(request: Request) {
  try {
    const ctx = await context(request)
    const [expenses, incomes, accounts, outgoing, incoming] = await Promise.all(
      [
        ctx.supabase
          .from('expenses')
          .select('id,description,amount,date,payment_method,category')
          .eq('user_id', ctx.user.id)
          .eq('account_id', ctx.accountId)
          .eq('currency', ctx.currency)
          .in('payment_method', ['CASH', 'DEBIT', 'TRANSFER'])
          .neq('category', 'Pago de Tarjetas')
          .order('created_at', { ascending: false })
          .limit(100),
        ctx.supabase
          .from('income_entries')
          .select('id,description,amount,date,category')
          .eq('user_id', ctx.user.id)
          .eq('account_id', ctx.accountId)
          .eq('currency', ctx.currency)
          .order('created_at', { ascending: false })
          .limit(100),
        ctx.supabase
          .from('accounts')
          .select('id,name')
          .eq('user_id', ctx.user.id)
          .eq('archived', false)
          .order('name'),
        ctx.supabase
          .from('transfers')
          .select(
            'id,from_account_id,to_account_id,amount_from,amount_to,currency_from,currency_to,date'
          )
          .eq('user_id', ctx.user.id)
          .eq('from_account_id', ctx.accountId)
          .eq('currency_from', ctx.currency)
          .order('date', { ascending: false })
          .limit(100),
        ctx.supabase
          .from('transfers')
          .select(
            'id,from_account_id,to_account_id,amount_from,amount_to,currency_from,currency_to,date'
          )
          .eq('user_id', ctx.user.id)
          .eq('to_account_id', ctx.accountId)
          .eq('currency_to', ctx.currency)
          .order('date', { ascending: false })
          .limit(100),
      ]
    )
    if (
      expenses.error ||
      incomes.error ||
      accounts.error ||
      outgoing.error ||
      incoming.error
    )
      throw new Error('candidates_unavailable')
    const queue = (accounts.data ?? []).filter((account) => {
      const row = ctx.rows.find(
        (r) => r.account_id === account.id && r.currency === ctx.currency
      )
      return balanceCheckTask(
        account,
        ctx.currency,
        row?.state ?? null,
        new Date()
      )
    })
    return json({
      userId: ctx.user.id,
      account: { id: ctx.accountId, name: ctx.account.name },
      currency: ctx.currency,
      state: ctx.state,
      version: ctx.row?.version ?? 0,
      expected: ctx.expected,
      fingerprint: ctx.snapshot.fingerprint,
      queue,
      accounts: accounts.data ?? [],
      transferCorrections: ctx.rows
        .filter((r) =>
          r.state.adjustments.some(
            (a) => !a.reversedAt && remaining(r.state, a) !== 0
          )
        )
        .map((r) => ({ accountId: r.account_id, currency: r.currency })),
      transferTargets: ctx.rows.flatMap((row) => {
        if (row.account_id === ctx.accountId) return []
        const adjustments = row.state.adjustments.filter(
          (a) =>
            !a.reversedAt && !a.manuallyClosed && remaining(row.state, a) !== 0
        )
        const targets = adjustments.map((a) => ({
          accountId: row.account_id,
          currency: row.currency,
          targetId: a.id,
          checkpointDay: checkpointDay(
            row.state.checkpoints.find((c) => c.id === a.checkpointId)!
              .observedAt
          ),
          amount: remaining(row.state, a),
        }))
        const cp = row.state.checkpoints.at(-1)
        if (
          cp &&
          !row.state.adjustments.some(
            (a) => a.checkpointId === cp.id && !a.reversedAt
          ) &&
          observedResidual(row.state, cp) !== 0
        )
          targets.push({
            accountId: row.account_id,
            currency: row.currency,
            targetId: '',
            checkpointDay: checkpointDay(cp.observedAt),
            amount: observedResidual(row.state, cp),
          })
        return targets
      }),
      candidates: [
        ...(expenses.data ?? []).map((c) => ({ ...c, kind: 'expense' })),
        ...(incomes.data ?? []).map((c) => ({ ...c, kind: 'income' })),
        ...(outgoing.data ?? [])
          .filter((t) => t.to_account_id !== ctx.accountId)
          .map((t) => ({
            id: t.id,
            kind: 'transfer',
            date: t.date,
            amount: t.amount_from,
            effect: -moneyToMinor(String(t.amount_from)),
            peerAccountId: t.to_account_id,
            peerCurrency: t.currency_to,
            peerEffect: moneyToMinor(String(t.amount_to)),
            description: `A ${accounts.data?.find((a) => a.id === t.to_account_id)?.name ?? 'otra cuenta'}`,
          })),
        ...(incoming.data ?? [])
          .filter((t) => t.from_account_id !== ctx.accountId)
          .map((t) => ({
            id: t.id,
            kind: 'transfer',
            date: t.date,
            amount: t.amount_to,
            effect: moneyToMinor(String(t.amount_to)),
            peerAccountId: t.from_account_id,
            peerCurrency: t.currency_from,
            peerEffect: -moneyToMinor(String(t.amount_from)),
            description: `Desde ${accounts.data?.find((a) => a.id === t.from_account_id)?.name ?? 'otra cuenta'}`,
          })),
      ],
    })
  } catch (error) {
    return failure(error)
  }
}
export async function POST(request: Request) {
  try {
    const command = CommandSchema.parse(await request.json())
    const ctx = await context(request)
    const intentHash = createHash('sha256')
      .update(
        JSON.stringify({
          accountId: ctx.accountId,
          currency: ctx.currency,
          command,
        })
      )
      .digest('hex')
    const receipt = await readReceipt(ctx.user.id, command.requestId)
    if (receipt) {
      if (receipt.intent_hash !== intentHash) throw new Error('state_changed')
      return json({ saved: true })
    }
    if (
      command.version !== (ctx.row?.version ?? 0) ||
      command.fingerprint !== ctx.snapshot.fingerprint
    )
      throw new Error('state_changed')
    const resolved =
      command.action === 'resolve' ? await evidence(ctx, command) : null
    const state = applyCommand(ctx.state, command, {
      now: new Date().toISOString(),
      expected: ctx.expected,
      movementIds: ctx.snapshot.movementIds,
      movement: resolved?.movement,
    })
    if (resolved?.movement.kind === 'transfer') {
      const changes = [
        {
          accountId: ctx.accountId,
          currency: ctx.currency,
          version: command.version,
          state,
        },
      ]
      if (
        resolved.transfer &&
        !command.transferPeer &&
        ctx.rows.some(
          (r) =>
            r.account_id === resolved.peerAccountId &&
            r.currency === resolved.peerCurrency &&
            r.state.adjustments.some(
              (a) => !a.reversedAt && remaining(r.state, a) !== 0
            )
        )
      )
        throw new Error('peer_confirmation_required')
      if (command.transferPeer) {
        const peer = command.transferPeer
        if (peer.accountId !== resolved.peerAccountId)
          throw new Error('wrong_account_or_currency')
        const { data: account, error } = await ctx.supabase
          .from('accounts')
          .select('id')
          .eq('id', peer.accountId)
          .eq('user_id', ctx.user.id)
          .eq('archived', false)
          .single()
        if (error || !account) throw new Error('account_unavailable')
        const row = ctx.rows.find(
          (r) =>
            r.account_id === peer.accountId &&
            r.currency === resolved.peerCurrency
        )
        if (!row) throw new Error('checkpoint_missing')
        const cp = peer.targetId
          ? row.state.checkpoints.find(
              (c) =>
                c.id ===
                row.state.adjustments.find((a) => a.id === peer.targetId)
                  ?.checkpointId
            )
          : row.state.checkpoints.at(-1)
        if (!cp) throw new Error('checkpoint_missing')
        if (
          String(resolved.movement.occurredAt).slice(0, 10) ===
            checkpointDay(cp.observedAt) &&
          !peer.sameDayBefore
        )
          throw new Error('same_day_confirmation')
        const peerState = applyCommand(
          row.state,
          { ...command, targetId: peer.targetId, included: peer.included },
          {
            now: new Date().toISOString(),
            expected: 0,
            movementIds: ctx.snapshot.movementIds,
            movement: {
              ...resolved.movement,
              accountId: peer.accountId,
              currency: row.currency,
              effect: resolved.peerEffect!,
              includedBeforeCheckpoint: cp.includedMovementIds.includes(
                `transfer:${resolved.movement.id}`
              ),
            },
          }
        )
        changes.push({
          accountId: peer.accountId,
          currency: row.currency,
          version: row.version,
          state: peerState,
        })
      }
      await saveTransferReconciliation({
        userId: ctx.user.id,
        fingerprint: command.fingerprint,
        requestId: command.requestId,
        intentHash,
        transfer: resolved.transfer,
        changes,
      })
      return json({ saved: true })
    }
    if (command.transferPeer) throw new Error('invalid_transfer')
    await saveWorkspace({
      userId: ctx.user.id,
      accountId: ctx.accountId,
      currency: ctx.currency,
      version: command.version,
      fingerprint: command.fingerprint,
      requestId: command.requestId,
      intentHash,
      state,
      expense: resolved?.expense,
      income: resolved?.income,
    })
    return json({ saved: true })
  } catch (error) {
    return failure(error)
  }
}
