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
  const command = async text => (await exec('docker',['exec','-i',name,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-t','-A','-c',text])).stdout
  try {
    let ready = false
    for (let i=0;i<80;i++) { try { await command('select 1');ready=true;break } catch { await new Promise(resolve=>setTimeout(resolve,250)) } }
    if (!ready) throw Error('PostgreSQL startup timeout')
    const literal=value=>value===null?'null':typeof value==='boolean'?String(value):typeof value==='number'?String(value):`'${String(value).replaceAll("'","''")}'`
    return {
      supportsConcurrentClients:true,
      exec:command,
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
