// THROWAWAY — artefacto de exploración visual. No modifica lógica de negocio.
// Acceder en desarrollo: /ui-exploration
// Eliminar antes de merge a main.

import { VariantA } from '@/components/_exploration/VariantA'
import { VariantB } from '@/components/_exploration/VariantB'
import { VariantC } from '@/components/_exploration/VariantC'

export default function UIExplorationPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#E8EFF5',
        padding: '24px 16px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div
          style={{
            background: '#1A2B3C',
            color: '#E0F0FF',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 32,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#6BB8E8',
            }}
          >
            Exploración visual — throwaway
          </p>
          <h1 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>
            Gota Mobile UI · 3 Direcciones
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#90B8D0' }}>
            Variante A: Fintech Calma / Premium · B: Nativa Operativa / Densa · C: Híbrida Sobria
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 32,
            alignItems: 'start',
          }}
        >
          <VariantA />
          <VariantB />
          <VariantC />
        </div>
      </div>
    </div>
  )
}
