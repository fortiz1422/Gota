import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('UX audit 2026-10 copy and touch targets (UX-B)', () => {
  it('uses rioplatense strings and 44px targets in scoped surfaces', () => {
    const tarjetas = read('../app/(dashboard)/tarjetas/TarjetasClient.tsx')
    expect(tarjetas).toMatch(/aria-label="Volver"[\s\S]*min-h-11 min-w-11/)

    const cardDetail = read('../app/(dashboard)/tarjetas/[cardId]/CardDetailClient.tsx')
    expect(cardDetail).toContain('¿Querés revertir el pago')
    expect(cardDetail).toContain('Se eliminará el movimiento registrado')
    expect(cardDetail).toContain('flex min-h-11 flex-1 items-center justify-center rounded-full type-meta text-text-secondary')
    expect(cardDetail).toContain('flex min-h-11 flex-1 items-center justify-center rounded-full bg-danger')

    const strip = read('../components/movimientos/StripOperativo.tsx')
    expect(strip).toContain("'Aún sin pagar'")

    const smartInput = read('../components/dashboard/SmartInput.tsx')
    const smartInputHint = 'No pudimos entenderlo. Probá con algo como "café 2500".'
    expect(smartInput.match(new RegExp(smartInputHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(2)

    const parsePreview = read('../components/dashboard/ParsePreview.tsx')
    expect(parsePreview).toContain('Intentá de nuevo.')

    const expenseItem = read('../components/expenses/ExpenseItem.tsx')
    expect(expenseItem).toContain('descripción')
    expect(expenseItem).toContain('operación')
    expect(expenseItem).toContain('Podés eliminarlas')

    const aliases = read('../components/settings/CounterpartyAliasesPanel.tsx')
    expect(aliases).toMatch(/Eliminar alias[\s\S]*min-h-11 min-w-11/)
  })
})
