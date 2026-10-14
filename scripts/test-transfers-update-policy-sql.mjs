// Disposable database only; no personal data or remote URL.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const db = new PGlite()
const owner='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002'
const from='10000000-0000-4000-8000-000000000001',to='10000000-0000-4000-8000-000000000002',foreign='10000000-0000-4000-8000-000000000003',transfer='20000000-0000-4000-8000-000000000001'
try {
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    create table accounts(id uuid primary key,user_id uuid);
    create table transfers(id uuid primary key,user_id uuid,from_account_id uuid,to_account_id uuid,note text);
    grant select,update on transfers to authenticated,anon;grant select on accounts to authenticated,anon;
    alter table accounts enable row level security;alter table transfers enable row level security;
    create policy accounts_select on accounts for select using(auth.uid()=user_id);
    create policy transfers_select on transfers for select using(auth.uid()=user_id);
    insert into accounts values('${from}','${owner}'),('${to}','${owner}'),('${foreign}','${other}');
    insert into transfers values('${transfer}','${owner}','${from}','${to}','Original');
    set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`)
  assert.equal((await db.query("update transfers set note='Antes' where id=$1 returning id",[transfer])).rows.length,0,'reproduces missing UPDATE policy')
  await db.exec('reset role')
  await db.exec(readFileSync(new URL('../docs/supabase-transfers-update-policy.sql',import.meta.url),'utf8'))
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`)
  assert.equal((await db.query("update transfers set note='Editada' where id=$1 returning id",[transfer])).rows.length,1)
  await assert.rejects(db.query('update transfers set user_id=$1 where id=$2',[other,transfer]))
  await assert.rejects(db.query('update transfers set to_account_id=$1 where id=$2',[foreign,transfer]))
  await assert.rejects(db.query('update transfers set from_account_id=$1 where id=$2',[foreign,transfer]))
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`)
  assert.equal((await db.query("update transfers set note='Ajena' where id=$1 returning id",[transfer])).rows.length,0)
  await db.exec("reset role;set role anon;select set_config('request.jwt.claim.sub','',false)")
  assert.equal((await db.query("update transfers set note='Anónima' where id=$1 returning id",[transfer])).rows.length,0)
  console.log('PASS: reproduced zero-row edit; owner can edit; other owner, owner reassignment, foreign accounts and signed-out edits blocked.')
} finally { await db.close() }
