'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CaretRight, Copy, DeviceMobile, Link as LinkIcon, Plus, Trash } from '@phosphor-icons/react'
import { ManagementSurface } from '@/components/ui/ManagementSurface'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { ConfirmationSurface } from '@/components/ui/ConfirmationSurface'
import {
  SHARED_RECEIPT_ROUTES,
  buildSharedReceiptDeviceCreatePayload,
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
  const [creating, setCreating] = useState(false)
  const [devices, setDevices] = useState<SharedReceiptDevice[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('Mi iPhone')
  const [saving, setSaving] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null)
  const [createdDevice, setCreatedDevice] = useState<SharedReceiptDevice | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taskTrigger, setTaskTrigger] = useState<HTMLElement | null>(null)
  const [confirmation, setConfirmation] = useState<
    | { kind: 'token' }
    | { kind: 'revoke'; device: SharedReceiptDevice; trigger: HTMLElement }
    | null
  >(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
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
      setCreating(false)
      setOneTimeToken(null)
      setCreatedDevice(null)
      setCopied(false)
      setTaskTrigger(null)
      setError(null)
    }
  }, [open, loadDevices])

  const beginCreate = (trigger: HTMLElement) => {
    setTaskTrigger(trigger)
    setName('Mi iPhone')
    setOneTimeToken(null)
    setCreatedDevice(null)
    setCopied(false)
    setError(null)
    setCreating(true)
  }

  const finishCredentialTask = () => {
    setCreating(false)
    setOneTimeToken(null)
    setCreatedDevice(null)
    setCopied(false)
    setTaskTrigger(null)
    setError(null)
  }

  const closeCredentialTask = () => {
    if (oneTimeToken) {
      setConfirmation({ kind: 'token' })
      return
    }
    finishCredentialTask()
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(SHARED_RECEIPT_ROUTES.devices, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSharedReceiptDeviceCreatePayload(name)),
      })
      if (!response.ok) throw new Error(await errorMessage(response, 'No pudimos crear la credencial.'))
      const created = extractCreatedDevice(await response.json())
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
    setActingId(device.id)
    setError(null)
    try {
      const response = await fetch(SHARED_RECEIPT_ROUTES.device(device.id), { method: 'DELETE' })
      if (!response.ok) throw new Error(await errorMessage(response, 'No pudimos revocar el dispositivo.'))
      setDevices((current) => current.filter((item) => item.id !== device.id))
      setConfirmation(null)
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
        ref={triggerRef}
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
          <span className="block text-sm font-semibold text-text-primary">Dispositivos</span>
          <span className="block text-xs leading-5 text-text-tertiary">Compartir con Gota · iPhone</span>
        </span>
        <CaretRight size={14} className="text-text-dim" />
      </button>

      <ManagementSurface
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        eyebrow="CONEXIONES"
        title="Dispositivos"
        description="Credenciales para enviar comprobantes desde la hoja Compartir de tu iPhone."
        action={
          <button
            type="button"
            onClick={(event) => beginCreate(event.currentTarget)}
            className="flex w-full items-center justify-center gap-2 rounded-button bg-primary py-3 text-sm font-semibold text-white"
          >
            <Plus size={16} /> Conectar iPhone
          </button>
        }
      >
        {!install.available ? <p className="mb-4 rounded-input bg-bg-tertiary px-3 py-2.5 text-xs leading-5 text-text-secondary">{install.label}. Podés crear y revocar credenciales; la plantilla todavía no está disponible.</p> : null}
        {error && !creating ? <p role="alert" className="mb-4 rounded-input bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <section aria-busy={loading}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">Conectados</h3>
            <button type="button" onClick={() => void loadDevices()} className="min-h-11 text-xs font-semibold text-primary">Actualizar</button>
          </div>
          {loading ? (
            <div className="space-y-2" aria-label="Cargando dispositivos">
              {[0, 1].map((item) => <div key={item} className="h-20 animate-pulse rounded-card bg-bg-tertiary" />)}
            </div>
          ) : devices.length === 0 ? (
            <div className="rounded-card border border-dashed border-border-strong px-5 py-8 text-center">
              <DeviceMobile size={24} className="mx-auto text-text-tertiary" />
              <p className="mt-3 text-sm font-semibold text-text-primary">No hay dispositivos conectados</p>
              <p className="mt-1 text-xs leading-5 text-text-tertiary">Creá una credencial para empezar a compartir comprobantes.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-strong bg-bg-primary">
              {devices.map((device) => (
                <li key={device.id} className="flex min-h-20 items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><DeviceMobile size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text-primary">{device.name}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-text-tertiary">Creado {formatDate(device.created_at)} · vence {formatDate(device.expires_at)}</span>
                  </span>
                  <button type="button" onClick={(event) => setConfirmation({ kind: 'revoke', device, trigger: event.currentTarget })} disabled={actingId === device.id} aria-label={`Revocar ${device.name}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-danger disabled:opacity-40"><Trash size={17} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </ManagementSurface>

      <TaskSurface
        open={creating}
        onClose={closeCredentialTask}
        appearance="compact"
        navigationTitle={oneTimeToken ? 'Token del dispositivo' : 'Conectar iPhone'}
        triggerElement={taskTrigger}
        initialFocusRef={oneTimeToken ? undefined : nameRef}
        eyebrow="DISPOSITIVOS"
        title={oneTimeToken ? 'Guardá el token' : 'Conectar iPhone'}
        description={oneTimeToken
          ? 'Se muestra una sola vez. Gota no puede volver a enseñártelo.'
          : 'Nombrá el dispositivo para reconocer y revocar su acceso cuando quieras.'}
        footer={oneTimeToken ? (
          <button type="button" onClick={closeCredentialTask} className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white">Ya guardé el token</button>
        ) : (
          <button type="button" onClick={() => void handleCreate()} disabled={saving || !name.trim()} className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creando…' : 'Crear credencial'}</button>
        )}
      >
        {error ? <p role="alert" className="mb-4 rounded-input bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
        {oneTimeToken && createdDevice ? (
          <section role="status" className="rounded-card border border-warning/30 bg-warning/5 p-4">
            <label className="block text-xs font-semibold text-text-secondary" htmlFor="shortcut-token">Token de importación</label>
            <div className="mt-2 flex gap-2">
              <input id="shortcut-token" readOnly value={oneTimeToken} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-input border border-border-ocean bg-white px-3 py-3 font-mono text-xs text-text-primary" />
              <button type="button" onClick={() => void copyToken()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button bg-primary text-white" aria-label="Copiar token"><Copy size={17} /></button>
            </div>
            {copied ? <p className="mt-2 text-xs font-semibold text-success">Token copiado.</p> : null}
            <p className="mt-3 text-xs text-text-tertiary">Vence: {formatDate(createdDevice.expires_at)}</p>
            {install.available ? (
              <a href={install.url} target="_blank" rel="noreferrer" className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-button border border-primary px-4 text-sm font-semibold text-primary"><LinkIcon size={15} />{install.label}</a>
            ) : null}
          </section>
        ) : (
          <label className="surface-module block rounded-card border border-border-subtle bg-white p-4">
            <span className="mb-1 block text-xs font-semibold text-text-secondary">Nombre del dispositivo</span>
            <input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. iPhone personal" className="w-full border-0 border-b border-border-strong bg-transparent px-0 pb-2 pt-1 text-base font-semibold text-text-primary outline-none focus:border-primary focus:ring-0" />
          </label>
        )}
      </TaskSurface>

      <ConfirmationSurface
        appearance="compact"
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation?.kind === 'token') {
            setConfirmation(null)
            finishCredentialTask()
          }
          if (confirmation?.kind === 'revoke') void revoke(confirmation.device)
        }}
        triggerElement={confirmation?.kind === 'revoke' ? confirmation.trigger : null}
        eyebrow={confirmation?.kind === 'token' ? 'TOKEN DE UN SOLO USO' : 'REVOCAR DISPOSITIVO'}
        title={confirmation?.kind === 'token' ? '¿Ya guardaste el token?' : `¿Revocar ${confirmation?.kind === 'revoke' ? confirmation.device.name : 'este dispositivo'}?`}
        description={confirmation?.kind === 'token' ? 'Gota no puede volver a mostrar esta credencial.' : 'El dispositivo deja de poder enviar comprobantes de inmediato.'}
        confirmLabel={confirmation?.kind === 'token' ? 'Sí, ya lo guardé' : 'Revocar acceso'}
        busy={confirmation?.kind === 'revoke' && actingId === confirmation.device.id}
        destructive={confirmation?.kind === 'revoke'}
      >
        {confirmation?.kind === 'token'
          ? 'Si todavía no lo copiaste, cancelá y volvé a la pantalla anterior.'
          : 'Podés conectar el dispositivo otra vez creando una credencial nueva.'}
      </ConfirmationSurface>
    </>
  )
}
