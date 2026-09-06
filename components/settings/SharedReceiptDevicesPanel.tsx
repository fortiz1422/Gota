'use client'

import { useCallback, useEffect, useState } from 'react'
import { CaretRight, Copy, DeviceMobile, Link as LinkIcon, Plus, Trash, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import {
  SHARED_RECEIPT_ROUTES,
  extractCreatedDevice,
  getShortcutInstallState,
  normalizeDevicesResponse,
  type SharedReceiptDevice,
} from '@/lib/shared-receipts-ui'

function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha informada'
  return new Date(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : fallback
}

export function SharedReceiptDevicesPanel({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [devices, setDevices] = useState<SharedReceiptDevice[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('Mi iPhone')
  const [saving, setSaving] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null)
  const [createdDevice, setCreatedDevice] = useState<SharedReceiptDevice | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const install = getShortcutInstallState(process.env.NEXT_PUBLIC_IOS_SHORTCUT_INSTALL_URL)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(SHARED_RECEIPT_ROUTES.devices, { cache: 'no-store' })
      if (!response.ok) throw new Error(await errorMessage(response, 'No pudimos cargar tus dispositivos.'))
      setDevices(normalizeDevicesResponse(await response.json()))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos cargar tus dispositivos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadDevices()
    if (!open) {
      setOneTimeToken(null)
      setCreatedDevice(null)
      setCopied(false)
      setError(null)
    }
  }, [open, loadDevices])

  const createDevice = async (deviceName: string): Promise<{ device: SharedReceiptDevice; token: string }> => {
    const response = await fetch(SHARED_RECEIPT_ROUTES.devices, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: deviceName.trim() }),
    })
    if (!response.ok) throw new Error(await errorMessage(response, 'No pudimos crear la credencial.'))
    return extractCreatedDevice(await response.json())
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const created = await createDevice(name)
      setDevices((current) => [created.device, ...current])
      setCreatedDevice(created.device)
      setOneTimeToken(created.token)
      setCopied(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos crear la credencial.')
    } finally {
      setSaving(false)
    }
  }

  const revoke = async (device: SharedReceiptDevice) => {
    if (!window.confirm(`¿Revocar el acceso de “${device.name}”?`)) return
    setActingId(device.id)
    setError(null)
    try {
      const response = await fetch(SHARED_RECEIPT_ROUTES.device(device.id), { method: 'DELETE' })
      if (!response.ok) throw new Error(await errorMessage(response, 'No pudimos revocar el dispositivo.'))
      setDevices((current) => current.filter((item) => item.id !== device.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos revocar el dispositivo.')
    } finally {
      setActingId(null)
    }
  }


  const copyToken = async () => {
    if (!oneTimeToken) return
    try {
      await navigator.clipboard.writeText(oneTimeToken)
      setCopied(true)
    } catch {
      setError('No pudimos copiarlo. Seleccioná el token y copialo manualmente.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact
          ? 'flex w-full items-center gap-3 px-[18px] py-3.5 text-left transition-colors hover:bg-primary/5'
          : 'flex w-full items-center gap-3 rounded-card border border-border-subtle bg-bg-secondary p-4 text-left transition-colors hover:bg-primary/5'}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <DeviceMobile size={18} weight="duotone" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">Compartir con Gota</span>
          <span className="block text-xs leading-5 text-text-tertiary">iPhone · Apple Shortcuts</span>
        </span>
        <CaretRight size={14} className="text-text-dim" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="type-label text-primary">Integraciones</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-text-primary">Compartir con Gota</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Creá una credencial para enviar comprobantes desde la hoja Compartir de tu iPhone.</p>
              {!install.available && <p className="mt-2 text-xs font-semibold text-text-tertiary">{install.label}. Podés administrar credenciales, pero todavía no instalar la plantilla.</p>}
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="p-2 text-text-tertiary"><X size={20} /></button>
          </div>

          {oneTimeToken && createdDevice && (
            <section role="status" className="rounded-card border border-warning/30 bg-warning/5 p-4">
              <p className="text-sm font-bold text-text-primary">Copiá este token ahora</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">Se muestra una sola vez. Gota no puede volver a enseñártelo y no lo guarda en este navegador.</p>
              <label className="mt-3 block text-xs font-semibold text-text-secondary" htmlFor="shortcut-token">Token de importación</label>
              <div className="mt-1 flex gap-2">
                <input id="shortcut-token" readOnly value={oneTimeToken} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-input border border-border-ocean bg-white px-3 py-2 font-mono text-xs text-text-primary" />
                <button type="button" onClick={() => void copyToken()} className="rounded-button bg-primary px-3 text-white" aria-label="Copiar token"><Copy size={17} /></button>
              </div>
              {copied && <p className="mt-2 text-xs font-semibold text-success">Token copiado.</p>}
              <p className="mt-2 text-xs text-text-tertiary">Vence: {formatDate(createdDevice.expires_at)}</p>
              {install.available ? (
                <a href={install.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-white"><LinkIcon size={15} />{install.label}</a>
              ) : (
                <p className="mt-3 rounded-input bg-bg-tertiary px-3 py-2 text-xs font-semibold text-text-secondary">{install.label}</p>
              )}
              <button type="button" onClick={() => { setOneTimeToken(null); setCreatedDevice(null); setCopied(false) }} className="mt-3 block text-xs font-semibold text-primary">Ya guardé el token</button>
            </section>
          )}

          <section>
            <h3 className="text-sm font-bold text-text-primary">Nuevo iPhone</h3>
            <div className="mt-2 flex gap-2">
              <label className="sr-only" htmlFor="device-name">Nombre del dispositivo</label>
              <input id="device-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej: iPhone personal" className="min-w-0 flex-1 rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary" />
              <button type="button" onClick={() => void handleCreate()} disabled={saving || !name.trim() || Boolean(oneTimeToken)} className="rounded-button bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} className="inline" /> {saving ? 'Creando…' : 'Crear'}</button>
            </div>
          </section>

          {error && <p role="alert" className="rounded-input bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

          <section aria-busy={loading}>
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-text-primary">Dispositivos</h3><button type="button" onClick={() => void loadDevices()} className="text-xs font-semibold text-primary">Actualizar</button></div>
            {loading ? <p className="mt-3 text-sm text-text-tertiary">Cargando…</p> : devices.length === 0 ? <p className="mt-3 text-sm text-text-tertiary">Todavía no creaste credenciales.</p> : (
              <ul className="mt-2 divide-y divide-border-subtle rounded-card border border-border-subtle">
                {devices.map((device) => <li key={device.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-sm font-semibold text-text-primary">{device.name}</p><p className="mt-1 text-xs text-text-tertiary">Creado {formatDate(device.created_at)} · vence {formatDate(device.expires_at)}</p></div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => void revoke(device)} disabled={actingId === device.id} aria-label={`Revocar ${device.name}`} className="rounded-button p-2 text-danger disabled:opacity-40"><Trash size={17} /></button>
                    </div>
                  </div>
                </li>)}
              </ul>
            )}
          </section>
        </div>
      </Modal>
    </>
  )
}
