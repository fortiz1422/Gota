# Spec — Card Statements & Pagos de Tarjeta
> Estado: borrador · Deuda técnica pendiente: schema real de tablas

---

## Contexto y motivación

El sistema actual registra gastos con tarjeta y calcula el devengado del mes en curso, pero no tiene concepto de **resumen** ni de **pago de tarjeta** como evento que cancela compromisos. Esto genera dos problemas:

1. **Disponible Real incompleto** — solo descuenta el devengado del período actual, ignorando resúmenes anteriores impagos.
2. **Sin UI para gestionar pagos** — el único camino planeado era una notificación push (GOT-18), sin opción manual visible.

Este spec cubre el rediseño completo del modelo: resúmenes como contenedor del devengado, pagos como evento que los cierra, y UI coherente para que el usuario pueda operar sin depender de la notificación.

---

## Modelo conceptual

### Resumen (card statement)

El resumen es el contenedor de todos los gastos de tarjeta de un período (cierre → cierre). Existe siempre en estado **abierto** mientras el período está activo. No requiere acción del usuario hasta el momento del pago.

**Ciclo de vida:**
```
ABIERTO → PAGADO
```
No hay estado intermedio obligatorio. La revisión/reconciliación ocurre inline en el modal de pago.

**Nota:** el término "ciclo" que ya usa la UI en Config es equivalente a "resumen". Se puede mantener el término en UI o unificar — decisión pendiente.

### Pago de tarjeta

El pago es el evento que cierra un resumen. Registrarlo es simultáneamente:
- Confirmar el resumen (el usuario revisa y acepta el monto)
- Registrar el egreso real en movimientos (impacta Saldo Vivo)

El pago **no** requiere confirmar ítem por ítem — el usuario puede ajustar el monto total si hay diferencia con el resumen del banco.

---

## Fórmula de Disponible Real

**Actual (incorrecta):**
```
Disponible Real = Saldo Vivo − devengado mes actual
```

**Nueva (correcta):**
```
Disponible Real = Saldo Vivo − deuda pendiente neta de tarjetas
```

Donde:
```
deuda pendiente neta = Σ devengado de todos los resúmenes sin pago registrado
```

Esto incluye resúmenes de meses anteriores que el usuario no pagó. Los resúmenes con `paid_at` registrado se excluyen del cálculo.

### Toggle de cuotas futuras (fase 2)

Opción en preferencias del usuario:
> **"Incluir cuotas futuras en Disponible Real"**
> Considera cuotas devengadas más allá del próximo resumen.

Por defecto: **off** (solo resúmenes cerrados y el actual).

---

## Schema — deuda técnica ⚠️

> **Pendiente:** revisar tablas reales del repo antes de definir migraciones.
> Los campos a continuación son propuesta sujeta a ajuste.

### Tabla nueva: `card_statements`

```sql
CREATE TABLE card_statements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) NOT NULL,
  card_id         uuid REFERENCES cards(id) NOT NULL,
  billing_period  text NOT NULL,          -- 'YYYY-MM' del cierre
  period_from     date NOT NULL,          -- fecha de inicio del período
  period_to       date NOT NULL,          -- fecha de cierre
  amount_draft    numeric(12,2),          -- suma automática del devengado (calculada)
  amount_paid     numeric(12,2),          -- lo que el usuario efectivamente pagó
  paid_at         timestamptz,            -- null = abierto/vencido
  created_at      timestamptz DEFAULT now()
);
```

**Lógica de estados:**
- `paid_at IS NULL` + período pasado → **vencido sin pagar**
- `paid_at IS NULL` + período actual → **en curso**
- `paid_at IS NOT NULL` → **pagado**

### Campo a revisar en tabla existente de gastos

> ⚠️ **Deuda técnica:** verificar si los gastos de tarjeta ya tienen un campo que identifique el período del resumen al que pertenecen. Si no existe, hay que agregar `billing_period` (o equivalente) a la tabla de gastos/expenses para poder linkear gasto ↔ resumen.

Opciones:
- Usar `billing_period: 'YYYY-MM'` como FK al resumen
- Usar `statement_id: uuid` como FK directa a `card_statements`
- Calcularlo dinámicamente en base a `closing_day` de la tarjeta (sin campo extra — la más liviana)

La opción calculada es la más limpia si `closing_day` ya existe en `cards`. Validar en código real.

### Tabla existente: `cards`

Ya tiene (según GOT-21, GOT-22, GOT-23 — Done):
- `closing_day: int`
- `due_day: int`
- `account_id: uuid`

No requiere cambios para esta feature.

---

## Manejo del ajuste de monto

Cuando el monto pagado difiere del devengado calculado, el sistema pregunta el origen de la diferencia:

| Motivo | Acción |
|--------|--------|
| Gasto olvidado | Genera movimiento con categoría que el usuario elija |
| Cargo del banco (impuesto, recargo) | Genera movimiento con categoría `"Cargo bancario"` |
| No detallar | Solo ajusta `amount_paid` en el resumen, sin movimiento extra |

El movimiento de ajuste se registra con fecha del pago. Esto permite que la suma de movimientos concilie con el monto pagado para usuarios que quieran fidelidad contable.

---

## Gastos post-cierre

Si llega un gasto con fecha de un período ya cerrado (y pagado), se asigna al resumen abierto actual con una nota de origen. No reabre resúmenes pagados.

> ⚠️ **Deuda técnica:** definir si esto se resuelve en la query de asignación de `billing_period` o con lógica explícita en el backend.

---

## Entry points — dónde vive el pago manual

Tres caminos al mismo modal:

```
1. Notificación push (GOT-18)          → Modal de pago
2. Config > Tarjeta > Resúmenes        → Modal de pago  [botón "Pagar" en ciclo en curso]
3. + Home > "Pago de tarjeta"          → Selector de tarjeta → Modal de pago
```

El `+` del Home agrega **Pago de tarjeta** como cuarto tipo junto a Gasto / Ingreso / Transferencia.

---

## Modal de pago

Mismo componente en los tres entry points.

```
┌─────────────────────────────────┐
│  Pago · [Nombre tarjeta]        │
│  Resumen [Mes] [Año]            │
│                                 │
│  Gastos registrados   $XX.XXX   │
│  [ver detalle ↓]  (colapsable)  │
│                                 │
│  Monto a pagar        $XX.XXX   │
│                    [editable]   │
│                                 │
│  Cuenta            [selector ▾] │
│  Fecha              [fecha ✎]   │
│                                 │
│  — si monto editado ≠ calculado:│
│  ¿Por qué hay diferencia?       │
│   ○ Gasto olvidado              │
│   ○ Cargo del banco             │
│   ○ No detallar                 │
│                                 │
│       [ Registrar pago ]        │
└─────────────────────────────────┘
```

**Notas:**
- La sección de ajuste aparece **solo** si el monto difiere del calculado
- El detalle de gastos es colapsable — la mayoría de los usuarios no lo necesita
- No hay salida a SmartInput — toda corrección es inline (agregar/ajustar monto)
- La cuenta se pre-llena con `account_id` de la tarjeta, editable

---

## UI — Config > Tarjetas

### Estructura elegida: Opción B (pantalla dedicada por tarjeta)

La lista de tarjetas navega a una pantalla dedicada `Tarjeta / [Nombre]` con dos secciones:

**Sección Configuración:**
- Cierre (editable)
- Vencimiento (editable)
- Cuenta asociada (selector)
- Próximo cierre (calculado, solo lectura)

**Sección Resúmenes:**
Solo muestra períodos que ya acumularon gastos o están cerrados. El ciclo futuro **no aparece** en resúmenes — vive únicamente en "Próximo cierre" dentro de Configuración.

```
RESÚMENES
Abr 2026  26 abr → 2 may  $84.200  [EN CURSO]  [ Pagar ]
Mar 2026  26 mar → 2 abr  $61.400  Pagado ✓
Feb 2026  26 feb → 2 mar  $38.900  Pagado ✓
```

- "EN CURSO" — pill accent, inequívoco
- Ciclos pagados — badge verde con checkmark
- Ciclos vencidos sin pagar — badge naranja + botón Pagar (misma lógica que en curso)

**Pié de pantalla:**
- Botón "Eliminar tarjeta" en danger, separado del resto

---

## Variantes del flujo — casos a cubrir

| Caso | Descripción | Comportamiento |
|------|-------------|----------------|
| **A. Happy path** | Usuario gasta el mes, paga al vencimiento | Resumen en curso → modal de pago → pagado |
| **B. Pago parcial** | Monto pagado ≠ devengado calculado | Usuario ajusta monto + declara motivo → discrepancia registrada |
| **C. Vencido sin pagar** | Pasó el due_day sin registrar pago | Resumen queda abierto vencido, sigue descontando de Disponible Real, badge naranja visible en UI |
| **D. Gasto post-cierre** | Llega gasto con fecha de período ya pagado | Se asigna al resumen abierto actual con nota de origen |
| **E. Sin gastos ese mes** | No hubo gastos con esa tarjeta | No se genera resumen. No hay nada que pagar |
| **F. Pago sin detallar ajuste** | Diferencia pero usuario elige "No detallar" | Solo ajusta `amount_paid`, sin movimiento extra generado |

---

## Impacto en movimientos

| Evento | ¿Genera movimiento? | Tipo | Impacta Saldo Vivo |
|--------|--------------------|----|-------------------|
| Gasto con tarjeta (cuota) | No directamente | — | No (es compromiso) |
| Pago de tarjeta | **Sí** | Egreso `"Pago tarjeta [nombre]"` | Sí |
| Ajuste por gasto olvidado | **Sí** | Egreso con categoría que elija el usuario | Sí |
| Ajuste por cargo bancario | **Sí** | Egreso `"Cargo bancario"` | Sí |
| Ajuste sin detallar | No | — | No (solo en resumen) |

---

## Issues existentes relacionados

| Issue | Título | Estado |
|-------|--------|--------|
| GOT-18 | Suggested Card Payment (parent) | Backlog |
| GOT-21 | Agregar due_day al schema | Done |
| GOT-22 | Agregar account_id al schema | Done |
| GOT-23 | Config tarjetas row expandible | Done |
| GOT-24 | Función cálculo monto resumen | Done |
| GOT-25 | Motor de sugerencias — estado persistente | Done |
| GOT-16 | Gastos post closing_day → impacta período+2 | Backlog |

---

## Plan de implementación

### Fase 1 — Fundación (requiere tablas reales)
1. ⚠️ Auditar schema actual: `expenses` / `transactions` / tabla de gastos de tarjeta
2. Definir migración final de `card_statements`
3. Resolver linkeo gasto ↔ período (calculado vs campo explícito)
4. Función de deuda pendiente neta por usuario

### Fase 2 — Disponible Real corregido
5. Actualizar query de Disponible Real con nueva fórmula
6. Tests: resumen vencido descuenta, resumen pagado no descuenta

### Fase 3 — UI Config revamp
7. Migrar Config > Tarjetas de acordeón a pantalla dedicada (Opción B)
8. Sección Resúmenes con estados (En curso / Pagado / Vencido)
9. "Próximo cierre" en sección Configuración

### Fase 4 — Modal de pago
10. Componente modal de pago (reutilizable en los 3 entry points)
11. Lógica de ajuste de monto + generación de movimiento de ajuste
12. Registro del pago → cierra resumen + genera egreso en movimientos

### Fase 5 — Entry points
13. Botón "Pagar" desde Config > Tarjeta > Resúmenes
14. Cuarto tipo en menú `+` del Home: "Pago de tarjeta"
15. Actualizar popup de GOT-18 para abrir el mismo modal

### Fase 6 — Casos edge
16. Badge "Vencido" + flujo para resúmenes sin pagar
17. Manejo de gastos post-cierre
18. Toggle "Incluir cuotas futuras" en preferencias (fase 2 opcional)

---

## Decisiones pendientes

- [ ] ¿Unificar terminología "ciclo" vs "resumen" en la UI?
- [ ] ¿Linkeo gasto ↔ período calculado o con campo explícito? (depende de schema real)
- [ ] ¿El resumen vencido genera una notificación o solo es visual?
- [ ] ¿Límite de historial de resúmenes visible? (últimos 6 meses / todos)
