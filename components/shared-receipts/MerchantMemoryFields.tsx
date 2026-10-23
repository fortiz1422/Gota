'use client'

import type {
  MerchantMemory,
  MerchantProfileOption,
} from '@/lib/counterparty-aliases/bulk-memory'

const field =
  'min-h-11 w-full rounded-button border border-border-strong bg-bg-tertiary px-3 py-2 text-base text-text-primary'
export function MerchantMemoryFields({
  id,
  detectedAlias,
  category,
  memory,
  profiles,
  profilesError,
  onChange,
}: {
  id: string
  detectedAlias: string
  category: string
  memory: MerchantMemory
  profiles: MerchantProfileOption[]
  profilesError: string | null
  onChange: (memory: MerchantMemory) => void
}) {
  return (
    <div className="mt-2">
      <label className="text-text-secondary flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="text-primary size-5 shrink-0 rounded"
          checked={memory.enabled}
          onChange={(e) => onChange({ ...memory, enabled: e.target.checked })}
        />
        Recordar comercio
      </label>
      {memory.enabled && (
        <fieldset className="rounded-input bg-bg-secondary mt-1 p-3">
          <legend className="sr-only">
            Recordar comercio para próximas veces
          </legend>
          <p className="text-text-secondary text-xs break-words">
            Texto detectado:{' '}
            <strong className="text-text-primary">{detectedAlias}</strong>
          </p>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              className="text-primary size-5"
              name={`memory-${id}`}
              checked={memory.mode === 'new'}
              onChange={() => onChange({ ...memory, mode: 'new' })}
            />
            Crear comercio nuevo
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              className="text-primary size-5"
              name={`memory-${id}`}
              checked={memory.mode === 'existing'}
              onChange={() => onChange({ ...memory, mode: 'existing' })}
            />
            Vincular a uno existente
          </label>
          {memory.mode === 'new' ? (
            <label className="text-text-secondary block text-xs">
              Nombre del comercio
              <input
                className={`${field} mt-1`}
                type="text"
                maxLength={100}
                value={memory.name}
                onChange={(e) => onChange({ ...memory, name: e.target.value })}
                placeholder="Ej. Pollería del barrio"
              />
            </label>
          ) : (
            <label className="text-text-secondary block text-xs">
              Comercio guardado
              <select
                className={`${field} mt-1`}
                value={memory.profileId}
                onChange={(e) =>
                  onChange({ ...memory, profileId: e.target.value })
                }
              >
                <option value="">Elegí un comercio</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.display_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-text-secondary mt-2 text-xs">
            Categoría para próximas veces: {category || 'sin definir'}. Se
            recuerda al confirmar.
          </p>
          {memory.mode === 'existing' && memory.profileId && (
            <p className="text-warning mt-1 text-xs">
              Esta categoría reemplazará la preferencia del comercio guardado.
            </p>
          )}
          {profilesError && (
            <p role="status" className="text-warning mt-2 text-xs">
              {profilesError}
            </p>
          )}
        </fieldset>
      )}
    </div>
  )
}
