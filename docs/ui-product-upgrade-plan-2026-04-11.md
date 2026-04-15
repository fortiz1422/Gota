# Gota — UI Product Upgrade Plan

**Fecha:** 2026-04-11
**Owner:** solo dev
**Estado:** draft activo — v2 (con review técnico)
**Objetivo:** elevar Gota desde una PWA prolija y funcional a un producto con presencia, consistencia y estándar visual de 2026, sin romper su esencia actual.

**Design system de referencia:** `docs/design-system-final.md` (v3.0 — Modo Fría, fuente de verdad vigente)

---

## 1. Resumen ejecutivo

Gota ya tiene una base visual propia: paleta fría, tono sereno, hero fuerte y foco en claridad. El problema actual no es falta de identidad sino falta de madurez de producto.

La app hoy mezcla:

- una idea visual clara
- un sistema light/glass que funciona a ratos
- patrones de composición todavía muy de MVP mobile-first

El upgrade no debe cambiar radicalmente el concepto. Debe **profesionalizarlo**.

### Lo que se mantiene

- hero como pieza central
- paleta fría y acento azul (`#2178A8`)
- sensación de calma y liviandad
- prioridad mobile-first
- tono sobrio, no fintech gritona
- DM Sans como fuente principal

### Lo que cambia

- menos look de PWA apilada
- menos glass homogéneo y decorativo — glass pasa a ser recurso puntual, no estilo global
- mejor jerarquía visual con sistema de superficies diferenciado
- sistema de shadows como herramienta primaria de elevación
- mejor ritmo entre bloques
- mejor percepción de calidad en navegación, estados, inputs y superficies
- componente Card unificado para toda la app

---

## 2. North star

**Dirección visual:** calma editorial + precisión financiera

La UI de Gota debería sentirse como:

- serena pero no blanda
- moderna pero no de moda
- premium pero no ostentosa
- clara para uso diario pero con suficiente densidad para transmitir valor

### Test de percepción

Si el rediseño va bien, la app debería empezar a transmitir:

- "entiendo dónde estoy parado"
- "esto está diseñado con intención"
- "puedo usarla todos los días sin cansancio"
- "esto ya no se ve como una app casera"

---

## 3. Principios de diseño

### 1. Lectura en 3 segundos

Cada pantalla debe dejar claro, sin esfuerzo:

- estado financiero principal
- acción principal
- próximo insight relevante

### 2. Calma con estructura

La interfaz no debe apoyarse solo en blur, transparencia o suavidad. Tiene que tener estructura visible, contraste útil y jerarquía firme. Las superficies sólidas son la base; el glass es el acento.

### 3. Módulos con propósito

Cada bloque debe caer en una de estas categorías:

- estado
- acción
- comparación
- detalle

Si un componente no cumple una de esas funciones con claridad, hay que simplificarlo o rehacerlo.

### 4. Una sola voz visual

Dashboard, analytics, movimientos, settings y onboarding tienen que parecer parte del mismo producto, no pantallas hechas en momentos distintos.

### 5. Premium por precisión, no por efectos

La sensación de producto top-tier tiene que venir de:

- spacing
- tipografía
- composición
- shadows y elevación con propósito
- motion sobrio
- consistencia

No de agregar recursos visuales de más.

---

## 4. Referencias top-tier

Estas referencias no se copian. Se usan para entender qué resuelve bien cada una.

### Copilot Money

**Qué hace bien**

- convierte info financiera en bloques fáciles de leer
- combina calidez visual con claridad
- hace que revisar movimientos y tendencias se sienta liviano

**Dónde mirar**

- dashboard
- cash flow
- revisión de transacciones
- suscripciones

**Aplicación a Gota**

- `SaldoVivo`
- `Ultimos5`
- resúmenes de mes
- módulos de revisión y mantenimiento

**Link:** https://www.copilot.money/

### Monarch

**Qué hace bien**

- excelente jerarquía en progreso mensual
- visualización de presupuesto clara y controlada
- bloques comparativos simples pero útiles

**Dónde mirar**

- budgeting
- monthly review
- forecast
- progress components

**Aplicación a Gota**

- `FiltroEstoico`
- analytics
- indicadores de avance del mes
- comparativas contra período anterior

**Link:** https://www.monarchmoney.com/features/budgeting

### Revolut

**Qué hace bien**

- analytics con drill-down
- comparativas por período
- filtros por tipo, categoría y ventana temporal

**Dónde mirar**

- analytics
- period switching
- breakdowns

**Aplicación a Gota**

- pantalla de analytics
- selector de período
- breakdown por categoría / medio / cuenta

**Link:** https://help.revolut.com/en-US/help/accounts/budget-and-analytics/how-can-i-see-my-spending-and-income-analytics/

### Mercury

**Qué hace bien**

- software financiero premium y sobrio
- densidad informativa sin caos
- paneles que inspiran confianza

**Dónde mirar**

- insights
- banking dashboard
- account views
- settings y configuraciones

**Aplicación a Gota**

- settings
- breakdowns
- instrumentos
- tarjetas
- vistas de cuenta

**Links:** https://mercury.com/insights , https://mercury.com/personal-banking

### Ramp

**Qué hace bien**

- módulos accionables muy claros
- estados operativos y prompts bien priorizados
- pantallas complejas con orden fuerte

**Dónde mirar**

- alerts
- approvals
- actionable modules
- spend management

**Aplicación a Gota**

- banners de recurrentes
- prompts de pago de tarjeta
- módulos de suscripciones
- estados accionables del dashboard

**Link:** https://ramp.com/products

### Linear

**Qué hace bien**

- precisión extrema en spacing, motion y densidad
- sensación de producto serio y contemporáneo
- navegación y sheets impecables

**Dónde mirar**

- navegación
- listas
- modales / sheets
- microinteracciones

**Aplicación a Gota**

- sheets y modales
- settings
- listas de movimientos
- motion general del sistema

**Links:** https://linear.app/homepage , https://linear.app/docs/my-issues

---

## 5. Diagnóstico actual de Gota

### Fuente de verdad

El design system vigente es `docs/design-system-final.md` (v3.0 — Modo Fría). Los tokens CSS en `app/globals.css` están sincronizados con este doc.

> **Nota:** `docs/gota-design-system.md` y `docs/design-system-audit-2026-03-03.md` son históricos (tema dark "Deep Ocean"). No usar como referencia.

### Fortalezas

- ya existe una identidad base con paleta fría coherente
- el hero (SaldoVivo) tiene potencial real de pieza flagship — glow contextual, animación de toggle, twin pills
- la paleta fría funciona con el tipo de producto
- la app se siente liviana y usable
- hay intención en typography y tokens — escala tipográfica completa de 10px a 42px
- design system doc actualizado y alineado con el código
- TabBar pill flotante con buen diseño base

### Debilidades

- **Glass homogéneo:** los 3 niveles (`glass-1/2/3`) comparten el mismo `rgba(255,255,255,0.38)` y solo varían en blur. Esto homogeniza superficies que deberían tener jerarquía distinta
- **Sin sistema de shadows:** toda la profundidad depende de blur. Las apps de referencia (Mercury, Linear, Monarch) usan shadows sutiles como herramienta primaria de elevación
- **No existe un componente Card reutilizable.** Cada card es Tailwind inline distinto — la consistencia es manual y frágil
- varias pantallas se sienten como bloques apilados (card stack)
- falta sensación de sistema entre home, analytics y settings
- algunos módulos accionables rompen la composición en lugar de integrarse
- deuda técnica de diseño pendiente (ver audit de marzo): `text-white` hardcodeado, rgba inline en varios componentes

### Riesgos si no se corrige

- la app puede verse correcta pero no memorable
- el producto puede parecer menos maduro de lo que realmente es
- a medida que crezcan features, la UI puede fragmentarse más
- sin Card component, cada nueva feature introduce su propia interpretación visual

---

## 6. Objetivos del upgrade

### Objetivos de negocio / percepción

- mejorar percepción de calidad del producto
- aumentar confianza visual
- lograr una identidad más sólida y vendible
- hacer que Gota se vea construida, no solo ensamblada

### Objetivos de UX

- lectura más rápida del estado mensual
- mejor orientación dentro de cada pantalla
- acciones principales más claras
- menor fatiga visual en uso diario

### Objetivos de sistema

- unificar foundations globales
- reducir inconsistencias entre pantallas
- establecer un lenguaje claro de superficies y densidad
- crear primitivas reutilizables (Card, shadows) que escalen con nuevas features

---

## 7. Decisiones visuales propuestas

### 7.1 Paleta

No cambiar la generalidad de colores. Sí ajustar su uso.

**Acción**

- conservar base fría actual (`#F0F4F8` canvas, `#2178A8` accent)
- mejorar separación entre fondo, panel base, panel elevado y overlay
- reservar color más intenso para acciones y estados realmente importantes
- resolver deuda de rgba inline: migrar a tokens del design system

### 7.2 Superficies — nuevo sistema de 3 capas

El glass actual debe pasar de "estilo global" a "recurso puntual". El problema específico: los 3 niveles de glass comparten `rgba(255,255,255,0.38)` y solo varían en blur — eso genera la homogeneidad.

**Nuevo sistema propuesto:**

| Capa | Nombre | Tratamiento | Uso |
|---|---|---|---|
| **Base** | `surface-base` | Sólido, sin blur. `#F0F4F8` o `#E6ECF2` | Cards de contenido principal, secciones |
| **Elevated** | `surface-elevated` | Semi-opaco (`rgba(255,255,255,0.65)`) + shadow sutil | Cards con acción, hero, módulos destacados |
| **Floating** | `surface-floating` | Glass real: blur + transparencia | Nav, sheets, SmartInput, overlays |

**Criterio:** si el usuario lee contenido → superficie sólida. Si el elemento flota sobre contenido → glass.

### 7.3 Shadows — sistema nuevo

Hoy no hay box-shadows en el sistema. Todo el depth viene de blur. Las apps de referencia usan shadows sutiles como herramienta primaria de elevación.

**Propuesta de 3 niveles con tinte frío:**

| Token | Valor | Uso |
|---|---|---|
| `shadow-sm` | `0 1px 3px rgba(13,24,41,0.06)` | Cards base, inputs con foco |
| `shadow-md` | `0 4px 12px rgba(13,24,41,0.08)` | Cards elevadas, hero |
| `shadow-lg` | `0 8px 30px rgba(13,24,41,0.12)` | Sheets, modales, SmartInput |

El tinte usa `#0D1829` (text-primary) para mantener coherencia fría. Esto es lo que hace que shadows se sientan "del sistema" en vez de genéricas.

### 7.4 Tipografía

La tipografía tiene buena base pero necesita más jerarquía editorial.

**Acción**

- mantener `DM Sans`
- revisar pesos repetidos (600 aparece en micro, label, body-lg — ¿es intencional?)
- dar más aire entre label, title, amount y supporting text
- mejorar consistencia de uppercase labels
- considerar agregar un nivel `type-body-sm` (12-13px) que hoy se resuelve con clases ad-hoc

### 7.5 Spacing y composición

Hoy hay componentes correctos, pero falta ritmo.

**Acción**

- ordenar la home por prioridad cognitiva: estado → acción → detalle → mantenimiento
- reducir sensación de card stack — no todo necesita ser card
- construir grupos más claros entre hero, acción primaria y módulos secundarios
- estandarizar gaps entre secciones (hoy es 24px global, podría necesitar variación intencional)

### 7.6 Motion

Motion más sobrio y útil.

**Acción**

- transiciones cortas (150-250ms para UI, 300ms para sheets)
- easing consistente: `cubic-bezier(0.4, 0, 0.2, 1)` para entradas, `cubic-bezier(0.4, 0, 1, 1)` para salidas
- menos efecto cosmético, más feedback de estado
- estandarizar en globals.css como tokens de motion

### 7.7 Componente Card unificado

Hoy no existe un componente reutilizable — cada card es Tailwind inline.

**Propuesta:**

Crear `components/ui/Card.tsx` con variants:

| Variant | Superficie | Shadow | Uso |
|---|---|---|---|
| `base` | `surface-base` | `shadow-sm` | FiltroEstoico, Ultimos5, secciones de contenido |
| `elevated` | `surface-elevated` | `shadow-md` | SaldoVivo, módulos destacados |
| `floating` | `surface-floating` (glass) | `shadow-lg` | SmartInput, sheets (si aplica) |
| `ghost` | transparente, sin borde | ninguna | Agrupadores sin contenedor visual |

Esto centraliza la gramática visual y garantiza que toda nueva feature use el mismo lenguaje.

---

## 8. Intervenciones por área

### Dashboard / Home

**Objetivo:** convertirlo en la pantalla flagship del producto.

**Cambios deseados**

- header con más autoridad visual
- hero más refinado: mantener glow pero integrar con shadow system
- SmartInput como gesto central del producto — mantener glass pero agregar shadow de anclaje
- orden claro entre estado, acción y módulos de mantenimiento
- cards migradas al componente Card unificado
- mejorar gradient / fade del sector inferior fijo

**Componentes foco**

- `components/dashboard/DashboardShell.tsx`
- `components/dashboard/DashboardHeader.tsx`
- `components/dashboard/SaldoVivo.tsx`
- `components/dashboard/SmartInput.tsx`
- `components/dashboard/FiltroEstoico.tsx`
- `components/dashboard/Ultimos5.tsx`

### Analytics

**Objetivo:** que se sienta como lectura inteligente del mes, no como pantalla aislada.

**Cambios deseados**

- mejor entrada visual a los insights
- comparativas más claras
- charts y breakdowns con más jerarquía
- filtros y cambio de período mejor integrados
- migrar cards al componente unificado
- resolver colores SVG hardcodeados donde sea posible

### Movimientos

**Objetivo:** más precisión operativa, menos lista genérica.

**Cambios deseados**

- densidad visual más cuidada
- filas mejor compuestas
- filtros con mejor presencia
- edición y revisión con menos fricción visual
- bottom sheet de edición alineada al nuevo sistema de superficies

### Settings

**Objetivo:** que se sienta premium, confiable y ordenado.

**Cambios deseados**

- layouts más sobrios
- mejor separación entre grupos
- más claridad en acciones sensibles
- migrar a Card component con variant `base`

### Onboarding

**Objetivo:** prometer exactamente el producto que luego se encuentra.

> **Nota:** El onboarding wizard (W1-W8) se construyó recientemente. Debe alinearse al design system **después** de que las foundations estén definidas (Fase 3), para evitar doble trabajo.

**Cambios deseados**

- consistencia total con la UI principal
- narrativa visual más fuerte
- pasos más refinados

---

## 9. Roadmap por fases

### Fase 1A — Tokens & Foundations

**Impacto:** muy alto (habilita todo lo demás)
**Riesgo:** bajo (puro CSS + un componente nuevo, zero cambio funcional)

**Alcance**

- [ ] Definir nuevo sistema de superficies en `globals.css` (`surface-base`, `surface-elevated`, `surface-floating`)
- [ ] Agregar sistema de shadows (`shadow-sm`, `shadow-md`, `shadow-lg`) con tinte frío
- [ ] Revisar pesos tipográficos redundantes, agregar `type-body-sm` si se confirma necesidad
- [ ] Estandarizar motion tokens en globals.css
- [ ] Crear componente `Card` unificado (`components/ui/Card.tsx`) con variants `base`, `elevated`, `floating`, `ghost`
- [ ] Resolver deuda técnica de diseño prioritaria: rgba inline → tokens, `text-white` → `text-bg-primary`
- [ ] Actualizar `docs/design-system-final.md` con los nuevos tokens

**Resultado esperado**

La infraestructura visual está lista para que los componentes la consuman. Ningún cambio visual todavía — solo foundations.

### Fase 1B — Dashboard flagship

**Impacto:** muy alto (primera pantalla que ve el usuario)
**Riesgo:** bajo a medio

**Alcance**

- [ ] `DashboardShell`: aplicar nuevas superficies, ajustar spacing
- [ ] `SaldoVivo`: integrar con shadow system, refinar glow + elevación
- [ ] `SmartInput`: mantener glass (`surface-floating`) + agregar `shadow-lg` de anclaje
- [ ] `FiltroEstoico`: migrar a Card `base`
- [ ] `Ultimos5`: migrar a Card `base`, revisar densidad de filas
- [ ] `DashboardHeader`: evaluar más autoridad visual
- [ ] Mejorar gradient/fade del sector inferior fijo
- [ ] Evaluar estado de navegación (TabBar) — ¿necesita ajustes para sentirse "app real"?

**Resultado esperado**

El dashboard se siente claramente más premium sin cambiar su ADN. La jerarquía entre hero, acción y módulos es evidente.

### Fase 2 — Consistencia de producto

**Impacto:** alto
**Riesgo:** medio

**Alcance**

- [ ] Analytics: migrar a Card system, mejorar jerarquía de insights
- [ ] Analytics: mejorar selector de período, refinar charts
- [ ] Movimientos: mejorar composición de filas, refinar filtros
- [ ] Movimientos: unificar edición/expansión con nuevo sistema de superficies
- [ ] Settings: migrar secciones a Card `base`, mejorar grupos
- [ ] Settings: refinar acciones destructivas y sensibles
- [ ] Sheets y modales: unificar visual con `surface-floating` + `shadow-lg`
- [ ] Banners y prompts accionables: alinear al sistema

**Resultado esperado**

La app completa pasa a sentirse como un solo sistema. Todas las pantallas usan la misma gramática de superficies.

### Fase 3 — Polish y percepción top-tier

**Impacto:** medio
**Riesgo:** bajo

**Alcance**

- [ ] Onboarding: alinear W1-W8 con el lenguaje visual final
- [ ] Onboarding: mejorar progresión visual y narrativa
- [ ] Mejorar skeletons con nuevo sistema de superficies
- [ ] Diseñar empty states intencionales (reemplazar emoji `📭`)
- [ ] Motion system: implementar tokens de timing/easing consistentes
- [ ] Feedback states: loading, success, error con animación sobria
- [ ] Microcopy visual y labels
- [ ] Refinamiento fino de spacing y opacidades

**Resultado esperado**

Sube la sensación de craft y se elimina el olor a MVP. El onboarding promete exactamente el producto que se encuentra.

---

## 10. Criterios de aceptación

El upgrade va bien si:

- el dashboard se siente más claro sin perder calma
- el hero sigue siendo reconocible pero se ve más premium
- la app conserva su familia cromática y su identidad
- las pantallas principales parecen del mismo producto
- la percepción general sube sin introducir ruido visual
- la interfaz se ve más diseñada incluso antes de notar cambios funcionales
- hay un sistema de elevación claro: base < elevated < floating
- el componente Card se usa consistentemente en toda la app
- las nuevas features futuras tienen primitivas claras para construir sobre ellas

---

## 11. No objetivos

Esto no busca:

- cambiar radicalmente la marca
- pasar a dark mode como identidad principal
- rehacer toda la navegación de la app desde cero
- volver la UI más compleja porque sí
- copiar el estilo visual de otra app
- agregar animaciones o efectos por estética

---

## 12. Deuda técnica a resolver durante el upgrade

Identificada en el audit de marzo, pendiente de resolución:

| Componente | Issue | Resolver en |
|---|---|---|
| `ParsePreview` | `text-white` hardcodeado en botones → `text-bg-primary` | Fase 1A |
| `ParsePreview` | `hover:bg-[rgba(...)]` → `hover:bg-surface` | Fase 1A |
| `Modal.tsx` | `border-[rgba(148,210,255,0.10)]` → `border-border-ocean` | Fase 2 |
| `analytics/page.tsx` | CSV link con rgba inline → tokens | Fase 2 |
| Varios componentes | Íconos Lucide mezclados con Phosphor | Fase 3 (baja prioridad) |
| `MonthlyTrends` | Colores SVG hardcodeados | Aceptar (limitación SVG) |

---

## 13. Próximo paso

Ejecutar **Fase 1A — Tokens & Foundations**:

1. Definir tokens de superficies y shadows en `globals.css`
2. Crear componente `Card` con variants
3. Resolver deuda técnica de tokens prioritaria
4. Actualizar `design-system-final.md`
5. Verificar visualmente que nada se rompe (los tokens nuevos son aditivos)

Después de 1A, pasar a **Fase 1B** con el dashboard como primer consumidor del nuevo sistema.
