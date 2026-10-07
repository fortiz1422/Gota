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
  type MovementEvidence,
} from '@/lib/reconciliation/domain'
import { dateInputToISO } from '@/lib/format'
import {
  ledgerSnapshot,
  readReceipt,
  readWorkspaces,
  reconciliationEnabled,
  saveWorkspace,
} from '@/lib/reconciliation/repository'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

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
    snapshot: after,
    row,
    state: row?.state ?? emptyWorkspace(accountId, currency),
    expected: moneyToMinor(balance.toFixed(2)),
  }
}
async function evidence(
  ctx: Awaited<ReturnType<typeof context>>,
  command: Command
): Promise<{ movement: MovementEvidence; expense?: Record<string, unknown> }> {
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
    const amount = moneyToMinor(draft.amount)
    if (
      amount < 100 ||
      !draft.description.trim() ||
      !draft.category.trim() ||
      draft.category === 'Pago de Tarjetas'
    )
      throw new Error('invalid_expense')
    if (
      draft.date === checkpointDay(checkpoint.observedAt) &&
      !command.sameDayBefore
    )
      throw new Error('same_day_confirmation')
    const id = randomUUID()
    return {
      movement: {
        id,
        kind: 'expense',
        accountId: ctx.accountId,
        currency: ctx.currency,
        effect: -amount,
        occurredAt: `${draft.date}T00:00:00-03:00`,
        includedBeforeCheckpoint: false,
      },
      expense: {
        id,
        account_id: ctx.accountId,
        currency: ctx.currency,
        amount: amount / 100,
        description: draft.description.trim(),
        category: draft.category,
        payment_method: ctx.account.type === 'cash' ? 'CASH' : 'DEBIT',
        date: dateInputToISO(draft.date),
      },
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
  if (command.movementKind === 'transfer') {
    if (
      row.from_account_id === ctx.accountId &&
      row.currency_from === ctx.currency
    )
      effect -= moneyToMinor(String(row.amount_from))
    if (row.to_account_id === ctx.accountId && row.currency_to === ctx.currency)
      effect += moneyToMinor(String(row.amount_to))
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
      error:
        code === 'state_changed' || code === 'balance_changed'
          ? 'Cambió el saldo. Volvé a confirmarlo.'
          : 'No pudimos completar este paso. Revisá los datos y reintentá.',
      code: error instanceof z.ZodError ? 'invalid_input' : code,
    },
    status
  )
}
export async function GET(request: Request) {
  try {
    const ctx = await context(request)
    const { data: candidates, error } = await ctx.supabase
      .from('expenses')
      .select('id,description,amount,date,payment_method,category')
      .eq('user_id', ctx.user.id)
      .eq('account_id', ctx.accountId)
      .eq('currency', ctx.currency)
      .in('payment_method', ['CASH', 'DEBIT', 'TRANSFER'])
      .neq('category', 'Pago de Tarjetas')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw new Error('candidates_unavailable')
    return json({
      userId: ctx.user.id,
      account: { id: ctx.accountId, name: ctx.account.name },
      currency: ctx.currency,
      state: ctx.state,
      version: ctx.row?.version ?? 0,
      expected: ctx.expected,
      fingerprint: ctx.snapshot.fingerprint,
      candidates: candidates ?? [],
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
    })
    return json({ saved: true })
  } catch (error) {
    return failure(error)
  }
}
