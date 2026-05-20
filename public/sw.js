const CACHE_VERSION = 'gota-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const SHARE_TARGET_CACHE = `${CACHE_VERSION}-share-target`
const SHARE_TARGET_PREFIX = '/__share-target/'

function buildShareTargetCacheUrl(shareTargetId) {
  return `${self.location.origin}${SHARE_TARGET_PREFIX}${shareTargetId}`
}

async function clearCachedSharedReceipts(cache) {
  const keys = await cache.keys()
  await Promise.all(
    keys
      .filter((request) => new URL(request.url).pathname.startsWith(SHARE_TARGET_PREFIX))
      .map((request) => cache.delete(request))
  )
}

async function handleShareTarget(request) {
  try {
    const formData = await request.formData()
    const sharedFile = formData.get('receipt')

    if (!(sharedFile instanceof File)) {
      console.warn('[share-target] No file found in shared payload')
      return Response.redirect(`${self.location.origin}/share-target`, 303)
    }

    const shareTargetId =
      typeof self.crypto?.randomUUID === 'function'
        ? self.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const createdAt = new Date().toISOString()
    const cache = await caches.open(SHARE_TARGET_CACHE)

    await clearCachedSharedReceipts(cache)

    await cache.put(
      buildShareTargetCacheUrl(shareTargetId),
      new Response(sharedFile, {
        headers: {
          'content-type': sharedFile.type || 'application/octet-stream',
          'cache-control': 'no-store',
          'x-gota-share-created-at': createdAt,
          'x-gota-share-filename': sharedFile.name || 'captura-compartida',
        },
      })
    )

    console.info('[share-target] Shared file stored', {
      shareTargetId,
      name: sharedFile.name,
      type: sharedFile.type,
      size: sharedFile.size,
    })

    const redirectUrl = new URL('/share-target', self.location.origin)
    redirectUrl.searchParams.set('shareTargetId', shareTargetId)
    return Response.redirect(redirectUrl.toString(), 303)
  } catch (error) {
    console.error('[share-target] Failed to handle shared payload', error)
    return Response.redirect(`${self.location.origin}/share-target`, 303)
  }
}

// Cache Next.js static assets on install
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Delete old caches
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== SHARE_TARGET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method === 'POST' && url.origin === self.location.origin && url.pathname === '/share-target') {
    event.respondWith(handleShareTarget(request))
    return
  }

  // Never intercept: API calls, auth, or cross-origin requests
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/')
  ) {
    return
  }

  // Cache-first for Next.js static assets (content-hashed, safe to cache permanently)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached
          return fetch(request).then((response) => {
            cache.put(request, response.clone())
            return response
          })
        })
      )
    )
    return
  }

  // Cache-first for public static assets (icons, manifest, etc.)
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|json|woff2?)$/)
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
        })
      )
    )
    return
  }

  // Network-first for HTML navigations (always fresh, fallback to cache)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }
})
