export type SettingsConnection = { status: 'connected' | 'error' | 'expired' | 'revoked'; lastSyncAt: string | null; sources: { payments: number; reports: number } }
export function buildMercadoPagoSettingsModel(connection: SettingsConnection | null) {
  const state = !connection ? 'not_connected' : connection.status === 'connected' ? 'connected' : 'error'
  return { state, cta: state === 'connected' ? 'Sincronizar ahora' : 'Conectar Mercado Pago', lastSyncAt: connection?.lastSyncAt ?? null, sources: connection?.sources ?? { payments: 0, reports: 0 }, validationCopy: 'validación privada: nada se importó al registro financiero.' }
}
