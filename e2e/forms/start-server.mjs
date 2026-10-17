import { rmSync } from 'node:fs'
import { spawn } from 'node:child_process'

// This is generated dev cache only. A cache created in another sandbox can be unreadable.
rmSync('.next/dev/cache/turbopack', { recursive: true, force: true })
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3100'], { stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', code => process.exit(code ?? 1))
