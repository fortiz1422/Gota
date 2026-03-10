'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowCircleUp } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import type { IncomeEntry } from '@/types/database'

const INCOME_LABELS: Record<string, string> = {
  salary: 'Sueldo',
  freelance: 'Freelance',
  other: 'Ingreso',
}

interface Props {
  entry: IncomeEntry
}

export function IncomeItem({ entry }: Props) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este ingreso?')) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/income-entries/${entry.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setDeleted(true)
      router.refresh()
    } catch {
      alert('Error al eliminar el ingreso.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (deleted) return null

  return (
    <div className="flex items-center gap-3 rounded-card border border-success/20 bg-success/5 px-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10">
        <ArrowCircleUp weight="duotone" size={18} className="text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-[13px] font-medium text-text-primary">
          {entry.description || INCOME_LABELS[entry.category] || 'Ingreso'}
        </p>
        <p className="mt-0.5 text-[11px] text-text-tertiary">
          {INCOME_LABELS[entry.category]} · {formatDate(entry.date)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[14px] font-bold tabular-nums text-success">
          +{formatAmount(entry.amount, entry.currency)}
        </span>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Eliminar ingreso"
          className="text-lg leading-none text-text-disabled transition-colors hover:text-danger disabled:opacity-50"
        >
          ×
        </button>
      </div>
    </div>
  )
}
