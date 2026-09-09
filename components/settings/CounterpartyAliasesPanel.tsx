'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CaretRight, Plus, Storefront, Trash, X } from '@phosphor-icons/react'
import { ManagementSurface } from '@/components/ui/ManagementSurface'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { ConfirmationSurface } from '@/components/ui/ConfirmationSurface'
import { CATEGORIES } from '@/lib/validation/schemas'
import {
  counterpartyApiErrorMessage,
  filterCounterpartyProfiles,
  type CounterpartyAliasListItem,
  type CounterpartyProfileListItem,
} from '@/lib/counterparty-aliases/ui'

type CounterpartyAlias = CounterpartyAliasListItem
type CounterpartyProfile = CounterpartyProfileListItem

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null
  return counterpartyApiErrorMessage(body?.error, fallback)
}

export function CounterpartyAliasesPanel() {
  const [open, setOpen] = useState(false)
  const [profiles, setProfiles] = useState<CounterpartyProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [newAlias, setNewAlias] = useState('')
  const [taskTrigger, setTaskTrigger] = useState<HTMLElement | null>(null)
  const [confirmation, setConfirmation] = useState<
    | { kind: 'profile'; trigger: HTMLElement }
    | { kind: 'alias'; alias: CounterpartyAlias; trigger: HTMLElement }
    | null
  >(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/counterparty-profiles', { cache: 'no-store' })
      if (!response.ok) throw new Error(await responseError(response, 'No pudimos cargar tus comercios.'))
      const body = await response.json() as { profiles?: CounterpartyProfile[] }
      const next = Array.isArray(body.profiles) ? body.profiles : []
      setProfiles(next)
      setSelectedId((current) => current && next.some((profile) => profile.id === current) ? current : null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos cargar tus comercios.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadProfiles()
    if (!open) {
      setQuery('')
      setSelectedId(null)
      setCreating(false)
      setTaskTrigger(null)
      setError(null)
    }
  }, [open, loadProfiles])

  const selected = profiles.find((profile) => profile.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) return
    setName(selected.display_name)
    setCategory(selected.default_category ?? '')
    setNewAlias('')
  }, [selected])

  const filtered = useMemo(() => filterCounterpartyProfiles(profiles, query), [profiles, query])

  const beginCreate = (trigger: HTMLElement) => {
    setTaskTrigger(trigger)
    setCreating(true)
    setSelectedId(null)
    setName('')
    setCategory('')
    setNewAlias('')
    setError(null)
  }

  const beginEdit = (profile: CounterpartyProfile, trigger: HTMLElement) => {
    setTaskTrigger(trigger)
    setCreating(false)
    setSelectedId(profile.id)
    setError(null)
  }

  const closeEditor = () => {
    setCreating(false)
    setSelectedId(null)
    setTaskTrigger(null)
    setError(null)
  }

  const saveProfile = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(
        creating ? '/api/counterparty-profiles' : `/api/counterparty-profiles/${encodeURIComponent(selectedId ?? '')}`,
        {
          method: creating ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_name: name.trim(), default_category: category || null }),
        },
      )
      if (!response.ok) throw new Error(await responseError(response, 'No pudimos guardar el comercio.'))
      const saved = await response.json() as { id: string }
      if (creating && newAlias.trim()) {
        const aliasResponse = await fetch(`/api/counterparty-profiles/${encodeURIComponent(saved.id)}/aliases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alias_value: newAlias.trim(), source: 'manual' }),
        })
        if (!aliasResponse.ok) {
          setError(`El comercio se guardó, pero ${await responseError(aliasResponse, 'no pudimos agregar el alias.')}`)
          await loadProfiles()
          setCreating(false)
          setSelectedId(saved.id)
          return
        }
      }
      await loadProfiles()
      closeEditor()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos guardar el comercio.')
    } finally {
      setSaving(false)
    }
  }

  const addAlias = async () => {
    if (!selected || !newAlias.trim()) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/counterparty-profiles/${encodeURIComponent(selected.id)}/aliases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias_value: newAlias.trim(), source: 'manual' }),
      })
      if (!response.ok) throw new Error(await responseError(response, 'No pudimos agregar el alias.'))
      setNewAlias('')
      await loadProfiles()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos agregar el alias.')
    } finally {
      setSaving(false)
    }
  }

  const removeAlias = async (alias: CounterpartyAlias) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/counterparty-aliases/${encodeURIComponent(alias.id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await responseError(response, 'No pudimos eliminar el alias.'))
      setConfirmation(null)
      await loadProfiles()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos eliminar el alias.')
    } finally {
      setSaving(false)
    }
  }

  const removeProfile = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/counterparty-profiles/${encodeURIComponent(selected.id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await responseError(response, 'No pudimos eliminar el comercio.'))
      setConfirmation(null)
      closeEditor()
      await loadProfiles()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos eliminar el comercio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-3 rounded-card border border-border-subtle bg-bg-secondary p-4 text-left transition-colors hover:bg-primary/5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Storefront size={18} weight="duotone" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">Alias y categorías</span>
          <span className="block text-xs leading-5 text-text-tertiary">Nombres y categorías que Gota recuerda</span>
        </span>
        <CaretRight size={14} className="text-text-dim" />
      </button>

      <ManagementSurface
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        initialFocusRef={searchRef}
        eyebrow="PERSONALIZACIÓN"
        title="Alias y categorías"
        description="Lo que Gota recuerda para ayudarte a cargar sin cambiar movimientos históricos."
        action={
          <button
            type="button"
            onClick={(event) => beginCreate(event.currentTarget)}
            className="flex w-full items-center justify-center gap-2 rounded-button bg-primary py-3 text-sm font-semibold text-white"
          >
            <Plus size={16} /> Nuevo comercio
          </button>
        }
      >
        {error && !creating && !selected ? <p role="alert" className="mb-3 rounded-input bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <label className="sr-only" htmlFor="counterparty-search">Buscar nombre o alias</label>
        <input
          ref={searchRef}
          id="counterparty-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar nombre o alias"
          className="w-full rounded-input border border-border-ocean bg-bg-primary px-3 py-3 text-sm text-text-primary"
        />

        <section className="mt-4" aria-busy={loading}>
          {loading ? (
            <div className="space-y-2" aria-label="Cargando comercios">
              {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-card bg-bg-tertiary" />)}
            </div>
          ) : error && profiles.length === 0 ? (
            <button type="button" onClick={() => void loadProfiles()} className="text-sm font-semibold text-primary">Reintentar</button>
          ) : filtered.length === 0 ? (
            <div className="rounded-card border border-dashed border-border-strong px-5 py-8 text-center">
              <p className="text-sm font-semibold text-text-primary">{query ? 'No hay coincidencias' : 'Todavía no guardaste comercios'}</p>
              <p className="mt-1 text-xs leading-5 text-text-tertiary">{query ? 'Probá con otro nombre o alias.' : 'Gota puede recordar el nombre y una categoría habitual.'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-strong bg-bg-primary">
              {filtered.map((profile) => (
                <li key={profile.id}>
                  <button
                    type="button"
                    onClick={(event) => beginEdit(profile, event.currentTarget)}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-primary/5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Storefront size={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-primary">{profile.display_name}</span>
                      <span className="block truncate text-xs text-text-tertiary">{profile.default_category || 'Sin categoría habitual'} · {profile.aliases.length} {profile.aliases.length === 1 ? 'alias' : 'alias'}</span>
                    </span>
                    <CaretRight size={14} className="text-text-dim" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </ManagementSurface>

      <TaskSurface
        open={creating || Boolean(selected)}
        onClose={closeEditor}
        triggerElement={taskTrigger}
        initialFocusRef={nameRef}
        eyebrow="ALIAS Y CATEGORÍAS"
        title={creating ? 'Nuevo comercio' : 'Editar comercio'}
        description={creating ? 'Definí cómo querés reconocerlo al cargar.' : 'Revisá el nombre, la categoría habitual y sus alias.'}
        footer={
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={saving || !name.trim()}
            className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Guardando…' : creating ? 'Crear comercio' : 'Guardar cambios'}
          </button>
        }
      >
        <div className="space-y-5">
          {error ? <p role="alert" className="rounded-input bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-secondary">Nombre</span>
            <input ref={nameRef} value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="Ej. Belmar" className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-3 text-sm text-text-primary" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-secondary">Categoría habitual</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-3 text-sm text-text-primary">
              <option value="">Sin categoría habitual</option>
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {selected ? (
            <section>
              <p className="mb-2 text-xs font-semibold text-text-secondary">Alias detectados</p>
              <div className="flex flex-wrap gap-2">
                {selected.aliases.length === 0 ? <p className="text-xs text-text-tertiary">Todavía no tiene alias.</p> : selected.aliases.map((alias) => (
                  <span key={alias.id} className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-xs text-text-primary">
                    {alias.alias_value}
                    <button type="button" onClick={(event) => setConfirmation({ kind: 'alias', alias, trigger: event.currentTarget })} disabled={saving} aria-label={`Eliminar alias ${alias.alias_value}`} className="text-danger"><X size={12} /></button>
                  </span>
                ))}
              </div>
            </section>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-secondary">{creating ? 'Primer alias (opcional)' : 'Agregar alias'}</span>
            <div className="flex gap-2">
              <input value={newAlias} maxLength={160} onChange={(event) => setNewAlias(event.target.value)} placeholder="Texto tal como aparece" className="min-w-0 flex-1 rounded-input border border-border-ocean bg-bg-tertiary px-3 py-3 text-sm text-text-primary" />
              {selected ? <button type="button" onClick={() => void addAlias()} disabled={saving || !newAlias.trim()} className="rounded-button border border-primary px-3 text-sm font-semibold text-primary disabled:opacity-40">Agregar</button> : null}
            </div>
          </label>
          <p className="text-xs leading-5 text-text-tertiary">Editar o eliminar una entrada no cambia movimientos históricos.</p>
          {selected ? (
            <button type="button" onClick={(event) => setConfirmation({ kind: 'profile', trigger: event.currentTarget })} disabled={saving} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-button border border-danger/30 text-sm font-semibold text-danger">
              <Trash size={17} /> Eliminar comercio
            </button>
          ) : null}
        </div>
      </TaskSurface>

      <ConfirmationSurface
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation?.kind === 'alias') void removeAlias(confirmation.alias)
          if (confirmation?.kind === 'profile') void removeProfile()
        }}
        triggerElement={confirmation?.trigger}
        eyebrow={confirmation?.kind === 'alias' ? 'ELIMINAR ALIAS' : 'ELIMINAR COMERCIO'}
        title={confirmation?.kind === 'alias' ? `¿Eliminar “${confirmation.alias.alias_value}”?` : `¿Eliminar ${selected?.display_name ?? 'este comercio'}?`}
        description={confirmation?.kind === 'alias' ? 'Gota dejará de reconocer ese texto exacto.' : 'Se eliminan el perfil y sus alias guardados.'}
        confirmLabel={confirmation?.kind === 'alias' ? 'Eliminar alias' : 'Eliminar comercio'}
        busy={saving}
        destructive
      >
        Los movimientos históricos no se modifican. Esta acción sólo cambia lo que Gota recuerda para cargas futuras.
      </ConfirmationSurface>
    </>
  )
}
