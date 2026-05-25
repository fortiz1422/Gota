// THROWAWAY — solo para exploración visual. No forma parte de la app.
export default function ExplorationLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: '#F0F4F8', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
