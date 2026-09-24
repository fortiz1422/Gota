#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const root = new URL('..', import.meta.url).pathname
const reviewSql = readFileSync(`${root}docs/supabase-mercadopago-movement-reviews.sql`, 'utf8')
const cardSql = readFileSync(`${root}docs/supabase-mercadopago-card-confirmation.sql`, 'utf8')
const id = `gota-mp-card-${process.pid}-${Date.now()}`
const sql = (text, role='postgres') => execFileSync('docker',['exec','-i',id,'psql','-v','ON_ERROR_STOP=1','-U',role,'-d','postgres'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']})
const user='00000000-0000-0000-0000-000000000001', other='00000000-0000-0000-0000-000000000002'
const conn='10000000-0000-0000-0000-000000000001', otherConn='10000000-0000-0000-0000-000000000002'
const card='20000000-0000-0000-0000-000000000001', foreignCard='20000000-0000-0000-0000-000000000002', archivedCard='20000000-0000-0000-0000-000000000003', secondCard='20000000-0000-0000-0000-000000000004', adjustedCard='20000000-0000-0000-0000-000000000005', monthEndCard='20000000-0000-0000-0000-000000000006', futureAdjustedCard='20000000-0000-0000-0000-000000000007'
const raw1='30000000-0000-0000-0000-000000000001', raw2='30000000-0000-0000-0000-000000000002', rawBad='30000000-0000-0000-0000-000000000003', rawNov='30000000-0000-0000-0000-000000000004', rawAdjusted='30000000-0000-0000-0000-000000000005', rawAfterAdjusted='30000000-0000-0000-0000-000000000006', rawMonthEnd='30000000-0000-0000-0000-000000000007', rawFutureAdjusted='30000000-0000-0000-0000-000000000008'
const fp1='a'.repeat(64), fp2='b'.repeat(64), ih='c'.repeat(64), seen='2026-09-23T10:00:00Z'
const q=s=>s.replaceAll("'","''")
const payload=(date,amount,method='credit_card',installments=1)=>JSON.stringify({id:date,status:'approved',operation_type:'regular_payment',payer_id:'42',transaction_amount:amount,currency_id:'ARS',date_created:`${date}T12:00:00Z`,payment_type_id:method,installments})
const obs=(raw,key,seenAt=seen)=>JSON.stringify([{id:raw,source:'payments_search',native_key:key,last_seen_at:seenAt}])
const call=(opts={})=>`select public.confirm_mercadopago_card_expense('${opts.user??user}','${opts.connection??conn}','${opts.candidate??'boundary-before'}','${opts.fp??fp1}','${opts.ih??ih}','${q(opts.obs??obs(raw1,'pay-1'))}'::jsonb,${opts.amount??800},'ARS','${opts.date??'2026-09-15'}','comida','${opts.description??'Compra MP'}',false,'${opts.card??card}',${opts.installments??1});`
const fail=text=>{try{sql(text,'service_role');throw Error('Expected SQL failure')}catch(e){if(e.message==='Expected SQL failure')throw e}}
const wait=()=>{for(let i=0;i<80;i++){try{if(sql('select 1').includes('1'))return}catch{} Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250)}throw Error('PostgreSQL readiness timeout')}
try {
 execFileSync('docker',['run','--name',id,'-e','POSTGRES_PASSWORD=test','-e','POSTGRES_HOST_AUTH_METHOD=trust','-d','postgres:16-alpine'],{encoding:'utf8'}); wait()
 sql(`create extension pgcrypto; create role anon login; create role authenticated login; create role service_role login; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${user}'),('${other}');
 create table public.mercadopago_connections(id uuid primary key,user_id uuid not null references auth.users(id),provider text not null,status text not null,provider_user_id text);
 insert into public.mercadopago_connections values('${conn}','${user}','mercadopago','connected','42'),('${otherConn}','${other}','mercadopago','connected','99');
 create table public.mercadopago_raw_observations(id uuid primary key,user_id uuid not null references auth.users(id),connection_id uuid not null references public.mercadopago_connections(id),source text not null,native_key text not null,payload jsonb not null,first_seen_at timestamptz not null,last_seen_at timestamptz not null);
 create table public.accounts(id uuid primary key,user_id uuid not null references auth.users(id),name text not null,type text not null,archived boolean not null default false);
 create table public.cards(id uuid primary key,user_id uuid not null references auth.users(id),name text not null,closing_day integer,due_day integer not null default 10,archived boolean not null default false);
 create table public.card_cycles(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),card_id uuid not null references public.cards(id),period_month date not null,closing_date date not null,due_date date not null,status text not null,unique(card_id,period_month));
 create table public.expenses(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),amount numeric not null,currency text not null,category text not null,description text not null,is_want boolean not null,payment_method text not null,account_id uuid,card_id uuid references public.cards(id),card_cycle_id uuid references public.card_cycles(id),date timestamptz not null);
 insert into public.accounts values('40000000-0000-0000-0000-000000000001','${user}','Caja','cash',false);
 insert into public.cards values('${card}','${user}','Visa',15,10,false),('${foreignCard}','${other}','Ajena',15,10,false),('${archivedCard}','${user}','Archivada',15,10,true),('${secondCard}','${user}','Master',20,10,false),('${adjustedCard}','${user}','Cierre ajustado',15,10,false),('${monthEndCard}','${user}','Fin de mes',31,31,false),('${futureAdjustedCard}','${user}','Cierre marzo existente',10,10,false);
 insert into public.mercadopago_raw_observations values
 ('${raw1}','${user}','${conn}','payments_search','pay-1','${payload('2026-09-15',800)}','${seen}','${seen}'),
 ('${raw2}','${user}','${conn}','payments_search','pay-2','${payload('2026-09-16',900)}','${seen}','${seen}'),
 ('${rawBad}','${user}','${conn}','payments_search','pay-bad','${payload('2026-09-17',1000,'debit_card')}','${seen}','${seen}'),
 ('${rawNov}','${user}','${conn}','payments_search','pay-nov','${payload('2026-11-18',1111)}','${seen}','${seen}'),
 ('${rawAdjusted}','${user}','${conn}','payments_search','pay-adjusted','${payload('2026-09-18',1200)}','${seen}','${seen}'),
 ('${rawAfterAdjusted}','${user}','${conn}','payments_search','pay-after-adjusted','${payload('2026-09-21',1300)}','${seen}','${seen}'),
 ('${rawMonthEnd}','${user}','${conn}','payments_search','pay-month-end','${payload('2026-02-15',1400)}','${seen}','${seen}'),
 ('${rawFutureAdjusted}','${user}','${conn}','payments_search','pay-future-adjusted','${payload('2026-02-15',1450)}','${seen}','${seen}');
  insert into public.card_cycles(user_id,card_id,period_month,closing_date,due_date,status) values('${user}','${adjustedCard}','2026-09-01','2026-09-20','2026-10-10','open'),('${user}','${futureAdjustedCard}','2026-03-01','2026-03-31','2026-04-10','open');
 grant usage on schema public to service_role; grant all on all tables in schema public to service_role; grant usage on schema auth to service_role; grant select on all tables in schema auth to service_role;`)
 sql(reviewSql); sql(cardSql); sql(cardSql)
 const before=sql(call(),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]; if(!before) throw Error('first confirmation did not return expense UUID')
 const replay=sql(call(),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]; if(replay!==before) throw Error('replay returned a different expense')
 const after=sql(call({candidate:'boundary-after',fp:fp2,obs:obs(raw2,'pay-2'),amount:900,date:'2026-09-16'}),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]; if(!after) throw Error('post-close purchase failed')
 if(!sql(`select count(*) from public.card_cycles where card_id='${card}'`).includes('2')) throw Error('expected two card cycles')
 if(!sql(`select period_month::text from public.expenses e join public.card_cycles c on c.id=e.card_cycle_id where e.id='${before}'`).includes('2026-09-01')) throw Error('closing-day expense assigned to wrong cycle')
 if(!sql(`select period_month::text from public.expenses e join public.card_cycles c on c.id=e.card_cycle_id where e.id='${after}'`).includes('2026-10-01')) throw Error('post-close expense assigned to wrong cycle')
 const adjustedOpts={candidate:'adjusted-close-on',fp:'9'.repeat(64),obs:obs(rawAdjusted,'pay-adjusted'),amount:1200,date:'2026-09-18',card:adjustedCard}
 const adjustedExpense=sql(call(adjustedOpts),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]; if(!adjustedExpense) throw Error('adjusted-close purchase failed')
 const adjustedReplay=sql(call(adjustedOpts),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]; if(adjustedReplay!==adjustedExpense) throw Error('adjusted-close replay changed expense')
 if(!sql(`select period_month::text from public.expenses e join public.card_cycles c on c.id=e.card_cycle_id where e.id='${adjustedExpense}'`).includes('2026-09-01')) throw Error('date inside adjusted cycle assigned outside September')
 if(!sql(`select closing_date::text from public.card_cycles where card_id='${adjustedCard}' and period_month='2026-09-01'`).includes('2026-09-20')) throw Error('existing adjusted closing date was overwritten')
 const afterAdjusted=sql(call({candidate:'adjusted-close-after',fp:'6'.repeat(64),obs:obs(rawAfterAdjusted,'pay-after-adjusted'),amount:1300,date:'2026-09-21',card:adjustedCard}),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]; if(!afterAdjusted) throw Error('after-adjusted-close purchase failed')
 if(!sql(`select period_month::text from public.expenses e join public.card_cycles c on c.id=e.card_cycle_id where e.id='${afterAdjusted}'`).includes('2026-10-01')) throw Error('date after adjusted close not assigned October')
 const monthEndExpense=sql(call({candidate:'month-end-clamped',fp:'7'.repeat(64),obs:obs(rawMonthEnd,'pay-month-end'),amount:1400,date:'2026-02-15',card:monthEndCard}),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]; if(!monthEndExpense) throw Error('month-end purchase failed')
 const monthEndCycle=sql(`select closing_date::text||'|'||due_date::text from public.card_cycles where card_id='${monthEndCard}' and period_month='2026-02-01'`)
 if(!monthEndCycle.includes('2026-02-28|2026-03-28')) throw Error(`month-end close/due day was not clamped correctly: ${monthEndCycle}`)
 const futureAdjustedExpense=sql(call({candidate:'future-cycle-existing',fp:'8'.repeat(64),obs:obs(rawFutureAdjusted,'pay-future-adjusted'),amount:1450,date:'2026-02-15',card:futureAdjustedCard}),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]; if(!futureAdjustedExpense) throw Error('future adjusted cycle purchase failed')
 if(!sql(`select period_month::text from public.expenses e join public.card_cycles c on c.id=e.card_cycle_id where e.id='${futureAdjustedExpense}'`).includes('2026-03-01')) throw Error('existing March cycle did not use prior nominal Jan closing boundary')
 if(!sql(`select count(*) from public.card_cycles where card_id='${futureAdjustedCard}' and period_month='2026-03-01' and closing_date='2026-03-31'`).includes('1')) throw Error('future existing closing date was changed')
 fail(call({candidate:'foreign-card',fp:'d'.repeat(64),card:foreignCard})); fail(call({candidate:'archived-card',fp:'e'.repeat(64),card:archivedCard})); fail(call({candidate:'installments',fp:'f'.repeat(64),installments:2}))
 fail(call({candidate:'boundary-before',card:secondCard}))
 fail(call({candidate:'debit-card',fp:'1'.repeat(64),obs:obs(rawBad,'pay-bad'),amount:1000,date:'2026-09-17'})); fail(call({candidate:'changed-evidence',fp:'2'.repeat(64),obs:obs(raw2,'different-native'),amount:900,date:'2026-09-16'})); fail(call({user:other,connection:conn,candidate:'foreign-tenant',fp:'3'.repeat(64)}))
 fail(call({candidate:'balance-evidence',fp:'4'.repeat(64),obs:JSON.stringify([{id:raw1,source:'account_settlement_report',native_key:'pay-1',last_seen_at:seen}])}))
 sql(`create function public.reject_mp_card_late() returns trigger language plpgsql as $$ begin if new.description='rollback' then raise exception 'late expense failure'; end if; return new; end $$; create trigger reject_mp_card_late before insert on public.expenses for each row execute function public.reject_mp_card_late();`)
 fail(call({candidate:'late-rollback',fp:'8'.repeat(64),obs:obs(rawNov,'pay-nov'),amount:1111,date:'2026-11-18',description:'rollback'}))
 if(!sql(`select count(*) from public.card_cycles where card_id='${card}' and period_month='2026-11-01'`).includes('0')) throw Error('cycle survived failed expense transaction')
 if(!sql(`select count(*) from public.mercadopago_movement_reviews where candidate_id='late-rollback'`).includes('0')) throw Error('review survived failed expense transaction')
 if(!sql(`select count(*) from public.expenses where payment_method='CREDIT' and card_id='${card}'`).includes('2')) throw Error('expected exactly two CREDIT expenses')
 const race=await Promise.all([1,2].map(()=>new Promise((resolve,reject)=>{const p=spawn('docker',['exec','-i',id,'psql','-v','ON_ERROR_STOP=1','-U','service_role','-d','postgres']);let out='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>out+=x);p.on('close',c=>c?reject(Error(out)):resolve(out));p.stdin.end(call({candidate:'race-card',fp:'5'.repeat(64)}))})))
 const ids=race.map(out=>out.match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]); if(!ids[0]||ids[0]!==ids[1]) throw Error(`race replay mismatch ${ids}`)
 if(!sql(`select count(*) from public.mercadopago_movement_reviews where candidate_id='boundary-before'`).includes('1')) throw Error('replay review missing')
 const refreshed='2026-09-24T10:00:00Z'
 sql(`update public.mercadopago_raw_observations set last_seen_at='${refreshed}' where id='${raw1}'`)
 const metadataReplay=sql(call({obs:obs(raw1,'pay-1',refreshed)}),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]
 if(metadataReplay!==before) throw Error('metadata-only replay returned another expense')
 fail(call({fp:'d'.repeat(64)})); fail(call({ih:'e'.repeat(64)}))
 const replayChecks=[
  [`update public.mercadopago_movement_reviews set canonical_currency='USD' where candidate_id='boundary-before'`,`update public.mercadopago_movement_reviews set canonical_currency='ARS' where candidate_id='boundary-before'`],
  [`update public.mercadopago_movement_reviews set canonical_amount=801 where candidate_id='boundary-before'`,`update public.mercadopago_movement_reviews set canonical_amount=800 where candidate_id='boundary-before'`],
  [`update public.mercadopago_movement_reviews set canonical_date='2026-09-16' where candidate_id='boundary-before'`,`update public.mercadopago_movement_reviews set canonical_date='2026-09-15' where candidate_id='boundary-before'`],
  [`update public.mercadopago_movement_reviews set canonical_category='Transporte' where candidate_id='boundary-before'`,`update public.mercadopago_movement_reviews set canonical_category='comida' where candidate_id='boundary-before'`],
  [`update public.mercadopago_movement_reviews set canonical_description='Otra compra' where candidate_id='boundary-before'`,`update public.mercadopago_movement_reviews set canonical_description='Compra MP' where candidate_id='boundary-before'`],
  [`update public.mercadopago_movement_reviews set is_want=true where candidate_id='boundary-before'`,`update public.mercadopago_movement_reviews set is_want=false where candidate_id='boundary-before'`],
  [`update public.mercadopago_movement_reviews set card_id='${secondCard}' where candidate_id='boundary-before'`,`update public.mercadopago_movement_reviews set card_id='${card}' where candidate_id='boundary-before'`],
  [`update public.mercadopago_movement_reviews set canonical_semantics='{"classification":"wrong"}'::jsonb where candidate_id='boundary-before'`,`update public.mercadopago_movement_reviews set canonical_semantics='{"classification":"human_confirmed_expense","provider_effect":"credit_card_purchase"}'::jsonb where candidate_id='boundary-before'`],
  [`update public.mercadopago_movement_reviews set evidence_kind='balance_debit_known' where candidate_id='boundary-before'`,`update public.mercadopago_movement_reviews set evidence_kind='credit_card_purchase' where candidate_id='boundary-before'`],
  [`update public.expenses set amount=801 where id='${before}'`,`update public.expenses set amount=800 where id='${before}'`],
  [`update public.expenses set currency='USD' where id='${before}'`,`update public.expenses set currency='ARS' where id='${before}'`],
  [`update public.expenses set category='Transporte' where id='${before}'`,`update public.expenses set category='comida' where id='${before}'`],
  [`update public.expenses set description='Otra compra' where id='${before}'`,`update public.expenses set description='Compra MP' where id='${before}'`],
  [`update public.expenses set is_want=true where id='${before}'`,`update public.expenses set is_want=false where id='${before}'`],
  [`update public.expenses set date='2026-09-16' where id='${before}'`,`update public.expenses set date='2026-09-15' where id='${before}'`],
  [`update public.expenses set card_id='${secondCard}' where id='${before}'`,`update public.expenses set card_id='${card}' where id='${before}'`],
  [`update public.expenses set account_id='40000000-0000-0000-0000-000000000001' where id='${before}'`,`update public.expenses set account_id=null where id='${before}'`],
  [`update public.expenses set card_cycle_id=null where id='${before}'`,`update public.expenses set card_cycle_id=(select card_cycle_id from public.mercadopago_movement_reviews where candidate_id='boundary-before') where id='${before}'`],
  [`update public.expenses set payment_method='DEBIT' where id='${before}'`,`update public.expenses set payment_method='CREDIT' where id='${before}'`],
 ]
 for(const [tamper,restore] of replayChecks){sql(tamper);fail(call());sql(restore)}
 if(!sql(`select count(*) from public.mercadopago_movement_reviews where candidate_id='race-card'`).includes('1')) throw Error('race duplicated review')
 if(!sql(`select count(*) from public.expenses where payment_method='CREDIT' and card_id='${card}'`).includes('3')) throw Error('race duplicated expense')
 try{sql(call({candidate:'acl-test',fp:'7'.repeat(64)}),'authenticated');throw Error('authenticated RPC unexpectedly succeeded')}catch(e){if(e.message==='authenticated RPC unexpectedly succeeded')throw e}
 console.log('PASS PostgreSQL: UI-independent card confirmation; adjusted historical cycle, post-close, non-overwrite and replay; strict replay invariants; rollback; race; ownership/evidence/ACL')
} finally {try{execFileSync('docker',['rm','-f',id],{stdio:'ignore'})}catch{}}
