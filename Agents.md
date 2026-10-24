# Gota - App de finanzas personales AR

Stack: Next.js 15 (App Router), Supabase, Tailwind v4, TypeScript strict,
Gemini Flash (SmartInput), Vercel. Solo developer.

## Comandos
npm run dev | npm run build | npm run lint | npx tsc --noEmit

## Docs de referencia
- Design system vigente: docs/design-system-final.md
- Tokens reales: app/globals.css
- Docs de diseno viejos: historicos/no vigentes para decisiones visuales
- Frontend patterns: docs/gota-frontend-guidelines.md
- Backend / schema: docs/gota-backend-structure.md
- Features / PRD: docs/gota-prd.md
- App flows: docs/gota-app-flows.md

## Reglas de comportamiento
- Tareas de 3+ pasos: planificar antes de codear, esperar confirmacion
- Ante un bug: leer todos los archivos relevantes antes de proponer fix
- Leer archivos directamente sin pedir permiso
- Mostrar diff antes de aplicar cambios en archivos existentes
- Cambios minimos: no tocar codigo adyacente no relacionado

## ROADMAP.md
`ROADMAP.md` (raíz del repo) es la fuente de verdad del trabajo de producto: secciones Ideas, Aprobado, En curso y Listo. Antes de tocar algo, leelo y trabajá solo ítems en Aprobado o En curso. Al terminar, actualizá el estado del ítem en ese archivo (En curso en la rama del PR; Listo al mergear).
