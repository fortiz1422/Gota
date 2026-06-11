# Gota — Entry screen revamp · Handoff

**Fecha:** 2026-06-11
**Alcance:** solo la pantalla de entrada / landing-auth mobile (`app/(auth)/login`). Exploración high-fidelity pre-handoff. No toca código productivo.

---

## 1. Archivos inspeccionados

Pantalla actual:
- `app/(auth)/login/page.tsx` — server component, redirect si hay sesión, delega en `LoginButton`
- `app/(auth)/login/LoginButton.tsx` — toda la UI: splash, email, OTP, explore (4 sub-pantallas client-side)
- `lib/auth.ts` — `signInWithGoogle`, `sendOtpEmail`, `verifyOtpToken`, `signInAnonymously`, upgrade anónimo

Flujos relacionados:
- `app/auth/callback/route.ts`, `app/auth/create-password/page.tsx`
- `components/AnonymousBanner.tsx`, `components/auth/AnonymousAccountUpgradeSheet.tsx`
- `lib/product-analytics/events.ts` (eventos existentes: `anonymous_banner_seen`, `anonymous_link_*`)

Sistema visual (source of truth):
- `docs/design-system-final.md` (v4.0 Fría vNext + Strategy 5) + `app/globals.css` (tokens reales)
- `components/ui/BlueHeaderZone.tsx`, `components/dashboard/DashboardShell.tsx`,
  `components/dashboard/SaldoVivo.tsx`, `components/dashboard/DashboardHeader.tsx`,
  `components/movimientos/MovimientosClient.tsx`, `components/analytics/AnalyticsClient.tsx`
- `docs/docs-status-index.md`, `docs/design-docs-audit-2026-06-11.md` (qué docs son DNU)
- `docs/gota-landing-login.jsx` ignorado como fuente visual (DNU).

---

## 2. Diagnóstico de la pantalla actual

1. **Jerarquía visual.** Wordmark 52px, card de preview pesada y CTA zone densa compiten; el `flex-1` deja un vacío arbitrario en el medio en pantallas altas. La pantalla no decide qué es lo más importante.
2. **Branding / preview / acceso.** Tres bloques desconectados. El preview no es el producto real: en el Home actual el Saldo Vivo vive **blanco sobre el blue-zone** y la card que overlapea es "Disponible real". El preview actual invierte esa semántica (saldo dentro de card blanca), así que no genera el reconocimiento "esto es lo que voy a ver adentro".
3. **Framing de valor.** "Tu plata, clara." es buena pero queda sola; nada explica qué es Saldo Vivo ni por qué crear cuenta. El monto animado a USD 14.788 sin etiqueta de ejemplo roza el "humo" que la app evita.
4. **Densidad / ritmo.** Top pesado → medio hueco → bottom denso (3 CTAs + divider + legal apretados).
5. **Copy.** El ícono fantasma en "Explorar sin cuenta" desentona con la seriedad; el legal usa color de link sin ser link; USD-first es menos local que ARS-first.
6. **Sensación de producto.** Competente pero commodity: CTA primario oscuro `#0D1829` (el sistema usa `primary #2178A8`), radios 14/20px fuera de tokens (12/18), sombra custom, SVG inline en vez de Phosphor, dot-grid que no existe en ninguna otra pantalla.
7. **Consistencia S5.** Overlap `-28px` (el sistema fija `-24`), card no es `card-s5`, sheet `bg-bg-primary` blanca sobre blanco (el radio del sheet es invisible salvo sobre el azul).

**Qué preservar:** estructura blue-zone + contenido, tagline, los 3 caminos de acceso (Google / email OTP / anónimo), la honestidad del modo exploración (lista puede/no puede), sobriedad general, OTP de 6 dígitos con auto-focus.

---

## 3. Las tres direcciones

### Option A — Conservative · "Misma tesis, mejor ejecutada"
- **Qué cambia:** todo alineado a tokens S5 (`card-s5`, overlap −24, radius 12, sombras del sistema), preview etiquetado **"Ejemplo"**, hero en ARS, card de preview anclada al hero por overlap (mitad azul, mitad blanca), framing line única bajo la card, sublabel honesto bajo "Explorar sin cuenta", dot-grid eliminado.
- **Qué optimiza:** craft, consistencia, confianza. **Qué conserva:** la tesis completa (marca grande → preview → acceso), CTA oscuro, flujo email como pantalla aparte.
- **Por qué:** riesgo cero; es la pantalla actual "bien terminada".
- **Tradeoff:** sigue siendo la misma idea; gana pulido pero no memorabilidad.

### Option B — Strong-fit · "La entrada ES el producto" ★ recomendada
- **Qué cambia:** la pantalla adopta la composición exacta del Home real: Saldo Vivo **blanco sobre blue-zone** (type-hero 40px, eye toggle funcional, breakdown ARS|USD), chip header-glass "Así se ve tu mes · ejemplo", card `card-s5` de Disponible real con overlap −24 idéntica a la del Home, una sola línea de framing, y bloque de acceso con jerarquía franca: Google primario azul (`primary`, como manda el sistema), email **expande inline** (sin pantalla intermedia), explorar como acción terciaria con sublabel honesto. Modo exploración condensado en bottom sheet. Con teclado, el hero colapsa a fila compacta.
- **Qué optimiza:** integración total preview↔producto (el día 1 dentro de la app se ve *igual* que la promesa), confianza antes del login, menos pasos para email, jerarquía de CTA inequívoca.
- **Qué conserva:** sobriedad, tagline implícita en el framing, los 3 caminos, la honestidad del modo anónimo.
- **Por qué:** es la versión que más usa la identidad propia de Gota (S5 es su firma visual) sin agregar nada de marketing. La marca entra chica y segura — señal top-level.
- **Tradeoff:** wordmark menos protagonista; exige que el dato demo esté inequívocamente marcado como ejemplo; blue-zone más alto deja menos blanco.

### Option C — Divergent · "Demo viva, explore-first"
- **Qué cambia la tesis:** la pantalla no muestra un estado, **demuestra el gesto central**: una demo auto-reproducida del SmartInput ("café 2500 con amigos" se tipea → se parsea a gasto con categoría/Deseo → el Saldo Vivo baja). El CTA primario pasa a ser **"Probar Gota ahora"** (sesión anónima — infra ya existente: `signInAnonymously` + banner + upgrade sheet); Google y email quedan en segundo nivel.
- **Qué optimiza:** activación y diferenciación (el SmartInput es lo único que ningún competidor AR muestra así); time-to-valor percibido casi cero.
- **Qué conserva:** estructura S5, surface-glass reservado al SmartInput (regla del sistema), sin features inventadas — la demo usa el ejemplo canónico del PRD.
- **Tradeoff:** menos signups directos (cuentas anónimas a convertir después), una animación que mantener, y el riesgo de que la demo se sienta gimmick si no queda clarísimo el chip "Demo".

**Recomendación: B.** Y hay un híbrido barato si C tienta: B + demo de SmartInput como segunda card debajo de Disponible real (B ya deja el slot).

---

## 4. Slices / componentes sugeridos (para Next.js + Tailwind)

Todo dentro de `app/(auth)/login/` (la pantalla es route-specific; no contaminar `components/`):

| Componente | Responsabilidad | Estados |
|---|---|---|
| `EntryHero` | blue-zone + statusbar safe-area + wordmark + (B: SaldoVivo demo) | `default`, `compact` (teclado) |
| `DemoSaldoCard` | card-s5 Disponible real con datos hardcodeados de ejemplo | `visible`, `masked` (eye) |
| `AccessBlock` | stack de CTAs + legal, sticky bottom con blur | `idle`, `googleLoading`, `emailOpen`, `error`, `anonLoading` |
| `EmailInlinePanel` (B/C) | input + helper + enviar código + sent/error | `closed`, `open`, `sending`, `sent`, `error` |
| `OtpStep` | reutilizar el actual (ya está bien resuelto) | sin cambios de lógica |
| `ExploreSheet` (B) | bottom sheet con copy condensado puede/no-puede | `closed`, `open`, `entering` |
| (C) `SmartInputDemo` | typing + parse + saldo tick + replay | `playing`, `done`, `reduced-motion: estado final estático` |

Lógica de auth: **sin cambios** — se sigue usando `signInWithGoogle`, `sendOtpEmail`, `verifyOtpToken`, `signInAnonymously` de `lib/auth.ts`. El flujo OTP y el redirect `isNew → /onboarding` se conservan tal cual.

## 5. Decisiones de jerarquía

- Un solo elemento hero por pantalla: en B es el número de Saldo Vivo (no la marca).
- CTA primario = `bg-primary #2178A8` (regla del sistema: primary para interacción). El botón oscuro `#0D1829` solo sobrevive en A por continuidad.
- Email es secundario (white + border), explorar es terciario (texto + sublabel). Nunca tres botones del mismo peso.
- El dato de ejemplo siempre lleva etiqueta visible ("Ejemplo" / "Demo") — innegociable para no romper la regla "sin humo".
- Legal al fondo, 11px, links en `primary` con peso 500.

## 6. Spacing / density

- Overlap blue-zone → card: **−24px fijo** (regla S5, el actual usa −28 y hay que corregirlo).
- Padding horizontal de contenido: 22px (igual que Home). CTA zone: 20px.
- Gap entre CTAs: 10px; padding vertical de botón: 15px; radius botón: 12px; card: 18px.
- Aire intencional entre framing y acceso (no `flex-1` ciego): el bloque de acceso es sticky bottom con `backdrop-blur` y `border-t rgba(13,24,41,0.06)`, el medio respira.
- Safe areas: `env(safe-area-inset-top)` en blue-zone, `env(safe-area-inset-bottom) + 20px` en CTA zone.

## 7. Responsive / teclado

- Viewport corto o teclado abierto (`visualViewport`, patrón ya usado en `DashboardShell`): hero colapsa a fila compacta (label + monto chico en una línea), framing y card demo se ocultan, panel de email queda pegado sobre el teclado.
- ≥ 768px (desktop accidental): centrar la columna a `max-w-md` igual que el resto de la app; no hay layout desktop dedicado.
- `prefers-reduced-motion`: counter y typing demo saltan al estado final (globals.css ya anula animaciones).

## 8. Core vs accesorio

**Core (no negociable al implementar):**
- Composición blue-zone + overlap −24 + card-s5
- Jerarquía de 3 CTAs y email inline (en B)
- Etiqueta de ejemplo en datos demo
- Estados loading/error/sent del acceso

**Accesorio (recortable sin romper la dirección):**
- Counter animado del saldo
- Eye toggle en el demo
- Animación de typing (C) — puede ser estática
- Chip "Así se ve tu mes" puede reducirse a "Ejemplo"

## 9. Riesgos / decisiones de implementación

- **Dato demo vs dato real:** si el usuario ya tuvo sesión anónima, considerar no mostrar demo sino su dato real (futuro; hoy `page.tsx` redirige si hay user).
- **`linkGoogleAccount` vs `signInWithGoogle`:** la entry usa `signInWithGoogle` (sin sesión previa). No tocar.
- **Tracking:** hoy no existe ningún evento de login screen en `events.ts`. Sugeridos: `login_screen_seen`, `login_method_selected {method}`, `login_otp_sent`, `login_anonymous_entered`. Requiere ampliar `PRODUCT_EVENT_NAMES`.
- **Sticky CTA + blur:** verificar en iOS Safari real (backdrop-filter dentro de contenedor con overflow).
- **OTP:** mantener la pantalla dedicada actual; solo re-skinear hero compacto.
- **Accesibilidad:** labels reales en inputs (el prototipo usa placeholder-only en B/C — corregir al integrar), `aria-expanded` en el toggle de email.

## 10. Qué tocar para integrar (cuando se elija dirección)

1. `app/(auth)/login/LoginButton.tsx` — refactor en slices de la sección 4 (mismo archivo o subcarpeta `app/(auth)/login/components/`).
2. `lib/product-analytics/events.ts` — agregar eventos de login (opcional pero recomendado).
3. Nada más: ni `lib/auth.ts`, ni callback, ni middleware, ni globals.css (todos los estilos salen de utilities existentes: `blue-zone`, `header-glass`, `card-s5`, `type-label`, `type-hero`).
4. Iconos: reemplazar los SVG inline del prototipo por Phosphor Light (`Wallet`, `EnvelopeSimple`, `Eye/EyeSlash`, `CaretDown`, `Microphone`, `ArrowCounterClockwise`).

---

## 11. Cómo revisar el prototipo

Abrir `index.html` en Chrome (doble click alcanza; no necesita server).

- Tabs **A / B / C** arriba cambian de dirección; los pills cambian de estado.
- Los botones **dentro del teléfono** también navegan (Google simula loading, email expande/navega, input enfocado abre teclado simulado, OTP acepta dígitos).
- Deep-link por URL: `index.html?variant=b&state=email` — estados válidos:
  - A: `inicial, cargando, email, teclado, error, codigo, explorar`
  - B: `inicial, email, cargando, error, explorar, teclado`
  - C: `demo, email, cargando, error, teclado`
- `&shot=1` oculta el toolbar para captura limpia.

## 12. Screenshots

Ya exportados (Chrome 470×950, DPR 1):

- `screenshots/option-a-inicial.png` — A estado inicial
- `screenshots/option-b-inicial.png` — B estado inicial ★
- `screenshots/option-b-email-inline.png` — B con email expandido
- `screenshots/option-b-teclado.png` — B compacto con teclado
- `screenshots/option-c-demo.png` — C con demo completada

Para recapturar manualmente: abrir la URL con `?variant=X&state=Y&shot=1`, ventana ~470×950, y capturar la zona del teléfono. Estados faltantes que conviene mirar en vivo (animados): C `demo` desde cero, B `explorar` (bottom sheet), A `cargando`.
