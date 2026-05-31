'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, TrendDown, WarningCircle } from '@phosphor-icons/react'
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

  const overBudgetCount = budget.summary.overBudgetCount
  const nearLimitCount = budget.summary.nearLimitCount
  const aheadOfPaceCount = budget.summary.aheadOfPaceCount
  const onTrackCount = Math.max(budget.items.length - overBudgetCount - nearLimitCount - aheadOfPaceCount, 0)

  const planStatus = (() => {
    if (overBudgetCount > 0) {
      return {
        eyebrow: 'Prioridad del mes',
        title: `${overBudgetCount} categor${overBudgetCount === 1 ? 'ía quedó' : 'ías quedaron'} pasada${overBudgetCount === 1 ? '' : 's'}`,
        body:
          nearLimitCount > 0
            ? `Además tenés ${nearLimitCount} ${nearLimitCount === 1 ? 'categoría al límite' : 'categorías al límite'}. Conviene ajustar antes de seguir estirando el plan.`
            : 'Conviene corregir primero las categorías en rojo para que el resto del plan vuelva a tener lectura útil.',
        icon: <WarningCircle weight="fill" size={18} className="text-danger" />,
        iconClassName: 'bg-danger/10',
      }
    }

    if (nearLimitCount > 0) {
      return {
        eyebrow: 'Seguimiento del mes',
        title: `${nearLimitCount} categor${nearLimitCount === 1 ? 'ía está' : 'ías están'} cerca del límite`,
        body: 'Todavía no hay desborde, pero ya conviene mirar esas categorías antes de cerrar el mes.',
        icon: <TrendDown weight="bold" size={18} className="text-warning" />,
        iconClassName: 'bg-warning/10',
      }
    }

    return {
      eyebrow: 'Plan ordenado',
      title:
        aheadOfPaceCount > 0
          ? `El presupuesto viene con aire en ${aheadOfPaceCount} categor${aheadOfPaceCount === 1 ? 'ía' : 'ías'}`
          : 'El presupuesto viene en línea con tu ritmo',
      body:
        onTrackCount > 0
          ? `${onTrackCount} ${onTrackCount === 1 ? 'categoría sigue' : 'categorías siguen'} en rango y sin alertas de corto plazo.`
          : 'No hay alertas activas en este momento.',
      icon: <CheckCircle weight="fill" size={18} className="text-primary" />,
      iconClassName: 'bg-primary/10',
    }
  })()

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
          <section className="mx-5 mb-3 rounded-card border border-border-subtle bg-bg-secondary/70 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${planStatus.iconClassName}`}>
                  {planStatus.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    {planStatus.eyebrow}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold leading-5 text-text-primary">{planStatus.title}</p>
                  <p className="mt-1 text-[12px] leading-5 text-text-secondary">{planStatus.body}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="shrink-0 rounded-button border border-border-ocean px-3 py-1.5 text-[12px] font-semibold text-primary transition-opacity hover:opacity-80 active:opacity-60"
              >
                Editar
              </button>
            </div>
          </section>

          <BudgetSummaryCard summary={budget.summary} currency={currency} totalCategories={budget.items.length} />
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
