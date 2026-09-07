'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CaretRight, Plus, Storefront, Trash, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
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

  const beginCreate = () => {
    setCreating(true)
    setSelectedId(null)
    setName('')
    setCategory('')
    setNewAlias('')
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
      setCreating(false)
      setSelectedId(saved.id)
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
    if (!window.confirm(`¿Eliminar el alias “${alias.alias_value}”?`)) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/counterparty-aliases/${encodeURIComponent(alias.id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await responseError(response, 'No pudimos eliminar el alias.'))
      await loadProfiles()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos eliminar el alias.')
    } finally {
      setSaving(false)
    }
  }

  const removeProfile = async () => {
    if (!selected || !window.confirm(`¿Eliminar “${selected.display_name}” y todos sus alias? Los movimientos históricos no cambiarán.`)) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/counterparty-profiles/${encodeURIComponent(selected.id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await responseError(response, 'No pudimos eliminar el comercio.'))
      setSelectedId(null)
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
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-3 rounded-card border border-border-subtle bg-bg-secondary p-4 text-left transition-colors hover:bg-primary/5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Storefront size={18} weight="duotone" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">Alias de comercios</span>
          <span className="block text-xs leading-5 text-text-tertiary">Nombres y categorías que Gota recuerda</span>
        </span>
        <CaretRight size={14} className="text-text-dim" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="type-label text-primary">Personalización</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-text-primary">Alias de comercios</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Gota usa coincidencias exactas para precompletar. Siempre revisás antes de guardar.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="p-2 text-text-tertiary"><X size={20} /></button>
          </header>

          {error && <p role="alert" className="rounded-input bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

          {!creating && !selected && (
            <section aria-busy={loading}>
              <div className="flex gap-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre o alias" className="min-w-0 flex-1 rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary" />
                <button type="button" onClick={beginCreate} className="rounded-button bg-primary px-3 text-sm font-semibold text-white"><Plus size={15} className="inline" /> Nuevo</button>
              </div>
              {loading ? <p className="py-8 text-center text-sm text-text-tertiary">Cargando…</p> : error && profiles.length === 0 ? (
                <button type="button" onClick={() => void loadProfiles()} className="mt-4 text-sm font-semibold text-primary">Reintentar</button>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center"><p className="text-sm text-text-tertiary">{query ? 'No hay coincidencias.' : 'Todavía no guardaste comercios.'}</p>{!query && <button type="button" onClick={beginCreate} className="mt-3 text-sm font-semibold text-primary">Crear el primero</button>}</div>
              ) : (
                <ul className="mt-3 divide-y divide-border-subtle rounded-card border border-border-subtle">
                  {filtered.map((profile) => <li key={profile.id}>
                    <button type="button" onClick={() => { setCreating(false); setSelectedId(profile.id); setError(null) }} className="flex w-full items-center gap-3 p-3 text-left hover:bg-primary/5">
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">{profile.display_name}</span><span className="block truncate text-xs text-text-tertiary">{profile.default_category || 'Sin categoría habitual'} · {profile.aliases.length} {profile.aliases.length === 1 ? 'alias' : 'alias'}</span></span>
                      <CaretRight size={13} className="text-text-dim" />
                    </button>
                  </li>)}
                </ul>
              )}
            </section>
          )}

          {(creating || selected) && (
            <section className="space-y-4">
              <button type="button" onClick={() => { setCreating(false); setSelectedId(null); setError(null) }} className="text-xs font-semibold text-primary">← Volver a la lista</button>
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary" htmlFor="counterparty-name">Nombre</label>
                <input id="counterparty-name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="Ej. Belmar" className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary" htmlFor="counterparty-category">Categoría habitual</label>
                <select id="counterparty-category" value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary"><option value="">Sin categoría habitual</option>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              </div>
              {selected && <div>
                <p className="mb-2 text-xs font-semibold text-text-secondary">Alias detectados</p>
                <div className="flex flex-wrap gap-2">{selected.aliases.length === 0 ? <p className="text-xs text-text-tertiary">Todavía no tiene alias.</p> : selected.aliases.map((alias) => <span key={alias.id} className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-xs text-text-primary">{alias.alias_value}<button type="button" onClick={() => void removeAlias(alias)} disabled={saving} aria-label={`Eliminar alias ${alias.alias_value}`} className="text-danger"><X size={12} /></button></span>)}</div>
              </div>}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary" htmlFor="counterparty-alias">{creating ? 'Primer alias (opcional)' : 'Agregar alias'}</label>
                <div className="flex gap-2"><input id="counterparty-alias" value={newAlias} maxLength={160} onChange={(event) => setNewAlias(event.target.value)} placeholder="Texto tal como aparece" className="min-w-0 flex-1 rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary" />{selected && <button type="button" onClick={() => void addAlias()} disabled={saving || !newAlias.trim()} className="rounded-button border border-primary px-3 text-sm font-semibold text-primary disabled:opacity-40">Agregar</button>}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void saveProfile()} disabled={saving || !name.trim()} className="flex-1 rounded-button bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : creating ? 'Crear comercio' : 'Guardar cambios'}</button>
                {selected && <button type="button" onClick={() => void removeProfile()} disabled={saving} aria-label="Eliminar comercio" className="rounded-button border border-danger/30 px-3 text-danger"><Trash size={17} /></button>}
              </div>
              <p className="text-xs leading-5 text-text-tertiary">Editar o eliminar una entrada no cambia movimientos históricos.</p>
            </section>
          )}
        </div>
      </Modal>
    </>
  )
}
