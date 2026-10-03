import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MercadoPagoReviewInbox } from '@/components/mercadopago/MercadoPagoReviewClient'
import { MercadoPagoConnectionView } from '@/components/settings/MercadoPagoSettingsCard'
import { classifyMercadoPagoMovements, type MercadoPagoMovement } from './review'

const movement: MercadoPagoMovement = {
  candidateId:'example', occurredAt:'2026-10-02T01:27:00Z', balanceOccurredAt:'2026-10-02T01:27:00Z',
  amount:{value:32000,currency:'ARS'}, description:'YPF', statementDescriptor:null, reviewStatus:'pending',
  balanceImpact:{observed:true,effect:'debit',amount:{value:-32000,currency:'ARS'}},
}
const inbox = (movements: MercadoPagoMovement[]) => renderToStaticMarkup(createElement(MercadoPagoReviewInbox,{buckets:classifyMercadoPagoMovements(movements),onOpen:()=>undefined}))

describe('clean Mercado Pago presentation',()=>{
  it('does not present selection or technical actions when the inbox is empty',()=>{
    const html=inbox([])
    expect(html).toContain('Estás al día')
    expect(html).not.toContain('<summary')
    expect(html).not.toContain('Opciones avanzadas')
    expect(html).not.toContain('Descartar')
  })
  it('retains financial context and original descriptions without accounting paragraphs in each row',()=>{
    const html=inbox([{...movement, description:'Una descripción original de producto muy larga que permanece disponible al abrir el movimiento'}])
    expect(html).toContain('32.000,00')
    expect(html).toContain('1/10/2026')
    expect(html).toContain('Una descripción original')
    expect(html).toContain('Revisá la categoría')
    expect(html).not.toContain('Revisá qué representa esta salida')
    expect(html).not.toContain('Opciones avanzadas')
  })
  it('asks for the origin of incoming transfers without suggesting an expense',()=>{
    const html=inbox([{...movement,kind:'transfer',direction:'inflow',balanceImpact:{observed:true,effect:'credit',amount:{value:32000,currency:'ARS'}}}])
    expect(html).toContain('Identificá de dónde vino')
    expect(html).not.toContain('Revisá la categoría')
    expect(html).not.toContain('¿Fue un pago')
  })
  it('discloses manual confirmation instead of claiming automatic import in connected settings',()=>{
    const html=renderToStaticMarkup(createElement(MercadoPagoConnectionView,{state:{state:'connected',lastSyncAt:null,sources:{payments:{status:'success',count:0},reports:{status:'pending',count:0}}},onManage:()=>undefined}))
    expect(html).toContain('cuando los confirmás')
    expect(html).toContain('Ver movimientos')
    expect(html).toContain('Gestionar conexión')
    expect(html).not.toContain('automáticamente')
    expect(html).not.toContain('Sincronizar ahora')
  })
})
