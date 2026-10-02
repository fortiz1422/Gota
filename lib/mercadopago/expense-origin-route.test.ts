import { beforeEach,describe,expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({user:vi.fn(),admin:vi.fn(),from:vi.fn(),read:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:mocks.user}})}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:mocks.admin}))
import { GET } from '@/app/api/expenses/[id]/provider-origin/route'
const id='00000000-0000-4000-8000-000000000001'
const get=()=>GET(new Request('https://gota.test'),{params:Promise.resolve({id})})
beforeEach(()=>{
 vi.clearAllMocks();mocks.user.mockResolvedValue({data:{user:{id:'owner'}}})
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:mocks.read}
 mocks.from.mockReturnValue(query);mocks.admin.mockReturnValue({from:mocks.from})
})
describe('owned expense provenance',()=>{
 it('requires authentication before administrative reads',async()=>{
  mocks.user.mockResolvedValue({data:{user:null}});expect((await get()).status).toBe(401);expect(mocks.admin).not.toHaveBeenCalled()
 })
 it('does not search provider audits for a foreign or missing expense',async()=>{
  mocks.read.mockResolvedValue({data:null,error:null});expect((await get()).status).toBe(404);expect(mocks.from).toHaveBeenCalledTimes(1)
 })
 it('returns only a human-readable automatic origin, without evidence or IDs',async()=>{
  mocks.read.mockResolvedValueOnce({data:{id,installment_group_id:null},error:null}).mockResolvedValueOnce({data:{canonical_semantics:{classification:'automatic_expense'}},error:null})
  expect(await (await get()).json()).toEqual({origin:'mercadopago',decision:'auto'})
  expect(mocks.from.mock.results[0].value.eq).toHaveBeenCalledWith('user_id','owner')
 })
 it('finds provenance through the first row of an owned installment group',async()=>{
  mocks.read.mockResolvedValueOnce({data:{id,installment_group_id:'group'},error:null}).mockResolvedValueOnce({data:{id:'first'},error:null}).mockResolvedValueOnce({data:{canonical_semantics:{classification:'human_confirmed_expense'}},error:null})
  expect(await (await get()).json()).toEqual({origin:'mercadopago',decision:'human'})
  expect(mocks.from.mock.results[0].value.eq).toHaveBeenCalledWith('expense_id','first')
 })
})
