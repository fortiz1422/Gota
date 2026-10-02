import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
const json = (body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const session=await createClient(), {data:{user}}=await session.auth.getUser()
  if (!user) return json({error:'unauthorized'},401)
  const {id}=await params
  if (!z.string().uuid().safeParse(id).success) return json({error:'not_found'},404)
  try {
    const database=createAdminClient()
    const {data:expense,error}=await database.from('expenses').select('id,installment_group_id').eq('id',id).eq('user_id',user.id).maybeSingle()
    if (error) throw Error('expense_read_failed')
    if (!expense) return json({error:'not_found'},404)
    let expenseId=expense.id
    if (expense.installment_group_id) {
      const {data:first,error:firstError}=await database.from('expenses').select('id').eq('user_id',user.id).eq('installment_group_id',expense.installment_group_id).eq('installment_number',1).maybeSingle()
      if (firstError) throw Error('group_read_failed')
      if (first) expenseId=first.id
    }
    const {data:review,error:reviewError}=await (database as unknown as SupabaseClient).from('mercadopago_movement_reviews').select('canonical_semantics').eq('user_id',user.id).eq('expense_id',expenseId).maybeSingle()
    if (reviewError) throw Error('origin_read_failed')
    if (!review) return json({origin:null})
    const classification=(review.canonical_semantics as {classification?:string})?.classification
    return json({origin:'mercadopago',decision:classification==='automatic_expense'?'auto':classification==='linked_existing'?'linked':'human'})
  } catch {return json({error:'origin_unavailable'},503)}
}
