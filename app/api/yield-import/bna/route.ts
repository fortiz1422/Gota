import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  calculateDailyYieldAmount,
  inferTnaFromDailyAmount,
  parseBnaYieldCsv,
  reconcileYieldEntry,
} from '@/lib/yield-daily'
import type { Account, YieldDailyEntryInsert } from '@/types/database'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const accountId = String(body.account_id ?? '')
  const csv = String(body.csv ?? '')
  const fileName = body.file_name == null ? null : String(body.file_name)

  if (!accountId) return NextResponse.json({ error: 'account_id is required' }, { status: 400 })
  if (!csv.trim()) return NextResponse.json({ error: 'csv is required' }, { status: 400 })

  const { data: accountData, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single()

  if (accountError || !accountData) {
    return NextResponse.json({ error: accountError?.message ?? 'Account not found' }, { status: 404 })
  }

  const account = accountData as Account
  const rows = parseBnaYieldCsv(csv)

  const { data: importData, error: importError } = await supabase
    .from('statement_imports')
    .insert({
      user_id: user.id,
      account_id: account.id,
      provider: 'bna',
      file_name: fileName,
      row_count: rows.length,
      matched_yield_count: 0,
      ignored_count: 0,
    })
    .select('id')
    .single()

  if (importError || !importData) {
    return NextResponse.json({ error: importError?.message ?? 'Import creation failed' }, { status: 500 })
  }

  if (rows.length === 0) {
    return NextResponse.json({
      import_id: importData.id,
      imported_yield_rows: 0,
      matched_yield_rows: 0,
      inferred_tna: null,
      months_updated: [],
    })
  }

  const rateTna = account.daily_yield_rate ?? null
  const capAmount = account.daily_yield_cap_amount ?? null
  const dailyEntries: YieldDailyEntryInsert[] = rows.map((row) => {
    const baseBeforeCredit = row.statementBalance - row.amount
    const expectedAmount = rateTna
      ? calculateDailyYieldAmount({
          balance: baseBeforeCredit,
          rateTna,
          capAmount,
        })
      : null

    return {
      user_id: user.id,
      account_id: account.id,
      date: row.date,
      currency: 'ARS',
      expected_amount: expectedAmount,
      expected_rate_tna: rateTna,
      expected_cap_amount: capAmount,
      expected_base_balance: baseBeforeCredit,
      actual_amount: row.amount,
      actual_concept: row.concept,
      actual_statement_balance: row.statementBalance,
      actual_source: 'statement_csv',
      status: reconcileYieldEntry({ expectedAmount, actualAmount: row.amount }),
    }
  })

  const { data: upsertedEntries, error: upsertError } = await supabase
    .from('yield_daily_entries')
    .upsert(dailyEntries, { onConflict: 'account_id,date', ignoreDuplicates: false })
    .select('id, date, status')

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  const entryIdByDate = new Map((upsertedEntries ?? []).map((entry) => [entry.date, entry.id]))
  const { error: rowsError } = await supabase.from('statement_import_rows').insert(
    rows.map((row) => ({
      import_id: importData.id,
      user_id: user.id,
      account_id: account.id,
      date: row.date,
      comprobante: row.comprobante,
      concept: row.concept,
      amount: row.amount,
      balance: row.statementBalance,
      raw: row,
      matched_yield_entry_id: entryIdByDate.get(row.date) ?? null,
    })),
  )

  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 })

  const statuses = upsertedEntries ?? []
  const matchedCount = statuses.filter((entry) => entry.status === 'matched').length

  const months = [...new Set(rows.map((row) => row.date.substring(0, 7)))]

  await supabase
    .from('statement_imports')
    .update({ matched_yield_count: matchedCount })
    .eq('id', importData.id)
    .eq('user_id', user.id)

  const inferredTna = capAmount ? inferTnaFromDailyAmount({ dailyAmount: rows[0]?.amount ?? 0, capAmount }) : null

  return NextResponse.json({
    import_id: importData.id,
    imported_yield_rows: rows.length,
    matched_yield_rows: matchedCount,
    inferred_tna: inferredTna,
    months_updated: months,
  })
}
