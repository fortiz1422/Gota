import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
const exec = promisify(execFile)
/** A disposable database only. Never accepts a remote database URL. */
export async function createTestDatabase(argument) {
  if (argument !== '--docker') {
    const { PGlite } = await import(pathToFileURL(argument).href)
    const db = new PGlite()
    db.supportsConcurrentClients = false
    return db
  }
  const name = `gota-mp-isolated-${process.pid}-${Date.now()}`
  execFileSync('docker', ['run','--name',name,'-e','POSTGRES_PASSWORD=test','-e','POSTGRES_HOST_AUTH_METHOD=trust','-d','postgres:16-alpine'],{stdio:'ignore'})
  let role = ''
  const command = async text => (await exec('docker',['exec','-i',name,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-q','-t','-A','-c',`${role ? `set role ${role};` : ''}${text}`])).stdout
  try {
    let ready = false
    for (let i=0;i<80;i++) { try { await command('select 1');ready=true;break } catch { await new Promise(resolve=>setTimeout(resolve,250)) } }
    if (!ready) throw Error('PostgreSQL startup timeout')
    const literal=value=>value===null?'null':typeof value==='boolean'?String(value):typeof value==='number'?String(value):`'${String(value).replaceAll("'","''")}'`
    return {
      supportsConcurrentClients:true,
      exec:async text=>{
        if (/^set role authenticated$/i.test(text.trim())) {role='authenticated';return ''}
        if (/^reset role$/i.test(text.trim())) {role='';return ''}
        return command(text)
      },
      query:async(text,params=[])=>{
        const sql=text.replace(/\$(\d+)/g,(_,i)=>literal(params[Number(i)-1])).replace(/;\s*$/,'')
        if (!/^\s*select\b/i.test(sql)) {await command(sql);return {rows:[]}}
        const output=await command(`select coalesce(json_agg(result),'[]') from (${sql}) result`)
        return {rows:JSON.parse(output.trim())}
      },
      close:async()=>{await exec('docker',['rm','-f',name])},
    }
  } catch(error) {execFileSync('docker',['rm','-f',name],{stdio:'ignore'});throw error}
}

/** Relevant constraints observed via metadata-only audit on 2026-10-03.
 * This deliberately does not claim to reproduce the complete deployed schema. */
export async function applyObservedLedgerConstraints(db) {
  await db.exec(`
    alter table expenses add constraint observed_amount check (amount >= 1);
    alter table expenses add constraint observed_currency check (currency in ('ARS','USD'));
    alter table expenses add constraint observed_description check (length(description) <= 100);
    alter table expenses add constraint observed_method check (payment_method in ('CASH','DEBIT','TRANSFER','CREDIT'));
    alter table expenses add constraint observed_card_required check ((payment_method='CREDIT' and card_id is not null) or (category='Pago de Tarjetas' and card_id is not null) or (payment_method<>'CREDIT' and category<>'Pago de Tarjetas'));
    alter table expenses add constraint observed_no_credit_payment check (category<>'Pago de Tarjetas' or payment_method<>'CREDIT');
    alter table expenses add foreign key (account_id) references accounts(id) on delete set null;
    alter table cards add constraint observed_closing check (closing_day between 1 and 31);
    alter table cards add constraint observed_due check (due_day between 1 and 31);
    alter table card_cycles add constraint observed_status check (status in ('open','closed','paid'));
  `)
}
