import { afterEach, describe, expect, it, vi } from 'vitest'

const useQuery = vi.hoisted(() => vi.fn((options: unknown) => options))

vi.mock('@tanstack/react-query', () => ({ useQuery }))

import { signalsCenterQueryKey, useSignalsCenter } from '@/hooks/useSignalsCenter'

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('useSignalsCenter', () => {
  it('declara una query lazy con la política de frescura y reintento requerida', () => {
    const result = useSignalsCenter({ enabled: false, currency: 'ARS' }) as unknown as {
      queryFn: () => Promise<unknown>
    }

    expect(useQuery).toHaveBeenCalledOnce()
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['intelligence', 'signals', 'ARS'],
        enabled: false,
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
        queryFn: expect.any(Function),
      }),
    )
    expect(result.queryFn).toEqual(expect.any(Function))
  })

  it('separa la caché por moneda sin enviar la moneda al endpoint actual', async () => {
    const responseModel = { signals: [], coverage: [] }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(responseModel), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const query = useSignalsCenter({ enabled: true, currency: 'USD' }) as unknown as {
      queryFn: () => Promise<unknown>
    }

    await expect(query.queryFn()).resolves.toEqual(responseModel)
    expect(fetchMock).toHaveBeenCalledWith('/api/intelligence/signals')
    expect(signalsCenterQueryKey()).toEqual(['intelligence', 'signals', 'source'])
  })

  it('propaga el mensaje neutral de error de la API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'No pude cargar tus señales ahora.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const query = useSignalsCenter({ enabled: true }) as unknown as {
      queryFn: () => Promise<unknown>
    }

    await expect(query.queryFn()).rejects.toThrow('No pude cargar tus señales ahora.')
  })
})
