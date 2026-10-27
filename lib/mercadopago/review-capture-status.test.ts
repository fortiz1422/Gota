import { describe, expect, it } from 'vitest'
import {
  formatMercadoPagoCaptureRelativeAge,
  getMercadoPagoReviewCapturePresentation,
} from './review-capture-status'

describe('Mercado Pago review capture presentation', () => {
  const now = new Date('2026-10-27T15:00:00.000Z')

  it('formats relative ages in rioplatense copy', () => {
    expect(
      formatMercadoPagoCaptureRelativeAge('2026-10-27T14:59:30.000Z', now),
    ).toBe('hace un momento')
    expect(
      formatMercadoPagoCaptureRelativeAge('2026-10-27T14:30:00.000Z', now),
    ).toBe('hace 30 min')
    expect(
      formatMercadoPagoCaptureRelativeAge('2026-10-27T12:00:00.000Z', now),
    ).toBe('hace 3 h')
    expect(
      formatMercadoPagoCaptureRelativeAge('2026-10-26T15:00:00.000Z', now),
    ).toBe('ayer')
  })

  it('shows syncing while the initial import is running', () => {
    expect(
      getMercadoPagoReviewCapturePresentation(
        { initialImportStatus: 'running', lastUpdateAt: '2026-10-27T10:00:00.000Z' },
        now,
      ),
    ).toMatchObject({ tone: 'status', line: 'Sincronizando…', showSettingsLink: true })
  })

  it('shows last capture when sync succeeded', () => {
    expect(
      getMercadoPagoReviewCapturePresentation(
        {
          initialImportStatus: 'completed',
          lastUpdateAt: '2026-10-27T14:30:00.000Z',
          lastAttemptAt: '2026-10-27T14:30:00.000Z',
          backgroundSyncEnabled: true,
        },
        now,
      ),
    ).toEqual({
      tone: 'neutral',
      line: 'Última captura: hace 30 min',
      detail: undefined,
      showSettingsLink: false,
    })
  })

  it('does not warn while a capture run is in progress (attempt just after last success)', () => {
    expect(
      getMercadoPagoReviewCapturePresentation(
        {
          initialImportStatus: 'completed',
          lastUpdateAt: '2026-10-27T14:59:00.000Z',
          lastAttemptAt: '2026-10-27T15:00:00.000Z',
          backgroundSyncEnabled: true,
        },
        now,
      ),
    ).toMatchObject({ tone: 'neutral', line: 'Última captura: hace 1 min' })
  })

  it('warns when the latest attempt stayed ahead of success beyond the stale margin', () => {
    expect(
      getMercadoPagoReviewCapturePresentation(
        {
          initialImportStatus: 'completed',
          lastUpdateAt: '2026-10-27T10:00:00.000Z',
          lastAttemptAt: '2026-10-27T10:45:00.000Z',
        },
        now,
      ),
    ).toMatchObject({ tone: 'warning', line: 'La última actualización no se completó' })
  })

  it('warns when there is no successful capture and the last attempt is stale', () => {
    expect(
      getMercadoPagoReviewCapturePresentation(
        {
          initialImportStatus: 'completed',
          lastUpdateAt: null,
          lastAttemptAt: '2026-10-27T14:00:00.000Z',
        },
        now,
      ),
    ).toMatchObject({ tone: 'warning', line: 'La última actualización no se completó' })
  })

  it('surfaces paused background sync with a settings link', () => {
    expect(
      getMercadoPagoReviewCapturePresentation(
        {
          initialImportStatus: 'completed',
          lastUpdateAt: '2026-10-27T14:00:00.000Z',
          backgroundSyncEnabled: false,
        },
        now,
      ),
    ).toMatchObject({
      line: 'Última captura: hace 1 h',
      showSettingsLink: true,
      detail: expect.stringContaining('pausada'),
    })
  })
})
