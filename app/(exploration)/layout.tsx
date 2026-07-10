// THROWAWAY — solo para exploración visual. No forma parte de la app.
// El root layout (app/layout.tsx) ya provee html/body, globals.css y fuentes.
export default function ExplorationLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', background: '#F0F4F8' }}>{children}</div>
}
