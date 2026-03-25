# Gota — Product Requirements Document v3.0

**Versión:** 3.0 (Post-Interrogación) · actualizado post-MVP
**Fecha:** 3 Febrero 2026 · revisado Febrero 2026
**Status:** ✅ MVP Completo — deployado en producción

---

## 1. PROBLEM STATEMENT

Los argentinos carecen de visibilidad real sobre sus gastos personales debido a:

1. **Fricción en el registro:** Apps tradicionales requieren múltiples pasos (abrir app → seleccionar categoría → ingresar monto → elegir método de pago → confirmar)
2. **Falta de validación:** No hay forma objetiva de saber si registraste TODOS tus gastos
3. **Sin feedback inmediato:** Registrar gastos genera culpa en vez de valor (solo números que crecen)

**Resultado:** Abandono en 2 semanas.

**Solución Gota:**

- 1 campo de texto + AI = registro en 5 segundos
- Saldo Vivo = validación objetiva contra banco real
- Filtro Estoico = insight filosófico inmediato

---

## 2. THREE PILLARS

### Pilar 1: Fricción = 0

Un campo de texto. Una línea. Un tap.

Input: `"café 2500 con amigos"`  
→ Gasto registrado con categoría, fecha, need/want inferidos.

### Pilar 2: Immediate Value

Cada registro muestra cambios visuales inmediatos:

- Saldo Vivo se actualiza
- Ratio necesidad/deseo cambia
- Top 3 categorías se recalcula

### Pilar 3: Saldo Vivo = Trust Engine

```
Ingresos del mes:        $1.000.000
Gastos percibidos:         -$350.000
Pago de tarjetas:          -$450.000
─────────────────────────────────────
Disponible:                $200.000 ✓
```

Si matchea tu banco → confiás en los datos → seguís usando.

---

## 3. CORE MVP FEATURES

### Feature #1: Smart Input (P0)

**Descripción:**  
Campo de texto único que acepta lenguaje natural y parsea con AI.

**Comportamiento:**

```
Input: "café 2500 con amigos"
↓ [Gemini API ~1-2s]
Output: {
  amount: 2500,
  currency: "ARS",
  category: "Restaurantes",
  description: "Café con amigos",
  is_want: true,
  payment_method: "CASH",
  card_id: null,
  date: "2026-02-03T10:00:00-03:00"
}
```

**Keywords reconocidos:**

- **Moneda:** "dólares", "USD", "usd" → USD (default: ARS)
- **Payment:** "efectivo"/"cash" → CASH, "débito" → DEBIT, "transferencia" → TRANSFER, "tarjeta"/"crédito" → CREDIT
- **Tarjetas:** "BBVA VISA", "BBVA MÁSTER", "BNA" → card_id correspondiente
- **Fechas:** "ayer", "anteayer", "el viernes pasado", "el 15 de enero", "el 20/1"
- **Categorías:** Por keywords contextuales (ej: "super", "nafta", "uber")

**Smart date parsing:**

- Sin mención → "hoy" (default)
- "ayer" → -1 día
- "el 15" (sin mes) → asume mes actual si no pasó, mes anterior si pasó
- "el 15 de enero" → Jan 15, 2026
- **Fechas futuras:** Parser detecta → warning en ParsePreview pero permite guardar

**Hint contextual:**

- Si estás viendo mes pasado (← Enero) → muestra arriba del input:  
  `"ⓘ Se registrará en Feb 2026"`
- El gasto se registra en mes ACTUAL, no en el que estás navegando
- Usuario puede cambiar fecha manualmente en ParsePreview

**Validaciones:**

- Input vacío → botón "Agregar" disabled
- Si bypass → Alert: "Escribí algo primero"

**Error handling:**

- API fail/timeout → Alert: "Error al procesar. Intentá de nuevo."
- Rate limit (429) → Alert: "Límite alcanzado. Intentá en 1min."
- Invalid input ("hola") → `{is_valid: false, reason: "..."}` → Alert con reason

**Múltiples gastos:**

- Input: "café 2500 y netflix 50 dólares"
- Gemini parsea → array de 2 gastos
- Frontend muestra 2 ParsePreview modals secuenciales

---

### Feature #2: ParsePreview (P0)

**Descripción:**  
Pantalla de confirmación que aparece SIEMPRE antes de guardar (review-first mandatorio).

**¿Cuándo aparece?**

- ✅ Input válido → **SIEMPRE** (aunque todo esté perfecto)
- ❌ `is_valid: false` → NO aparece, muestra Alert con reason

**Filosofía:**  
"Categorización correcta > velocidad percibida"

Usuario prefiere 2 segundos extra para validar que datos incorrectos que rompen confianza.

**Layout (Opción A - Vertical Stack):**

```
╔═════════════════════════════════════╗
║ [handle bar] ────                   ║
║                                     ║
║ Confirmar gasto                     ║
║ Revisá los datos antes de guardar   ║
║                                     ║
║ ┌─────────────────────────────────┐ ║
║ │ MONTO                           │ ║
║ │ [$ 2500]                        │ ║ ← editable, inputMode="decimal"
║ │ [ARS ▼]                         │ ║ ← toggle ARS/USD
║ └─────────────────────────────────┘ ║
║                                     ║
║ CATEGORÍA                           ║
║ [🍔 Restaurantes              ▼]    ║
║                                     ║
║ MEDIO DE PAGO                       ║
║ [💵 Efectivo                  ▼]    ║
║                                     ║
║ FECHA                               ║
║ [📅 3 Febrero 2026            ▼]    ║
║                                     ║
║ ¿NECESIDAD O DESEO?                 ║
║ [✓ Necesidad] [  Deseo]             ║
║                                     ║
║ [Guardar gasto ✓]                   ║ ← Primary CTA
║ [Cancelar]                          ║ ← Ghost button
╚═════════════════════════════════════╝
```

**Campos editables:**

- Monto (required)
- Moneda (toggle ARS/USD)
- Categoría (selector 20 opciones + "Pago de Tarjetas")
- Medio de pago (CASH/DEBIT/TRANSFER/CREDIT)
- Tarjeta (condicional: solo visible si payment_method = CREDIT)
- Necesidad/Deseo (toggle binario)
- Fecha (date picker)
- ❌ Descripción (NO editable, mantiene simplicidad)

**Validaciones:**

- **Categoría required:** Si null → campo marcado requerido
- **Tarjeta required cuando CREDIT:**
  - Si payment_method = CREDIT y card_id = null
  - Campo resaltado en ROJO
  - Botón "Guardar" DISABLED
  - Mensaje: "Seleccioná una tarjeta"
- **Tarjeta desconocida:**
  - Input: "netflix con Santander"
  - Parser devuelve card_id no reconocido
  - Error: "⚠️ Tarjeta no reconocida, seleccioná una válida"
  - Usuario debe elegir entre las 3 hardcoded

**Caso especial: "Pago de Tarjetas"**

- NO muestra toggle Necesidad/Deseo (campo oculto completamente)
- `is_want` se guarda como NULL en DB
- Validaciones extra:
  - card_id REQUIRED
  - payment_method NO puede ser CREDIT (constraint SQL)

**Interacción:**

- Tap en campo → editable
- Cancelar → cierra modal, descarta todo
- Guardar → valida → guarda en DB → cierra modal → limpia input

**Después de guardar:**

- Input se limpia automáticamente
- Dashboard actualiza en tiempo real
- Listo para siguiente gasto (friction = 0)

---

### Feature #3: Dashboard Minimalista (P0)

**Layout integrado (single scroll):**

```
┌─────────────────────────────────────┐
│ ← Febrero 2026 →        [⚙]         │ ← Header fijo
├─────────────────────────────────────┤
│ [café 2500____________] [▶]         │ ← Smart Input fijo
├─────────────────────────────────────┤
│                                     │
│ [Saldo Vivo Card]          ← Hero  │
│ [Gastos con tarjeta]               │
│ [Filtro Estoico]                   │
│ [Top 3 Categorías]                 │
│ [Últimos 5 Gastos]                 │
│                                     │
└─────────────────────────────────────┘
```

**Altura total:** ~730px = 1.1 scrolls en iPhone (acceptable)

#### A. Header con Navegación de Período

```
← Febrero 2026 →        [⚙]
```

**Comportamiento:**

- `←` navega a mes anterior (disabled si estás 12 meses atrás)
- `→` navega a mes siguiente (disabled si estás en mes actual)
- Tap en "Febrero 2026" → month picker (lista vertical scrolleable)
- `[⚙]` abre Settings (modal overlay)

**Límites:**

- Máximo 12 meses atrás
- Permite meses futuros (útil para planning)

**Recarga:**

- Cambiar período → recarga COMPLETA (loading skeleton en todo)

#### B. Saldo Vivo (Hero Component)

```
┌─────────────────────────────────────┐
│ 💰 Saldo del Mes (ARS)              │
│                                     │
│ Ingresos del mes:       $1.000.000  │ ← tap aquí para editar
│ Gastos percibidos:        -$350.000 │
│ Pago de tarjetas:         -$450.000 │
│ ─────────────────────────────────── │
│ Disponible:               $200.000  │
│ ✓ Verificado 10 feb                 │ ← badge (resetea con cambios)
│                                     │
│ [████████░░░░░░░░] 20% restante     │
└─────────────────────────────────────┘
```

**Fórmula:**

```
Disponible = Ingresos - (Gastos percibidos + Pago de tarjetas)

Donde:
- Gastos percibidos = SUM(expenses WHERE payment_method IN (CASH, DEBIT, TRANSFER))
- Pago de tarjetas = SUM(expenses WHERE category = 'Pago de Tarjetas')
```

**Crítico:**

- Compra con CREDIT NO impacta Saldo Vivo (es diferido)
- Pago de resumen con DEBIT SÍ impacta (cash sale del banco)

**Multi-currency:**

- Solo muestra **default_currency** (usuario lo elige en Settings)
- Si default = ARS → muestra solo ARS (ignora USD)
- Si default = USD → muestra solo USD (ignora ARS)

**Editar ingresos:**

- Tap directo en "Ingresos del mes: $X"
- Abre modal con selector mes + inputs ARS/USD
- Usuario puede configurar ambas monedas, pero Saldo Vivo solo cuenta default

**Primera configuración:**

- Usuario nuevo → modal obligatorio: "Configurar Saldo Vivo"
- Campos: Ingresos ARS, Ingresos USD, Default currency
- Puede poner $0 → guarda → dashboard muestra "Ingresos" en ROJO como incompleto

**Verificación:**

- Usuario tap en Saldo Vivo → modal "Verificar con banco"
- Marca ✓ → guarda fecha
- Si después agrega/edita/elimina gasto → ✓ desaparece automáticamente

**Estados visuales:**

- ✓ verde: verificado y sin cambios
- Campo rojo: ingresos en $0 (no configurado)
- Sin badge: no verificado

#### C. Gastos con Tarjeta Este Mes

```
┌─────────────────────────────────────┐
│ 💳 Gastos con tarjeta este mes      │
│                                     │
│ $370.000                            │
│ (se pagarán en marzo)               │
└─────────────────────────────────────┘
```

**Reemplaza "Comprometido" (simplificación acordada):**

```sql
Gastos_tarjeta = SUM(expenses) WHERE:
  - payment_method = 'CREDIT'
  - month(date) = mes_en_contexto
  - category != 'Pago de Tarjetas'
  - currency = default_currency
```

**Comportamiento:**

- Solo muestra total (NO desglose por tarjeta)
- Texto estático (no cambia si estás en mes pasado)
- Siempre visible (aunque sea $0)
- **Solo cuenta gastos de default_currency**

**No hay reconciliación:** No trackea "qué se pagó". Es puramente informativo.

#### D. Filtro Estoico

```
┌─────────────────────────────────────┐
│ 🧘 Filtro Estoico                   │
│                                     │
│ 68% Necesidad, 32% Deseo            │
│ [████████████░░░░░░]                │
│ 12 necesidad · 7 deseo              │
└─────────────────────────────────────┘
```

**Cálculo:**

```sql
Ratio = (necesidad_count / total_count) * 100
WHERE:
  - month(date) = mes_actual
  - category != 'Pago de Tarjetas'
  - currency = default_currency
```

**Multi-currency:**

- **Solo cuenta gastos de default_currency**
- Ignora gastos en otra moneda

**Edge cases:**

- 100% necesidad → barra completamente verde
- 0 gastos → muestra "(vacío)"

#### E. Top 3 Categorías

```
┌─────────────────────────────────────┐
│ 📊 Top 3 Categorías                 │
│                                     │
│ 🛒 Supermercado        45%  $450K   │
│ [█████████░░░░░░░░░░░░░]            │
│                                     │
│ 🍽️ Restaurantes        30%  $300K   │
│ [██████░░░░░░░░░░░░░░░░]            │
│                                     │
│ 🚗 Transporte          15%  $150K   │
│ [███░░░░░░░░░░░░░░░░░░░]            │
└─────────────────────────────────────┘
```

**Cálculo:**

```sql
SELECT category, SUM(amount)
FROM expenses
WHERE month(date) = mes_actual
  AND category != 'Pago de Tarjetas'
  AND currency = default_currency
GROUP BY category
ORDER BY SUM(amount) DESC
LIMIT 3
```

**Empates:**

- Si dos categorías tienen mismo monto → desempata por cantidad de gastos
- Ej: Delivery $80K (10 gastos) > Transporte $80K (8 gastos)

**Si hay menos de 3:**

- Muestra solo las que existen (no rellena con "(vacío)")

#### F. Últimos 5 Gastos

```
┌─────────────────────────────────────┐
│ 📝 Últimos 5 Gastos                 │
│                                     │
│ 🍔 Café con leche          $2.500   │
│    Hoy · Efectivo                   │
│ ─────────────────────────────────── │
│ 🚗 Uber                    $3.500   │
│    Ayer · Débito                    │
│ ─────────────────────────────────── │
│ 💳 Pago BBVA VISA        $320.000   │
│    2 Feb · Débito                   │
│ ─────────────────────────────────── │
│                                     │
│ [Ver todos →]                       │
└─────────────────────────────────────┘
```

**Ordenamiento:**

```sql
ORDER BY date DESC, created_at DESC
LIMIT 5
```

**Clarificación crítica:**

- Por **fecha del gasto** (campo `date`), NO fecha de creación
- Si empate en fecha → desempata por `created_at`

**Comportamiento:**

- Siempre muestra 5 (sin paginación inline)
- "Ver todos" → redirige a `/expenses?month=2026-02`
- Incluye "Pago de Tarjetas" pero con visual diferenciado (gris, ícono 💳)

**Edición inline:**

- Tap en gasto → expande
- Ver sección "Edición de Gastos" para detalles

**Dashboard vacío:**

- Sin gastos → muestra "(vacío)" en cada sección
- Estructura existe siempre (no se ocultan cards)

---

### Feature #4: Saldo Vivo - Validación Completa (P0)

**Problema que resuelve:**  
Sin esto, usuario no tiene forma objetiva de saber si registró TODOS sus gastos.

**Mecánica:**

#### 1. Configuración Inicial

**Primera apertura del mes:**
Modal obligatorio (bloquea hasta completar o poner $0):

```
💰 Configurar Saldo Vivo

Para validar tus registros, necesitamos saber
tus ingresos del mes.

Ingresos en ARS: [________]
Ingresos en USD: [________] (opcional)

Moneda principal: [ARS ▼]

[Guardar]
```

**Campos:**

- Ingresos ARS: puede ser $0
- Ingresos USD: puede ser $0
- Default currency: ARS/USD (determina qué muestra Saldo Vivo)

**Puede poner $0:**

- Modal acepta $0
- Dashboard muestra Saldo Vivo con campo "Ingresos" en ROJO
- Sin prompts molestos (usuario configura cuando quiera)

#### 2. Durante el Mes

Dashboard calcula en tiempo real:

```
Disponible = Ingresos - (Gastos percibidos + Pagos de tarjetas)
```

**Ejemplo concreto:**

Mes: Febrero 2026  
Default currency: ARS

```
Ingresos configurados:
- amount_ars: $1.000.000
- amount_usd: $500

Gastos registrados:
- 20 gastos ARS (payment_method = CASH/DEBIT/TRANSFER): -$350.000
- 3 gastos USD (ignorados porque default = ARS)
- 1 pago tarjeta (category = "Pago de Tarjetas"): -$450.000

Cálculo:
Disponible = $1.000.000 - ($350.000 + $450.000) = $200.000
```

**Validación:**

- Usuario chequea banco: tiene $200K en cuenta
- Matchea → confianza → marca ✓ verde
- No matchea → falta registrar gastos → investiga

#### 3. Verificación

**Flow:**

1. Tap en Saldo Vivo card
2. Modal: "¿Verificaste con tu banco?"
3. Usuario confirma → badge ✓ verde + fecha
4. Si después modifica datos → ✓ desaparece automáticamente

**Badge states:**

- Sin badge: no verificado
- ✓ verde "Verificado 10 feb": verificado y sin cambios

---

## 4. DATA MODEL

### Tablas

#### expenses

```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 1),
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL CHECK (length(description) <= 100),
  is_want BOOLEAN,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'DEBIT', 'TRANSFER', 'CREDIT')),
  card_id VARCHAR(50),
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (category != 'Pago de Tarjetas' OR payment_method != 'CREDIT'),

  CHECK (
    (payment_method = 'CREDIT' AND card_id IS NOT NULL) OR
    (category = 'Pago de Tarjetas' AND card_id IS NOT NULL) OR
    (payment_method != 'CREDIT' AND category != 'Pago de Tarjetas')
  )
);
```

#### monthly_income

```sql
CREATE TABLE monthly_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount_ars DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month)
);
```

#### user_config

```sql
CREATE TABLE user_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  cards JSONB NOT NULL DEFAULT '[
    {"id": "bbva_visa", "name": "BBVA VISA"},
    {"id": "bbva_master", "name": "BBVA MÁSTER"},
    {"id": "bna_master", "name": "BNA MASTER"}
  ]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Índices

```sql
CREATE INDEX idx_expenses_user_date ON expenses(user_id, date DESC);
CREATE INDEX idx_expenses_category ON expenses(user_id, category);
CREATE INDEX idx_expenses_is_want ON expenses(user_id, is_want);
CREATE INDEX idx_expenses_payment ON expenses(user_id, payment_method);
CREATE INDEX idx_monthly_income_month ON monthly_income(user_id, month DESC);
```

### RLS Policies

```sql
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 5. 21 CATEGORÍAS

| #   | Categoría                 | Emoji | is_want | Keywords                |
| --- | ------------------------- | ----- | ------- | ----------------------- |
| 1   | Supermercado              | 🛒    | false   | super, supermercado     |
| 2   | Alimentos                 | 🥖    | false   | panadería, carnicería   |
| 3   | Restaurantes              | 🍽️    | true    | restaurant, almorzar    |
| 4   | Delivery                  | 🛵    | true    | pedidosya, rappi        |
| 5   | Kiosco y Varios           | 🍫    | true    | kiosco, golosinas       |
| 6   | Casa/Mantenimiento        | 🔧    | false   | plomero, electricista   |
| 7   | Muebles y Hogar           | 🛋️    | false   | mueble, deco            |
| 8   | Servicios del Hogar       | 🏠    | false   | luz, gas, internet      |
| 9   | Auto/Combustible          | ⛽    | false   | nafta, gasoil, YPF      |
| 10  | Auto/Mantenimiento        | 🚗    | false   | mecánico, service       |
| 11  | Transporte                | 🚕    | false   | uber, cabify, colectivo |
| 12  | Salud                     | 💊    | false   | médico, consulta        |
| 13  | Farmacia                  | 💉    | false   | farmacia, remedios      |
| 14  | Educación                 | 📚    | false   | curso, libro            |
| 15  | Ropa e Indumentaria       | 👔    | true    | ropa, zapatillas        |
| 16  | Cuidado Personal          | 💇    | false   | peluquería, gimnasio    |
| 17  | Suscripciones             | 📱    | true    | netflix, spotify        |
| 18  | Regalos                   | 🎁    | true    | regalo, cumpleaños      |
| 19  | Transferencias Familiares | 👨‍👩‍👧    | false   | familia, padres         |
| 20  | Otros                     | 🎯    | false   | catch-all               |
| 21  | **Pago de Tarjetas**      | 💳    | n/a     | pago, resumen           |

### Categoría Especial: "Pago de Tarjetas"

**Diferencias:**

- ✅ Cuenta para cash flow (Saldo Vivo)
- ❌ NO cuenta para Top 3
- ❌ NO tiene `is_want` (NULL)
- ❌ NO muestra toggle en ParsePreview

**Validaciones:**

- card_id: REQUIRED
- payment_method: NO puede ser CREDIT

---

## 6. PAYMENT METHODS

| Method   | Icon | Impacto   | Requiere card |
| -------- | ---- | --------- | ------------- |
| CASH     | 💵   | Inmediato | No            |
| DEBIT    | 💳   | Inmediato | No            |
| TRANSFER | 📲   | Inmediato | No            |
| CREDIT   | 🏦   | Diferido  | Sí            |

---

## 7. USER FLOWS

### Flow #1: Quick Registration

```
1. Input: "café 2500"
2. Gemini parsea (~1-2s)
3. ParsePreview SIEMPRE aparece
4. Usuario valida → Guardar
5. Dashboard actualiza
6. Input se limpia

Tiempo: 5-8 segundos
```

### Flow #2: Retroactive with Date

```
1. Input: "nafta 12000 ayer"
2. Parser detecta "ayer" → Feb 2
3. ParsePreview muestra fecha detectada
4. Usuario confirma
5. Gasto guardado con fecha correcta
```

### Flow #3: Credit Card

```
1. Input: "netflix 50 dólares"
2. Parser: USD, Suscripciones, payment_method=null
3. ParsePreview: campo "Medio" required
4. Usuario selecciona CREDIT
5. Campo "Tarjeta" aparece (required + rojo)
6. Usuario selecciona BBVA MÁSTER
7. Guardar
```

### Flow #4: Card Payment

```
1. Input: "pago BBVA VISA 320000"
2. Parser: category="Pago de Tarjetas"
3. ParsePreview sin toggle Need/Want
4. Usuario confirma
5. Saldo Vivo: "Pago de tarjetas" -$320K
```

### Flow #5: Period Navigation

```
1. Dashboard Feb → tap ←
2. Dashboard recarga → Enero
3. Smart Input hint: "Se registrará en Feb"
4. Gastos se registran en Feb (actual)
5. Puede cambiar fecha en ParsePreview
```

### Flow #6: Editing

```
1. Tap gasto → expande inline
2. Cambia categoría, need/want, etc
3. Tap fuera → guarda automático
4. Dashboard actualiza
```

---

## 8. MULTI-CURRENCY (Básico)

### Scope

- ✅ Registrar ARS y USD
- ✅ Análisis solo default_currency
- ❌ NO conversión

### Default Currency

- Inicial: ARS (hardcoded)
- Cambiar en Settings con confirmación
- Recalcula dashboard completo

### Behavior

**Si default = ARS:**

- Saldo Vivo: solo ARS
- Top 3: solo gastos ARS
- Filtro Estoico: solo ARS
- Gastos tarjeta: solo ARS
- Últimos 5: ambos (USD con badge)

---

## 9. VALIDATIONS

### Montos

- Mínimo: $1
- Máximo: Sin límite hard

### Descripción

- Máximo: 100 caracteres
- Input: maxLength=100

### Fechas

- Antiguas: 12 meses atrás máximo
- Futuras: Permitidas con warning

### Límites

- 50 gastos/día máximo
- Gasto #51 → bloqueo

### Duplicados

- Detección: mismo amount + category + date
- Badge: "⚠️ Posible duplicado"

---

## 10. PÁGINA /EXPENSES

### Ruta

`/expenses?month=2026-02`

### Filtros

1. Categoría
2. Medio de pago
3. Tarjeta (si CREDIT)
4. Rango fechas
5. Moneda

### Búsqueda

- Solo en categoría

### Paginación

- 20 por página
- Clásica [1] [2] [3]

### UI

- Mobile: lista vertical
- Desktop: tabla

### Edición

- Inline igual que dashboard

---

## 11. SETTINGS

### Secciones

```
CUENTA
- Email
- Cerrar sesión

CONFIGURACIÓN
- Moneda principal
- Tarjetas
- Ingresos mensuales

DATOS
- Eliminar cuenta
```

### Editar Ingresos

- Modal con selector mes
- Inputs ARS/USD

### Tarjetas

- 3 hardcoded iniciales
- Agregar: solo nombre
- Eliminar: con confirmación

### Cambiar Moneda

- Confirmación required
- Recalcula dashboard

---

## 12. AUTH & ONBOARDING

### Auth

- Solo Google OAuth
- Session indefinida

### First-Time

```
1. Login con Google
2. Modal "Configurar Saldo Vivo" (obligatorio)
3. Puede poner $0
4. Dashboard abre
```

---

## 13. PERFORMANCE

### Caché

- React Query / SWR
- staleTime: 5min
- cacheTime: 30min

### Queries

- 1 query grande de gastos
- Cálculos en frontend

### Bundle

- Target: <200KB
- Monitor only

### PWA

- manifest.json + sw.js (service worker implementado ✅)
- "Add to Home Screen" — íconos 192px, 512px, 180px
- Safe area Dynamic Island: `.pt-safe`
- Probado en iPhone ✅

---

## 14. SUCCESS METRICS

### Primary (3 meses)

1. **Registration Rate:** >70% gastos reales
2. **Saldo Vivo Accuracy:** <5% diferencia vs banco
3. **Registration Time:** <5 segundos promedio
4. **Abandonment:** <5% en ParsePreview

### Qualitative

Usuario puede responder en <10s:

- ¿Qué gastaste este mes?
- ¿Cuánto fue impulso?
- ¿Cuánto disponible tenés?

Con confianza = MVP worked.

---

## 15. RED FLAGS

🚩 Not used after 2 weeks  
🚩 Saldo Vivo never matches  
🚩 More time categorizing  
🚩 Frustrated by review

---

## 16. TECHNICAL STACK

### Frontend

- Next.js 16.1.6 + React 19
- TypeScript + Tailwind v4 (config via CSS `@theme {}`)
- @tanstack/react-query + Zod

### Backend

- Next.js API Routes
- Supabase (PostgreSQL + Auth)
- gemini-2.5-flash-lite (apiVersion: v1)

### Deploy

- Vercel
- $0/month ✅ confirmado en producción

---

## 17. OUT OF SCOPE (MVP)

❌ Cuotas/installments
❌ Offline-first
❌ OCR tickets
❌ Budgets/límites por categoría ← próxima feature prioritaria
❌ Recurring expenses
❌ Multi-user
❌ Light mode
❌ Email/password
❌ Bank integration
❌ Push notifications

✅ CSV export — **implementado** en `/api/export`

---

## 18. BACKLOG POST-MVP

**Alta prioridad:**
1. Presupuesto por categoría — límite mensual + alerta (complementa Filtro Estoico)
2. Tendencias mensuales — gráfico de gastos últimos 6 meses

**Media prioridad:**
3. Alerta límite diario — UI para `check_daily_expense_limit()` (ya existe en DB)
4. Estados vacíos — dashboard queda raro sin gastos para el mes
5. Skeletons de carga — feedback visual mientras el servidor fetchea

**Técnico / calidad:**
6. Tests — cero cobertura actualmente
7. Rate limiting — especialmente en `/api/parse-expense` (llama a Gemini)
8. Error boundaries — si el RPC de Supabase falla, el dashboard explota silenciosamente

---

**FIN DEL PRD v3.0 — Gota**
