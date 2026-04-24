# Gota — Auditoría UI/UX profunda y plan top-tier

**Fecha:** 2026-04-23  
**Producto:** PWA finanzas personales (mobile-first)  
**Referencia comparativa:** Linear, Revolut, Copilot, Monarch

---

## 1) Diagnóstico global

Gota tiene una base sólida de identidad: paleta fría coherente, tono visual calmo, lenguaje tipográfico estable y una estructura de navegación simple (Home / Movimientos / Análisis). El producto no se percibe “desordenado”; se percibe como un sistema en transición entre MVP robusto y producto premium.

### Fortalezas actuales

1. **Identidad visual definida y documentada**
   - El design system fija principios claros (light only, rol del color, pesos tipográficos, superficies).  
   - La paleta y semántica de color están bien pensadas para finanzas personales (success/ingreso, primary/interacción, warning/alerta contextual). 

2. **Arquitectura de experiencia mobile-first consistente**
   - Home prioriza el estado financiero principal (Saldo Vivo) antes del detalle transaccional.  
   - Navegación inferior simple de 3 destinos, baja carga cognitiva.

3. **Buen enfoque en performance percibida y continuidad**
   - Skeletons, prefetch entre tabs y carga progresiva de datos.
   - Flujos de edición inline/sheet que reducen fricción.

4. **Lenguaje funcional correcto para uso diario**
   - Componentes como `Ultimos5`, `FiltroEstoico`, `StripOperativo` ayudan a responder “qué pasó este mes” rápidamente.

### Oportunidades de mejora (nivel top-tier)

1. **Jerarquía visual aún demasiado homogénea**
   - Muchas secciones tienen contraste y escala similares; falta una jerarquía “hero → bloque estratégico → detalle”.

2. **Inconsistencia de primitives UI**
   - Hay botones/toggles/headers con estilos custom por componente en lugar de un set de primitives cerrado.
   - Esto genera micro-variaciones de spacing, estados y densidad.

3. **Exploración analítica todavía “screen-switch”, no “flow”**
   - En Análisis hay cambio Diario/Insights, pero falta una navegación de profundidad más fluida con breadcrumbs/estado persistente de drill-down.

4. **Modelo de superficies requiere mayor disciplina**
   - El sistema glass existe y está documentado, pero convive con módulos sólidos sin reglas de prioridad suficientemente rígidas por contexto.

---

## 2) Qué está bien (y hay que preservar)

### A. Semántica financiera del color

- El sistema separa interacción (`primary`) de estados financieros (`success`, `warning`, `danger`) y evita el abuso de rojo para gasto cotidiano.
- Esto protege legibilidad emocional (clave en apps de dinero).

### B. Hero financiero con foco

- `SaldoVivo` prioriza una lectura principal y permite alternar a `Disponible real`, lo cual traduce un concepto financiero complejo a interacción simple.

### C. Cadencia operativa de Home

- Home combina estado (Saldo), composición de gasto (Estoico), alertas accionables (suscripciones/recurrentes), y movimientos recientes en secuencia lógica.

### D. Pattern de listas transaccionales

- `MovimientosGroupedList` agrupa por fecha y mantiene affordances de edición directa, muy útil para mantenimiento cotidiano.

---

## 3) Gaps críticos para escalar a “top tier”

## 3.1 Sistema de jerarquía (macro)

**Problema:** actualmente la mayoría de bloques compiten por atención con pesos similares.

**Qué haría un producto top-tier (Linear/Copilot style):**
- Nivel 1: 1 bloque dominante por pantalla (hero o métrica líder).
- Nivel 2: 1–2 módulos de decisión (insights accionables).
- Nivel 3: detalle expandible (listas, breakdowns, histórico).

**Acción concreta en Gota:**
- Home: fortalecer “hero band” + un único “action rail” del mes; mover módulos secundarios detrás de expand/collapse progresivo.
- Analytics: primer viewport con “story” mensual (3 KPIs + titular), dejando categorías completas para segundo scroll.

## 3.2 Sistema de componentes (micro)

**Problema:** hay variación de botones, pills, toggles, headers y celdas con decisiones repetidas ad hoc.

**Acción concreta:** crear primitives cerradas y obligatorias:
- `Button` (primary/secondary/ghost/destructive)
- `IconButton` (sm/md)
- `SegmentedControl` (reemplaza toggles custom)
- `StatCard` (title/value/subvalue/action)
- `ListRow` (leading icon, primary text, meta, trailing value, chevron opcional)
- `SheetHeader` y `SectionHeader`

Con esto se elimina deriva visual y se acelera shipping con calidad homogénea.

## 3.3 Navegación y exploración

**Problema:** el usuario puede ver datos, pero la progresión “explorar → entender → actuar” aún no está totalmente guiada.

**Acción concreta:**
1. Definir journeys canónicos:
   - “Revisión diaria (2 min)”
   - “Cierre de mes (10 min)”
   - “Control de compromisos (5 min)”
2. Cada journey debe tener CTA explícito y persistencia de contexto (mes, moneda, filtros, drill).
3. Analytics debe ofrecer drill-down encadenado (categoría → origen → movimiento) con regreso contextual, no sólo salto de página.

## 3.4 Motion & feedback premium

**Problema:** existen animaciones, pero falta un sistema de motion consistente por intención.

**Acción concreta:** definir motion tokens:
- `duration-fast` 120ms (tap feedback)
- `duration-base` 180ms (toggle/switch)
- `duration-slow` 240ms (sheet enter)
- easing estándar para todo el sistema

Y mapearlos a: tab switch, row expand, sheet open/close, hero mode toggle.

## 3.5 Densidad y ritmo tipográfico

**Problema:** muy buena base tipográfica, pero hay zonas con mezcla de tamaños/pesos sin patrón único (sobre todo en rows y subtítulos).

**Acción concreta:**
- Establecer reglas rígidas por nivel: Title / Section / Row / Meta / Micro.
- Imponer baseline grid de spacing (4pt o 8pt) y reducir excepciones manuales.

---

## 4) Benchmark aplicado (qué copiar conceptualmente, no visualmente)

## Linear
- **Copiar:** precisión en spacing, consistencia de estados hover/active/focus, sheets impecables.
- **Aplicación Gota:** unificar spacing y componentes base; mejorar continuidad modal/sheet.

## Revolut
- **Copiar:** profundidad analítica por períodos y filtros encadenados.
- **Aplicación Gota:** drill-down en analytics con estado persistente y comparación temporal más explícita.

## Copilot Finance
- **Copiar:** narrativa de insights + digestibilidad de bloques.
- **Aplicación Gota:** home con “historia del mes” breve antes de tablas/listas.

## Monarch
- **Copiar:** claridad en progreso mensual y control presupuestario.
- **Aplicación Gota:** evolución de `FiltroEstoico` a módulo de progreso y desvío vs objetivo.

---

## 5) Plan de evolución en 3 fases

## Fase 1 (2–3 semanas) — Consistencia visual operativa

- Consolidar primitives UI y reemplazar variantes dispersas.
- Unificar headers, botones de acción y toggles.
- Normalizar espaciados verticales por pantalla.
- Definir checklist visual de PR (contrast, spacing, states, safe-area, keyboard).

**Impacto esperado:** salto inmediato de calidad percibida sin rehacer arquitectura.

## Fase 2 (3–5 semanas) — Jerarquía y narrativa

- Rediseñar Home con jerarquía de 3 niveles (hero > acciones > detalle).
- Rediseñar primer viewport de Analytics como “storyboard mensual”.
- Introducir módulo de prioridades (“Qué hacer hoy”).

**Impacto esperado:** más claridad de valor y mejor retención semanal.

## Fase 3 (4–6 semanas) — Exploración avanzada premium

- Drill-down analítico encadenado y reversible.
- Comparativas temporalmente inteligentes (vs mes anterior, promedio 3 meses, tendencia).
- Motion system completo + estados vacíos de alta calidad editorial.

**Impacto esperado:** percepción de producto “best-in-class” en su categoría.

---

## 6) Quick wins (alto impacto, baja complejidad)

1. Unificar todos los toggles a un único `SegmentedControl`.
2. Crear `ListRow` y migrar `Ultimos5` + `MovimientosGroupedList`.
3. Introducir “Top actions del mes” bajo el hero (2 CTAs máximo).
4. Reducir ruido visual en zonas secundarias (menos borde/menos variación de tamaño).
5. Añadir estado “sin datos” editorial por módulo (no solo texto plano).

---

## 7) Métricas UX para validar el rediseño

- **Time-to-insight (Home):** tiempo hasta identificar estado mensual principal.
- **Task success rate:** porcentaje que completa “registrar + corregir + revisar” sin salir del flujo.
- **Drill completion rate (Analytics):** usuarios que pasan de insight a movimiento concreto.
- **Weekly active usage de revisión:** sesiones de chequeo (no solo carga de gastos).
- **Perceived quality score (encuesta in-app):** “esta app se siente premium y clara”.

---

## 8) Conclusión

Gota ya tiene lo más difícil: **criterio visual, foco de producto y lenguaje propio**. Para llegar a top-tier no necesita reinventarse; necesita **sistematizar**. La oportunidad está en cerrar el gap entre una buena app funcional y una experiencia de excelencia: consistencia de componentes, jerarquía más intencional, exploración analítica fluida y motion refinado.

Si se ejecutan las tres fases propuestas, Gota puede posicionarse visual y experiencialmente al nivel de referencias premium, manteniendo su identidad serena y su enfoque práctico para finanzas personales.

---

## 9) Evidencia revisada en código/documentación

- Tokens, superficies, tipografía y utilidades visuales: `app/globals.css`.
- Dashboard shell y composición de Home: `components/dashboard/DashboardShell.tsx`.
- Hero financiero (`SaldoVivo`) y alternancia de modos: `components/dashboard/SaldoVivo.tsx`.
- Módulo de últimos movimientos: `components/dashboard/Ultimos5.tsx`.
- Barra de navegación inferior: `components/navigation/TabBar.tsx`.
- Flujos de Movimientos: `components/movimientos/MovimientosClient.tsx`, `components/movimientos/MovimientosGroupedList.tsx`, `components/movimientos/StripOperativo.tsx`.
- Flujo de Análisis: `components/analytics/AnalyticsDataLoader.tsx`, `components/analytics/AnalyticsClient.tsx`.
- Guías y lineamientos del sistema visual: `docs/design-system-final.md`, `docs/ui-product-upgrade-plan-2026-04-11.md`.
