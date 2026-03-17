# Gota — Documento de visión: Multicuenta, Config Revamp e Ingresos como operación

> Documento de referencia para implementación. Generado a partir de sesión de diseño.  
> Usar como contexto en Claude Code para guiar los cambios.

---

## 1. Contexto y motivación

Gota maneja múltiples cuentas bancarias, efectivo y tarjetas de crédito. El modelo actual trata los ingresos como configuración mensual (campo estático) y no distingue correctamente entre las tres entidades financieras del usuario. Esta sesión define el modelo conceptual correcto y sus implicancias de diseño y arquitectura.

---

## 2. Modelo conceptual de entidades financieras

### 2.1 Taxonomía definitiva

| Entidad | Lógica | Comportamiento |
|---|---|---|
| **Cuenta bancaria** | Débito / transferencia | El saldo baja cuando el usuario gasta desde ella. Requiere selección explícita en flujo de carga. |
| **Efectivo** | Bolsillo propio | Independiente de cuentas bancarias. No toca saldo de ninguna cuenta. Se alimenta vía transferencias internas (ej: retiro cajero = Banco → Efectivo). |
| **Tarjeta de crédito** | Crédito desagregado | No toca saldo en el momento del gasto. Genera compromiso futuro (Saldo Vivo). |

### 2.2 Reglas importantes
- El campo "Medio de pago" en el flujo de carga se llama **"¿De dónde sale?"**
- La cuenta **principal** del usuario aparece preseleccionada por default en el flujo de carga
- Al seleccionar Tarjeta aparece un segundo nivel con las tarjetas configuradas
- Efectivo no requiere segundo nivel

---

## 3. Saldo inicial y Rollover

### 3.1 Origen del saldo inicial por cuenta por período

El saldo inicial de cada cuenta en un período puede tener tres orígenes:

1. **Apertura** — saldo que el usuario cargó al empezar a usar Gota (solo primer mes)
2. **Rollover auto** — heredado del saldo final del mes anterior (calculado dinámicamente)
3. **Override manual** — el usuario pisa el valor para ese período específico

### 3.2 Implicancias

- Config **no es atemporal**: necesita contexto de período para permitir el override manual del saldo inicial cuando el usuario no quiere usar el rollover automático
- El saldo inicial **no es un campo global** — pertenece a cada cuenta individualmente
- El campo `saldo inicial ARS` global que existía en Config queda **eliminado**
- El saldo de cada cuenta en cualquier período se calcula dinámicamente: `saldo_inicial_cuenta + Σ ingresos - Σ gastos_débito`

---

## 4. Ingresos: de configuración a operación

### 4.1 Decisión de diseño

Los ingresos dejan de ser un parámetro de configuración mensual y se convierten en **transacciones de tipo `income`**, igual que un gasto pero con signo positivo.

**Antes:** `monthly_income_ars` y `monthly_income_usd` en tabla de config de usuario.  
**Después:** filas en tabla `transactions` con `type: 'income'`, `account_id`, `amount`, `date`.

### 4.2 Por qué

- Un ingreso tiene cuenta destino, monto, fecha y origen — es una transacción
- Permite múltiples ingresos en el mismo mes (sueldo + freelance) sin editar config
- Saldo Vivo se vuelve un cálculo dinámico correcto en vez de depender de un parámetro estático
- Config queda como setup estructural puro

### 4.3 Entry point

Los ingresos se cargan desde el **Home**, usando el mismo flujo de carga que un gasto (SmartInput o formulario de confirmación). El SmartInput debe detectar intención de ingreso: *"cobré el sueldo"*, *"me cayó la plata del freelance"*, *"ingresaron 50k"*.

### 4.4 Impacto en feed del Home

Los ingresos aparecen en la lista de transacciones. Tratamiento visual diferenciado:
- Color verde (`#4ade80`)
- Signo positivo explícito (`+ $ 4.540.868`)
- Ícono o categoría de ingreso (sueldo, freelance, otros)

---

## 5. Config Revamp

### 5.1 Propósito redefinido

Config es **setup estructural**. Se toca al configurar la app por primera vez y ocasionalmente para ajustes. No es un formulario mensual.

Excepción: la sección de **saldo inicial por período** necesita contexto temporal para soportar Rollover + override manual.

### 5.2 Estructura de secciones

```
Configuración
│
├── [Selector de período global]  ← solo afecta saldo inicial
│
├── 💱 Moneda                     (toggle ARS / USD)
│
├── 🏦 Cuentas bancarias          (colapsable)
│   ├── Banco Nación ✦ principal  saldo inicial: $ 343.604
│   ├── Mercado Pago              saldo inicial: $ 85.000
│   ├── Brubank                   saldo inicial: $ 0
│   └── + Agregar cuenta
│
├── 💵 Efectivo                   (colapsable)
│   └── Bolsillo · saldo inicial: $ 12.000
│
└── 💳 Tarjetas de crédito        (colapsable)
    ├── BBVA Visa    · cierra día 15
    ├── BBVA Máster  · cierra día 18
    ├── BNA Master   · cierra día 20
    └── + Agregar tarjeta
```

### 5.3 Patrón de interacción

- **Secciones colapsables** con header sticky que muestra resumen cuando está colapsado
- Resumen visible sin expandir: `3 cuentas · $ 428.604`, `Bolsillo · $ 12.000`
- Al expandir: **FloatRows** por ítem (no cards rígidas, no pills)
- Cada FloatRow abre un **bottom sheet** con detalle y acciones
- `+ Agregar` disponible como pill dashed dentro de la sección expandida

### 5.4 Componentes de diseño

#### Selector de período (global, top del header)
```
[◀]  [Marzo]  [▶]
```
- Background: `rgba(148,210,255,0.06)`
- Border: `rgba(148,210,255,0.12)`
- Border radius: `12px`
- Color texto: `white`, `fontSize: 13`, `fontWeight: 600`
- Flechas: `color: rgba(148,210,255,0.2)`

#### SectionHeader (colapsable)
- Ícono 32×32, `borderRadius: 10`, `background: rgba(148,210,255,0.07)`
- Título: `white`, `fontSize: 14`, `fontWeight: 700`
- Resumen (colapsado): `color: rgba(148,210,255,0.45)`, `fontSize: 11`
- Chevron `›` rotado 90° cuando expandido, transición `0.2s`
- Background wrap: `rgba(148,210,255,0.03)`, border: `rgba(148,210,255,0.13)`, `borderRadius: 18`

#### FloatRow (ítem gestionable)
- `padding: 10px 14px`, `marginBottom: 5px`, `borderRadius: 14`
- Default inactivo: `background: rgba(148,210,255,0.03)`, `border: 1px solid rgba(148,210,255,0.09)`
- Cuenta principal: `background: rgba(56,189,248,0.07)`, `border: 1px solid rgba(56,189,248,0.22)`
- Ícono: 32×32, `borderRadius: 10`
- Badge PRINCIPAL: `background: #38bdf8`, `color: #050A14`, `fontSize: 7`, `fontWeight: 800`
- Sub-texto: `color: rgba(148,210,255,0.45)`, `fontSize: 11`, `fontFamily: monospace`
- Chevron `›` derecha: `color: rgba(148,210,255,0.2)`, `fontSize: 16`

#### AddPill (agregar ítem)
- `border: 1.5px dashed rgba(148,210,255,0.15)`, `borderRadius: 999`
- `background: transparent`, `color: rgba(148,210,255,0.35)`, `fontSize: 12`

#### Bottom sheet (detalle de cuenta/tarjeta)
- `background: #0D1B2E`, `borderRadius: 24px 24px 0 0`
- `borderTop: 1px solid rgba(148,210,255,0.12)`
- Handle: 36×4, `background: rgba(148,210,255,0.2)`, `borderRadius: 2`, centrado
- Backdrop: `rgba(5,10,20,0.8)`, `backdropFilter: blur(4px)`
- Cerrar al tocar backdrop

#### Microcopy de sección
- `color: rgba(148,210,255,0.3)`, `fontSize: 11`
- Una línea que explica la lógica de la sección
- Ejemplos: *"El saldo baja cuando gastás desde estas cuentas."* / *"Los gastos con tarjeta no afectan tu saldo inmediato."* / *"Independiente de tus cuentas bancarias. Se actualiza vía transferencias internas."*

#### Hint contextual (Efectivo en 0)
- `background: rgba(251,191,36,0.07)`, `border: 1px solid rgba(251,191,36,0.15)`, `borderRadius: 12`
- `color: rgba(251,191,36,0.7)`, `fontSize: 11`
- Texto: *"💡 ¿Retiraste efectivo? Registrá la transferencia desde tu cuenta bancaria."*

### 5.5 Bottom sheet — Cuenta bancaria

Campos y acciones:
- Nombre e ícono (display)
- `Saldo inicial en [Mes]` — campo editable, con indicador si es rollover auto o manual
- Botón primario `Definir como principal` (solo si no es default) — `background: rgba(56,189,248,0.12)`, `border: rgba(56,189,248,0.3)`, `color: #38bdf8`
- Botón secundario `Archivar cuenta` — `color: rgba(255,255,255,0.35)`

### 5.6 Bottom sheet — Tarjeta de crédito

Campos y acciones:
- Nombre (display)
- Selector de día de cierre: grid 7 columnas, días `[1,5,10,15,18,20,25]`
- Día activo: `border: 1.5px solid #38bdf8`, `background: rgba(56,189,248,0.15)`, `color: #38bdf8`
- Microcopy: *"El resumen se genera el día de cierre de cada mes."*
- Botón `Archivar tarjeta`

---

## 6. Cambios en el flujo de carga (Home)

### 6.1 Sección "¿De dónde sale?"

Implementada como **chips/pills horizontales scrolleables** (no dropdown, no floating rows).

```
[🏦 Banco Nación ✦]  [💙 Mercado Pago]  [🔵 Brubank]  [💵 Efectivo]  [💳 Tarjeta]
```

- Cuenta principal preseleccionada por default
- Al seleccionar Tarjeta → aparece segundo nivel con tarjetas configuradas (lista con radio buttons)
- Efectivo no tiene segundo nivel

#### Pill inactivo
- `border: 1px solid rgba(148,210,255,0.15)`, `background: rgba(148,210,255,0.04)`
- `color: rgba(255,255,255,0.5)`, `fontSize: 13`, `fontWeight: 500`
- `borderRadius: 999`, `padding: 8px 14px`

#### Pill activo
- `border: 1.5px solid #38bdf8`, `background: rgba(56,189,248,0.15)`
- `color: #38bdf8`, `fontWeight: 600`

### 6.2 Ingreso como operación

- Entry point: mismo flujo que gasto (SmartInput o formulario de confirmación)
- Formulario de confirmación de ingreso incluye: monto, moneda, cuenta destino (`¿A dónde entra?`), categoría (sueldo / freelance / otros), fecha
- Visualización en feed: color `#4ade80`, signo `+`, categoría de ingreso

---

## 7. Modelo de datos — cambios requeridos

### 7.1 Tabla `transactions` — agregar campo `type`

```sql
ALTER TABLE transactions
ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'
CHECK (type IN ('expense', 'income', 'transfer'));
```

- `expense`: gasto desde cuenta o tarjeta
- `income`: ingreso a una cuenta
- `transfer`: movimiento interno entre cuentas (ej: cajero → efectivo)

### 7.2 Tabla `accounts` — saldo inicial

```sql
-- Opción recomendada: saldo inicial como campo de apertura
-- El saldo de períodos posteriores se hereda via rollover o se pisa manualmente

ALTER TABLE accounts
ADD COLUMN opening_balance NUMERIC DEFAULT 0;

-- Para override manual por período (soporte Rollover):
CREATE TABLE account_period_balance (
  account_id UUID REFERENCES accounts(id),
  period DATE, -- primer día del mes
  balance NUMERIC NOT NULL,
  source TEXT CHECK (source IN ('opening', 'rollover_auto', 'manual')),
  PRIMARY KEY (account_id, period)
);
```

### 7.3 Deprecar campos de config de ingresos

```sql
-- Deprecar (o migrar y eliminar):
-- user_config.monthly_income_ars
-- user_config.monthly_income_usd
-- user_config.initial_balance_ars (si existe)
```

### 7.4 Recálculo de Saldo Vivo

```sql
-- Pseudo-query por cuenta por período:
SELECT
  ab.balance AS saldo_inicial,
  ab.balance
    + COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0)
    - COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense' AND t.payment_source = 'account'), 0)
  AS saldo_vivo
FROM account_period_balance ab
LEFT JOIN transactions t
  ON t.account_id = ab.account_id
  AND DATE_TRUNC('month', t.date) = ab.period
WHERE ab.account_id = :account_id
  AND ab.period = :period
GROUP BY ab.balance;
```

### 7.5 SmartInput — Gemini Flash prompt update

El prompt debe detectar y manejar tres intenciones:
- **Gasto**: *"gasté 2500 en transporte"* → `type: expense`
- **Ingreso**: *"cobré el sueldo"*, *"me cayeron 50k"*, *"ingresaron 4.5M"* → `type: income`
- **Transferencia interna**: *"saqué plata del cajero"*, *"pasé plata a efectivo"* → `type: transfer`

---

## 8. Checklist de implementación

### Config Revamp
- [ ] Reemplazar estructura actual de Config por secciones colapsables
- [ ] Implementar `SectionHeader` colapsable con resumen visible
- [ ] Implementar `FloatRow` para cuentas, efectivo y tarjetas
- [ ] Implementar bottom sheet de cuenta (con saldo inicial editable + indicador rollover)
- [ ] Implementar bottom sheet de tarjeta (selector día de cierre)
- [ ] Agregar sección Efectivo como entidad independiente
- [ ] Agregar hint contextual en Efectivo cuando saldo = 0
- [ ] Selector de período global en header (solo afecta saldo inicial)
- [ ] Eliminar sección Ingresos de Config

### Ingresos como operación
- [ ] Agregar `type` a tabla `transactions`
- [ ] Crear tabla `account_period_balance`
- [ ] Migrar datos existentes de `monthly_income` a `transactions`
- [ ] Actualizar flujo de confirmación para soportar `type: income`
- [ ] Actualizar SmartInput prompt en Gemini Flash
- [ ] Mostrar ingresos en feed del Home con tratamiento visual diferenciado
- [ ] Recalcular Saldo Vivo dinámicamente

### Multicuenta en Home
- [ ] Reemplazar selector de cuenta por pills horizontales scrolleables
- [ ] Cuenta principal preseleccionada por default
- [ ] Segundo nivel de tarjetas al seleccionar "Tarjeta"
- [ ] Asociar `account_id` a cada transacción de ingreso y gasto

---

## 9. Lo que NO cambia

- Saldo Vivo como concepto central del home
- Cuotas como capa puramente analítica (no afectan Saldo Vivo)
- Clasificación Necesidades vs Deseos (`is_want`)
- Design system Deep Ocean / Gota Glass
- SmartInput como entry point principal
- Stack técnico: Next.js App Router, Supabase, Gemini Flash, Tailwind v4
