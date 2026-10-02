'use client'
import { useEffect, useState } from 'react'
export function MercadoPagoExpenseOrigin({ expenseId }:{expenseId:string}) {
  const [label,setLabel]=useState<string|null>(null)
  useEffect(()=>{
    let active=true
    void fetch(`/api/expenses/${encodeURIComponent(expenseId)}/provider-origin`,{cache:'no-store'}).then(async response=>{
      if (!response.ok) return
      const data=await response.json()
      if (active && data.origin==='mercadopago') setLabel(data.decision==='auto'?'Registrado automáticamente desde Mercado Pago':data.decision==='linked'?'Vinculado a un movimiento de Mercado Pago':'Confirmado desde Mercado Pago')
    }).catch(()=>undefined)
    return ()=>{active=false}
  },[expenseId])
  return label ? <p className="mt-2 text-xs text-text-secondary">{label}</p> : null
}
