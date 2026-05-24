'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import { BudgetCategoryList } from './BudgetCategoryList'
import { BudgetEditorSheet } from './BudgetEditorSheet'
import { BudgetEmptyState } from './BudgetEmptyState'
import { BudgetSummaryCard } from './BudgetSummaryCard'

interface Props {
  budget: BudgetSnapshot
  currency: 'ARS' | 'USD'
  selectedMonth: string
  categories: string[]
}

export function BudgetsSection({ budget, currency, selectedMonth, categories }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editorOpen, setEditorOpen] = useState(false)
  const [isCloning, setIsCloning] = useState(false)

  const planExists = budget.plan !== null
  const creatableCategories = useMemo(
    () => categories.filter((category) => category !== 'Pago de Tarjetas'),
    [categories],
  )

  async function refreshBudgets() {
    await queryClient.invalidateQueries({ queryKey: ['budgets', selectedMonth, currency] })
  }

  async function handleCreate(items: Array<{ category: string; amount: number }>) {
    const res = await fetch('/api/budgets/current', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodMonth: `${selectedMonth}-01`,
        baseCurrency: currency,
        items,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? 'No se pudo crear el presupuesto.')
    }

    await refreshBudgets()
    router.refresh()
  }

  async function handleSync(items: Array<{ id?: string; category: string; amount: number }>) {
    if (!budget.plan) throw new Error('No existe un plan activo para editar.')

    const nextIds = new Set(items.map((item) => item.id).filter(Boolean) as string[])
    const toDelete = budget.items.filter((item) => !nextIds.has(item.id))
    const toCreate = items.filter((item) => !item.id)
    const toPatch = items.filter((item) => item.id)

    for (const item of toPatch) {
      const res = await fetch(`/api/budgets/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: item.amount }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'No se pudo actualizar el presupuesto.')
      }
    }

    for (const [index, item] of toCreate.entries()) {
      const res = await fetch('/api/budgets/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: budget.plan.id,
          category: item.category,
          amount: item.amount,
          sortOrder: budget.items.length + index,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'No se pudo agregar la categoría.')
      }
    }

    for (const item of toDelete) {
      const res = await fetch(`/api/budgets/items/${item.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'No se pudo eliminar la categoría.')
      }
    }

    await refreshBudgets()
    router.refresh()
  }

  async function handleDelete() {
    if (!budget.plan) throw new Error('No existe un plan activo para eliminar.')

    const res = await fetch(`/api/budgets/plans/${budget.plan.id}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? 'No se pudo eliminar el presupuesto.')
    }

    await refreshBudgets()
    router.refresh()
  }

  async function handleClone() {
    setIsCloning(true)
    try {
      const res = await fetch('/api/budgets/clone-from-previous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodMonth: `${selectedMonth}-01`,
          baseCurrency: currency,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'No se pudo clonar el presupuesto anterior.')
      }

      await refreshBudgets()
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo clonar el presupuesto anterior.')
    } finally {
      setIsCloning(false)
    }
  }

  function openMovements(category: string) {
    router.push(`/movimientos?month=${selectedMonth}&categoria=${encodeURIComponent(category)}&soloPercibidos=true`)
  }

  return (
    <div className="pb-4">
      {planExists ? (
        <>
          <div className="mx-5 mb-3 flex items-center justify-between">
            <p className="text-[12px] text-text-tertiary">Lectura operativa del mes.</p>
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="rounded-full border border-border-ocean px-3 py-1.5 text-[12px] font-semibold text-primary"
            >
              Editar
            </button>
          </div>
          <BudgetSummaryCard summary={budget.summary} currency={currency} />
          <BudgetCategoryList items={budget.items} currency={currency} onOpenMovements={openMovements} />
        </>
      ) : (
        <BudgetEmptyState
          onCreate={() => setEditorOpen(true)}
          onClone={handleClone}
          canClone={budget.previousPlanAvailable && !isCloning}
        />
      )}

      <BudgetEditorSheet
        open={editorOpen}
        mode={planExists ? 'edit' : 'create'}
        currency={currency}
        initialItems={budget.items}
        availableCategories={creatableCategories}
        onClose={() => setEditorOpen(false)}
        onCreate={handleCreate}
        onSync={handleSync}
        onDelete={planExists ? handleDelete : undefined}
      />
    </div>
  )
}
