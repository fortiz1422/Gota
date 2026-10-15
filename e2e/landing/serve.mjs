import { createServer } from 'node:http'
import { readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const publicRoot = join(root, 'public')
const { renderLandingHtml } = await import(
  pathToFileURL(join(root, 'app/landing/render-landing.ts')).href
)
const copy = JSON.parse(
  readFileSync(join(root, 'app/landing/landing-copy.json'), 'utf8')
)
const template = readFileSync(
  join(root, 'app/landing/landing-v57.html'),
  'utf8'
)
const prodHtml = renderLandingHtml(template, copy, process.env.LANDING_CTA_URL)
const mockupHtml = readFileSync(
  join(root, 'e2e/landing/fixtures/mockup.html'),
  'utf8'
)

const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

function send(response, status, body, type) {
  response.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
  })
  response.end(body)
}

function publicFile(pathname) {
  const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const file = join(publicRoot, relative)
  if (!file.startsWith(publicRoot)) return null
  try {
    if (!statSync(file).isFile()) return null
  } catch {
    return null
  }
  return file
}

const port = Number(process.env.PORT || 4173)
const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1')
  if (url.pathname === '/health') {
    send(response, 200, 'ok', 'text/plain; charset=utf-8')
    return
  }
  if (url.pathname === '/' || url.pathname === '/landing') {
    send(response, 200, prodHtml, types['.html'])
    return
  }
  if (url.pathname === '/__mockup') {
    send(response, 200, mockupHtml, types['.html'])
    return
  }
  const file = publicFile(decodeURIComponent(url.pathname))
  if (!file) {
    send(response, 404, 'not found', 'text/plain; charset=utf-8')
    return
  }
  const type = types[extname(file)] || 'application/octet-stream'
  send(response, 200, readFileSync(file), type)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`landing e2e server http://127.0.0.1:${port}`)
})
