# Plan de Implementación — Rediseño Config
**Gota · Claude Code · Quirúrgico y preciso**

---

## 0. Antes de tocar código — Auditoría inicial

Ejecutar estos comandos al abrir Claude Code para establecer el estado real del sistema:

```bash
# Mapear estructura de settings
find . -path ./node_modules -prune -o -name "*.tsx" -print | xargs grep -l "settings\|config\|Config" | grep -v node_modules

# Ver el archivo principal actual
cat src/app/settings/page.tsx

# Detectar qué tokens de color están en uso vs los del sistema
grep -rn "rgba\|#[0-9a-fA-F]" src/app/settings/ --include="*.tsx" | grep -v "//.*#"

# Ver si hay inline styles vs Tailwind
grep -rn "style={{" src/app/settings/ --include="*.tsx"

# Detectar imports de iconos (Lucide vs Phosphor)
grep -rn "from 'lucide-react'\|from '@phosphor-icons'" src/app/settings/ --include="*.tsx"

# Qué componentes comparte con el resto de la app
grep -rn "import" src/app/settings/page.tsx | grep -v node_modules
```

> **Parar aquí y leer el output completo antes de continuar.**

---

## 1. Análisis de riesgos detectados

### 🔴 Riesgo Alto

**R1 — Tokens hardcodeados en Settings**
El informe de deuda técnica confirma que Settings usa colores inline (`rgba`, `#hex`) en lugar de las variables del sistema. Cualquier cambio directo puede romper consistencia si no se reemplaza por tokens del sistema.

*Verificar con:*
```bash
grep -n "rgba\|#0b\|#050\|#38bdf\|#0f1c" src/app/settings/page.tsx
```

**R2 — Mezcla de Lucide + Phosphor**
Settings aún usa Lucide según el informe. Si agregamos nuevos íconos con Phosphor sin auditar los existentes, quedará inconsistente y con dos bundles de íconos cargando.

*Verificar con:*
```bash
grep -n "lucide\|phosphor" src/app/settings/page.tsx
```

**R3 — Estructura de componentes desconocida**
No sabemos si Settings es un monolito (`page.tsx` único) o si ya tiene subcomponentes (`CurrencySection`, `CardsSection`, etc.). Esto determina si trabajamos in-place o creamos archivos nuevos.

*Verificar con:*
```bash
ls -la src/app/settings/
ls -la src/components/ | grep -i "setting\|config\|card\|income"
```

---

### 🟡 Riesgo Medio

**R4 — Estado de Tarjetas**
La lógica de cierre de tarjeta es nueva (no existe hoy). Agregar un campo `closing_day` puede requerir migración de esquema en Supabase si las tarjetas se persisten en DB.

*Verificar con:*
```bash
# Ver estructura actual de cards en Supabase types
grep -n "card\|Card" src/types/ -r 2>/dev/null || grep -n "card\|Card" src/lib/ -r
```

**R5 — Sección Notificaciones**
Es una sección completamente nueva. Riesgo: crear UI sin backend de notificaciones listo. Se debe implementar como feature flag o con estado local primero, sin conectar a lógica real.

**R6 — Badge "vs mes anterior"**
Requiere acceso a los ingresos del mes previo. Si `IncomeSection` solo lee el mes actual, hay que agregar una query adicional. Puede afectar performance si no está cacheado.

---

### 🟢 Riesgo Bajo

**R7 — Tokens de color del sistema**
El sistema `T` del mockup usa los tokens exactos del informe. El riesgo es bajo siempre que se use `bg-bg-secondary`, `border-border-ocean`, etc. como clases Tailwind y no como valores inline.

---

## 2. Estructura de trabajo

### Archivos a tocar (estimado pre-auditoría)

```
src/app/settings/
├── page.tsx                    ← Archivo principal, EDITAR
└── components/                 ← Puede no existir, CREAR si es necesario
    ├── CurrencySection.tsx     ← Extraer o crear
    ├── CardsSection.tsx        ← Extraer o crear  
    ├── IncomeSection.tsx       ← Extraer o crear
    ├── NotificationsSection.tsx ← NUEVO
    └── AccountSection.tsx      ← Extraer o crear

src/components/ui/
└── Toggle.tsx                  ← Verificar si existe, si no CREAR
```

---

## 3. Fases de implementación

### Fase A — Auditoría y setup (sin tocar UI)
*Duración estimada: 1 sesión corta*

**A1. Mapear estado actual**
```bash
# Leer page.tsx completo
cat src/app/settings/page.tsx

# Ver tipos de Supabase para entender el modelo de datos
cat src/types/supabase.ts 2>/dev/null || cat src/types/database.ts 2>/dev/null

# Ver cómo se guardan las tarjetas hoy
grep -n "card\|Card\|tarjeta" src/app/settings/page.tsx
```

**A2. Confirmar tokens disponibles como clases Tailwind**
```bash
cat tailwind.config.ts
```
Verificar que existan: `bg-bg-primary`, `bg-bg-secondary`, `bg-bg-tertiary`, `border-border-ocean`, `text-text-primary`, `text-text-label`, `text-primary`, `text-success`, `text-warning`, `text-danger`.

Si no están como clases Tailwind → deben agregarse al config antes de usarlos.

**A3. Verificar Toggle existente**
```bash
find . -name "Toggle*" -not -path "*/node_modules/*"
grep -rn "Toggle\|toggle" src/components/ --include="*.tsx" | head -20
```

---

### Fase B — Cleanup de tokens (sin cambiar estructura)
*Duración estimada: 1 sesión*

> Solo reemplazar colores hardcodeados por tokens del sistema. No agregar features.

**B1. Reemplazar colores inline en Settings**

Instrucción para Claude Code:
```
Lee src/app/settings/page.tsx completo.
Reemplazá todos los valores de color inline (rgba, #hex) 
por las clases Tailwind del sistema Gota Glass.
No cambies ninguna lógica, solo los valores de estilo.
Mostrá un diff antes de aplicar.
```

**B2. Unificar iconografía**

```
En src/app/settings/page.tsx, identificá todos los íconos de lucide-react.
Para cada uno, encontrá el equivalente en @phosphor-icons/react con weight="duotone".
Reemplazalos uno por uno. Si no hay equivalente exacto, dejá una nota como comentario TODO.
```

**B3. Verificar border-radius**

Todos los cards → `rounded-[20px]` o la clase equivalente del sistema.
Todos los botones y pills → `rounded-full`.
Inputs → `rounded-xl` (equivalente a 12px).

---

### Fase C — Refactor de estructura
*Duración estimada: 1-2 sesiones*

> Extraer secciones a subcomponentes si page.tsx supera las 300 líneas.

**C1. Extraer Toggle a componente compartido** (si no existe)

```
Creá src/components/ui/Toggle.tsx.
Props: value: boolean, onChange: (v: boolean) => void, disabled?: boolean.
Debe usar los tokens del sistema: bg-primary para activo, bg-bg-elevated para inactivo.
Exportá como default.
```

**C2. Extraer secciones si es necesario**

Solo si page.tsx > 300 líneas. Orden sugerido:
1. `AccountSection` — más simple, sin estado complejo
2. `CurrencySection` — lógica mínima
3. `IncomeSection` — tiene más lógica, dejar para último

---

### Fase D — Features nuevas
*Duración estimada: 2-3 sesiones*

> Una feature por sesión. Orden de menor a mayor riesgo.

**D1. Cierre de tarjeta (input manual)**

Preguntar antes de implementar:
```bash
# ¿El campo closing_day existe en la tabla cards de Supabase?
grep -n "closing_day\|cierre\|close" src/types/supabase.ts 2>/dev/null
```

Si NO existe en el tipo → primero agregar la columna en Supabase y regenerar tipos:
```bash
npx supabase gen types typescript --local > src/types/supabase.ts
```

Luego implementar el input en `CardsSection`:
```
Agregá un input numérico (1-31) por tarjeta para el día de cierre.
Guardalo en Supabase en la columna closing_day de la tabla cards.
Mostrá un badge de "Cierra en Xd" debajo de cada tarjeta usando la misma lógica del mockup.
El badge debe ser warning (text-warning, bg-warning/10) si quedan 5 días o menos.
```

**D2. Badge comparación de ingresos**

```
En IncomeSection, al cargar los ingresos del mes actual,
hacé una segunda query para traer los ingresos del mes anterior.
Calculá el porcentaje de diferencia.
Mostrá un badge junto al label "Ingreso del mes":
- Verde (text-success, bg-success/10) si subió
- Rojo (text-danger, bg-danger/10) si bajó
- Oculto si no hay datos del mes anterior
```

**D3. Estado vacío de ingresos**

```
En IncomeSection, si ingresoARS === 0 y ingresoUSD === 0 para el mes seleccionado,
mostrá el estado vacío del mockup en lugar del formulario.
El botón "Cargar ingreso" dentro del estado vacío debe hacer scroll/focus al primer input.
```

**D4. Agregar tarjeta (formulario inline)**

```
En CardsSection, al final del acordeón, agregá el botón "+ Agregar tarjeta".
Al tocarlo, mostrá un formulario inline con: nombre, últimos 4 dígitos, día de cierre.
Al guardar, insertá en Supabase y actualizá el estado local sin recargar la página.
Al cancelar, cerrá el formulario sin guardar.
```

**D5. Sección Notificaciones (state local, sin backend)**

```
Creá una nueva sección "Notificaciones" en settings/page.tsx.
Usá el componente Toggle.
Dos toggles: "Recordatorio de gastos" y "Alerta de presupuesto".
Por ahora guardá el estado en localStorage con key "gota_notifications".
Marcá con un comentario TODO: conectar con sistema de push notifications.
```

---

### Fase E — QA y consistencia final
*Duración estimada: 1 sesión*

**E1. Checklist de tokens**
```bash
# Verificar que no quedaron colores hardcodeados
grep -n "rgba\|#[0-9a-fA-F]\{3,6\}" src/app/settings/ -r --include="*.tsx" | grep -v "//\|node_modules"
```

**E2. Checklist de iconografía**
```bash
grep -n "lucide-react" src/app/settings/ -r --include="*.tsx"
```
Resultado esperado: sin resultados (todos migrados a Phosphor).

**E3. Test visual en mobile**
- Verificar scroll sin que el TabBar tape contenido (padding-bottom correcto)
- Verificar que "Cerrar sesión" no queda cortado
- Verificar estados vacíos en meses sin datos

---

## 4. Instrucciones base para cada sesión en Claude Code

Pegar al inicio de cada sesión:

```
Estás trabajando en Gota, una app de finanzas personales para el mercado argentino.
Stack: Next.js + Supabase + Tailwind CSS + TypeScript.
Sistema de diseño: Gota Glass.

Tokens de color disponibles como clases Tailwind:
- Fondos: bg-bg-primary, bg-bg-secondary, bg-bg-tertiary, bg-bg-elevated
- Texto: text-text-primary, text-text-secondary, text-text-tertiary, text-text-label, text-text-dim
- Bordes: border-border-subtle, border-border-ocean, border-border-strong
- Acento: text-primary, bg-primary, bg-primary/[0.13]
- Estados: text-success/text-danger/text-warning con sus variantes /10 para fondos

Reglas de geometría:
- Cards: rounded-[20px] + border border-border-ocean + bg-bg-secondary
- Inputs: rounded-xl + bg-bg-tertiary + border border-border-ocean
- Botones/pills: rounded-full
- Labels de sección: text-[10px] font-semibold tracking-[0.18em] uppercase text-text-label

Antes de cualquier cambio: leé el archivo completo. Mostrá un diff antes de aplicar.
Hacé cambios quirúrgicos. No reformatees código que no tocás.
```

---

## 5. Orden de ejecución recomendado

| Sesión | Fase | Objetivo | Riesgo |
|--------|------|----------|--------|
| 1 | A completo | Auditoría, mapear estado real | Ninguno |
| 2 | B1 + B2 | Tokens + iconografía | Bajo |
| 3 | B3 + C1 | Border radius + Toggle component | Bajo |
| 4 | C2 (si aplica) | Extraer subcomponentes | Medio |
| 5 | D1 | Cierre de tarjeta | Medio (Supabase) |
| 6 | D2 + D3 | Badge ingresos + estado vacío | Bajo |
| 7 | D4 | Agregar tarjeta | Medio (Supabase) |
| 8 | D5 | Notificaciones (local) | Bajo |
| 9 | E completo | QA final | Ninguno |

---

## 6. Señales de alerta durante la implementación

Detener y revisar si Claude Code:
- Propone modificar `tailwind.config.ts` sin haberlo leído primero
- Sugiere crear nuevas tablas en Supabase sin mostrar la migración SQL
- Reemplaza más de 50 líneas de una vez sin mostrar diff
- Importa una librería nueva sin justificación
- Modifica archivos fuera de `src/app/settings/` sin aviso explícito
