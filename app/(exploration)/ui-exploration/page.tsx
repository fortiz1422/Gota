// THROWAWAY — artefacto de exploración visual. No modifica lógica de negocio.
// Acceder en desarrollo: /ui-exploration
// Eliminar antes de merge a main.

import { VariantA } from '@/components/_exploration/VariantA'
import { VariantB } from '@/components/_exploration/VariantB'
import { VariantC } from '@/components/_exploration/VariantC'
import { HomeActivationState } from '@/components/dashboard/HomeActivationState'

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
            background: '#FFFFFF',
            borderRadius: 20,
            padding: 20,
            marginBottom: 32,
            border: '1px solid rgba(26,43,60,0.08)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#2178A8',
            }}
          >
            Home empty states — implementación actual
          </p>
          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 16,
            }}
          >
            <HomeActivationState
              state={{
                variant: 'first-use',
                showPrimaryActivation: true,
                showSecondaryListEmptyState: false,
                deemphasizeAnonymousBanner: true,
                primaryTitle: 'Registrá tu primer movimiento',
                primaryBody: 'Empezá cargando un gasto, ingreso o transferencia para activar tu Home.',
                primaryActionLabel: 'Registrar movimiento',
              }}
              onPrimaryAction={() => {}}
              isAnonymous
            />
            <HomeActivationState
              state={{
                variant: 'monthly-empty',
                showPrimaryActivation: true,
                showSecondaryListEmptyState: true,
                deemphasizeAnonymousBanner: false,
                primaryTitle: 'Todavía no tenés movimientos este mes',
                primaryBody: 'Sumá un movimiento para ver actividad reciente en tu Home de este mes.',
                primaryActionLabel: 'Registrar movimiento',
              }}
              onPrimaryAction={() => {}}
              historyHref="/movimientos"
            />
          </div>
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
