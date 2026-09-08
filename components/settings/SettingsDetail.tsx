'use client'
import { useId, useRef, useState, type ReactNode } from 'react'
import { CaretRight, X } from '@phosphor-icons/react'
import { FullScreenSheet } from '@/components/ui/FullScreenSheet'
import styles from './MobileSettings.module.css'
import { NestedSettingsModalContext } from '@/components/ui/NestedSettingsModalContext'

export function SettingsDetail({ title, description, icon, children }: { title: string; description: string; icon: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  return <>
    <button ref={trigger} type="button" className={styles.row} onClick={() => setOpen(true)} aria-haspopup="dialog">
      {icon}<span className={styles.rowBody}><span className={styles.rowTitle}>{title}</span><span className={styles.rowDescription}>{description}</span></span><CaretRight size={16} weight="light" />
    </button>
    <FullScreenSheet open={open} onClose={() => setOpen(false)} labelledBy={id} triggerRef={trigger}>
      <div className={styles.detail}>
        <header className={styles.detailHeader}><h2 id={id}>{title}</h2><button type="button" onClick={() => setOpen(false)} aria-label={`Cerrar ${title}`}><X size={22} weight="light" /></button></header>
        {open && <NestedSettingsModalContext.Provider value={true}>{children}</NestedSettingsModalContext.Provider>}
      </div>
    </FullScreenSheet>
  </>
}
