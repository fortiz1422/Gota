# Handoff Claude Code — Sprint Multimoneda + Bugs
> Gota · Marzo 2026 · Light mode "Fría" activo

---

## Contexto general

- Stack: Next.js App Router, Supabase, Tailwind v4, TypeScript
- Design system: tokens CSS custom properties ya migrados, light mode "Fría" activo
- No tocar archivos fuera del scope indicado. Diffs antes de aplicar. No reformatear código no tocado.

---

## 🐛 BUG 1 — Calendario Mapa de Hábitos corrido

**Síntoma:** Los días del calendario aparecen en la columna incorrecta. Marzo 2026 arranca en domingo y se corre toda la grilla.

**Causa:** El offset de día de semana usa `getDay()` directo (0=domingo) pero la grilla visual empieza en lunes.

**Fix:**
1. Cambiar el array de labels de días a `['L', 'M', 'X', 'J', 'V', 'S', 'D']`
2. Corregir el cálculo de offset de posición inicial:
```ts
// Antes (incorrecto)
const offset = date.getDay()

// Después (correcto, semana empieza en lunes)
const offset = (date.getDay() + 6) % 7
// domingo(0)→6, lunes(1)→0, martes(2)→1 ...
```
3. Verificar si hay otros calendarios o date pickers en la app y aplicar el mismo criterio para consistencia.

---

## 🐛 BUG 2 — Detalle de gasto no muestra fecha

**Síntoma:** Al abrir el detalle de una transacción desde "Ver todos", la fecha no se muestra.

**Fix:** En el componente de detalle de transacción, asegurarse de renderizar `transaction.date` (o `transaction.created_at` según el campo en uso). Formatearlo consistente con el resto de la app (ej: `20 mar`).

---

## 🐛 BUG 3 — SmartInput no pre-selecciona cuenta default

**Síntoma:** Al abrir el formulario de carga de gasto, la cuenta seleccionada no es la marcada como default en Settings.

**Fix:** Al inicializar el estado del formulario/SmartInput, hacer lookup de la cuenta con `is_default = true` en la tabla de cuentas del usuario y usarla como valor inicial del selector "¿De dónde sale?". Si no hay ninguna marcada como default, mantener comportamiento actual.

---

## ✅ LAYOUT — Header Home rediseñado

**Cambio:** Reorganizar el header de Home para liberar espacio e incorporar el toggle de moneda.

**Layout nuevo:**
```
[ ARS · USD ]     Marzo ∨      [ + ]
  izquierda       centro       derecha
```

- `Marzo ∨` se mueve al centro — mantiene su funcionalidad de selector de mes
- `ARS · USD` pill toggle ocupa el lado izquierdo
- `+` permanece a la derecha

**Nota de responsive:** Si el nombre del mes es largo (ej: "Septiembre"), abreviar a "Sep ∨" para evitar overflow.

**Condición de render del toggle:** El pill `ARS · USD` solo se renderiza si el usuario tiene al menos un movimiento registrado en USD. Si no existe ninguno, el header muestra solo `Marzo ∨` centrado y `+` a la derecha, idéntico al estado actual.

---

## 🌐 FEATURE — Multimoneda Fase 1

### Estado global de moneda activa

- Implementar como estado de sesión (no persistido en localStorage ni Supabase)
- Default siempre: `ARS`
- El toggle en el header de Home actualiza este estado

### Comportamiento por componente en Home

| Componente | Comportamiento |
|---|---|
| **Saldo Vivo / DISPONIBLE** | Muestra saldo de cuentas de la moneda activa |
| **PERCIBIDOS** | Suma ingresos de la moneda activa en el mes |
| **TARJETA** | Suma compromisos de tarjetas de la moneda activa |
| **Últimos movimientos** | Muestra **todos** los movimientos (ambas monedas), con etiqueta de moneda visible en cada ítem cuando no es la default. No filtra. |

### Etiqueta de moneda en lista de movimientos

Los ítems en USD deben mostrar la moneda claramente. Ejemplo visual:
```
Netflix                          USD 200,00
· Suscripciones · 21 mar
```
Los ítems en ARS no necesitan etiqueta extra (es la moneda base).

---

## 🔄 FEATURE — Transferencias internas entre cuentas

### Concepto
Una transferencia mueve saldo entre dos cuentas propias. No es un gasto ni un ingreso. Puede ser entre cuentas de la misma moneda (ARS→ARS) o de distinta moneda (ARS→USD, USD→ARS).

### Impacto en Saldo Vivo
- Cuenta origen: saldo **baja**
- Cuenta destino: saldo **sube**
- Si son distinta moneda, cada Saldo Vivo se actualiza en su propia moneda
- Las transferencias **no cuentan** en métricas de gasto (Necesidad/Deseo, categorías, Fuga Silenciosa)

### Acceso al flujo
Desde el `+` del Home, agregar una tercera opción:
```
¿Qué querés registrar?
· Gasto
· Ingreso
· Transferencia   ← nuevo
```

### Pantalla de transferencia

```
Desde:    [ Efectivo ARS  ∨ ]    $  _________
Hasta:    [ Ahorro USD    ∨ ]    U$D _________

Tipo de cambio:  1 USD = $ ________
                 (se calcula automático si se ingresan ambos montos)

Fecha:    [ hoy ∨ ]
Nota:     (opcional)

[ Registrar transferencia ]
```

**Lógica del tipo de cambio:**
- Si origen y destino son la misma moneda → no mostrar campo TC, `amount_from = amount_to`
- Si son distinta moneda → mostrar campo TC. El usuario puede ingresar el TC manualmente **o** ingresar ambos montos y que se calcule automático: `exchange_rate = amount_from / amount_to`

### Modelo de dato (tabla `transfers` en Supabase)

```ts
{
  id: uuid
  user_id: uuid
  from_account_id: uuid
  to_account_id: uuid
  amount_from: numeric       // monto que sale de la cuenta origen
  amount_to: numeric         // monto que entra en la cuenta destino
  exchange_rate: numeric     // null si misma moneda
  date: date
  note: text (nullable)
  created_at: timestamptz
}
```

### Visualización en Últimos movimientos

Las transferencias aparecen en la lista pero visualmente diferenciadas — sin punto de color Necesidad/Deseo:

```
⇄  Efectivo ARS → Ahorro USD
   $ 100.000 · U$D 94  · 20 mar
```

---

## Stop conditions

- Si el campo `is_default` no existe en la tabla de cuentas, pausar y reportar antes de continuar con BUG 3
- Si la tabla `transfers` ya existe con esquema diferente, pausar y reportar antes de crear/migrar
- No modificar lógica de cálculo de Saldo Vivo existente para ARS hasta tener los tests pasando

---

## Archivos probablemente afectados

- `components/home/Header.tsx` — reorganización de layout
- `components/home/SaldoVivo.tsx` — filtro por moneda activa
- `components/analytics/HabitMap.tsx` — fix offset calendario
- `components/transactions/TransactionDetail.tsx` — fix fecha
- `components/smartinput/SmartInput.tsx` — cuenta default
- `app/store` o context de sesión — nuevo estado `activeCurrency`
- `supabase/migrations/` — nueva tabla `transfers`
- `components/transfers/TransferForm.tsx` — nuevo componente
