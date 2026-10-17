'use client'

import { useRef, useState, type ReactNode } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import { ManagementSurface } from '@/components/ui/ManagementSurface'
import { NestedSettingsModalContext } from '@/components/ui/NestedSettingsModalContext'
import styles from './MobileSettings.module.css'

interface SettingsDetailProps {
  surfaceVariant?: 'r' | 'blue-hero'
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
  eyebrow?: string
}

export function SettingsDetail({
  surfaceVariant,
  title,
  description,
  icon,
  children,
  eyebrow = 'CONFIGURACIÓN',
}: SettingsDetailProps) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.row}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {icon}
        <span className={styles.rowBody}>
          <span className={styles.rowTitle}>{title}</span>
          <span className={styles.rowDescription}>{description}</span>
        </span>
        <CaretRight size={16} weight="light" />
      </button>

      <ManagementSurface
        variant={surfaceVariant}
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={trigger}
        eyebrow={eyebrow}
        title={title}
        description={description}
      >
        {open ? (
          <NestedSettingsModalContext.Provider value>
            {children}
          </NestedSettingsModalContext.Provider>
        ) : null}
      </ManagementSurface>
    </>
  )
}
