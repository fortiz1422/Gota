# Signoff Pendiente para Redefinir Saldo Vivo

**Objetivo:** cerrar la modalidad final de `Saldo Vivo` y `Disponible Real` antes de tocar datos (`accounts.opening_balance_*`) o seguir cambiando lógica de backend/frontend.

Este documento lista exactamente lo que necesito que confirmes para poder:

1. reconstruir el saldo esperado
2. proponer la migración correcta de datos
3. pedirte signoff sobre el modelo final

---

## 1. Saldos iniciales reales por cuenta

Necesito que completes cuál era el saldo inicial real de cada cuenta cuando querías que Gota empezara a contar históricamente.

### Cuenta: Banco Nación

- Opening real ARS: `343604`
- Opening real USD: `0`
- Observación:

Confirmado por usuario el 2026-04-07.

Notas:
- hoy encontré como candidato fuerte un snapshot manual de `343604 ARS`
- si ese valor era tu saldo inicial real, lo tomamos como base

### Cuenta: MercadoPago

- Opening real ARS: `0`
- Opening real USD: `0`
- Observación:

Confirmado por usuario el 2026-04-07.

Notas:
- hoy no encontré snapshot manual claro para esta cuenta
- si arrancaba en cero, confirmalo explícitamente

### Cuenta: BBVA

- Opening real ARS: `0`
- Opening real USD: `0`
- Observación:

Confirmado por usuario el 2026-04-07.

Notas:
- esta es la cuenta más ambigua
- encontré un snapshot manual de `86940 ARS`, pero parece más una foto de estado que un opening inicial puro
- si recordás un saldo inicial de BBVA, necesito ese dato

### Cuenta: Efectivo

- Opening real ARS: `0`
- Opening real USD: `7300`
- Observación:

Confirmado por usuario el 2026-04-07. El saldo USD inicial de `7300` queda asignado a Efectivo.

Notas:
- hoy encontré como candidato fuerte un snapshot manual de `7300 USD`
- si ese era tu efectivo/dólares iniciales reales, lo tomamos como base

---

## 2. Confirmaciones de modelo

Necesito tu confirmación explícita sobre estas reglas:

### Instrumentos

Regla propuesta:

- los instrumentos activos **sí** se restan de `Saldo Vivo`
- porque `Saldo Vivo` representa liquidez real disponible ahora

Confirmación:

- [x] Sí, los instrumentos activos restan de `Saldo Vivo`
- [ ] No, `Saldo Vivo` debería incluirlos

### Rendimientos

Regla propuesta:

- los rendimientos acumulados (`yield_accumulator`) **sí** suman a `Saldo Vivo` histórico en ARS

Confirmación:

- [x] Sí, los rendimientos suman a `Saldo Vivo`
- [ ] No, no deberían impactarlo

### Disponible Real

Regla propuesta:

- `Disponible Real = Saldo Vivo - deuda pendiente de tarjetas`
- deuda pendiente = consumos crédito históricos no pagados todavía

Confirmación:

- [x] Sí, esa es la definición correcta
- [ ] No, hay que redefinirlo

Detalle adicional confirmado:

- deuda pendiente de tarjetas = consumos en tarjeta - pagos de resúmenes
- las cuotas posteriores a `mes actual + 1` no impactan `Saldo Vivo`

---

## 3. Números esperados hoy

No necesito precisión absoluta. Necesito una referencia razonable para validar si el modelo final está convergiendo al valor correcto.

### Saldo Vivo esperado hoy

- ARS esperado aproximado: `9.1M`
- USD esperado aproximado: `7.3k`

### Disponible Real esperado hoy

- ARS esperado aproximado: `no especificado todavía`
- USD esperado aproximado: `no especificado todavía`

### Fuente de esa referencia

- [ ] saldo que ves en banco / billeteras
- [ ] cálculo mental aproximado
- [x] mezcla de ambos

Observación:

`Referencia aproximada validada por usuario para signoff del modelo.`

---

## 4. Recuerdos o excepciones importantes

Anotá cualquier cosa que pueda cambiar el modelo:

- una cuenta que en realidad no debería contar
- un saldo inicial que se cargó mal
- una transferencia histórica rara
- efectivo físico que se sumó después
- dólares que no querés considerar
- cualquier otro detalle que afecte la foto real

Espacio:

`________________________________________________________`

`________________________________________________________`

`________________________________________________________`

---

## 5. Qué voy a hacer con esta info

Con tus respuestas voy a devolverte:

1. una tabla final con el opening histórico propuesto por cuenta
2. la fórmula firmable de `Saldo Vivo`
3. la fórmula firmable de `Disponible Real`
4. el número esperado que debería dar el sistema
5. la estrategia de migración de datos más segura

Todavía no implica tocar código ni tablas.

---

## 6. Modalidad Firmada de Trabajo

Con la información confirmada, la modalidad objetivo queda:

### Saldo Vivo

`Saldo Vivo = opening histórico por cuenta + ingresos acumulados + rendimientos acumulados - gastos percibidos - pagos de tarjeta + ajustes cross-currency - instrumentos activos`

### Disponible Real

`Disponible Real = Saldo Vivo - deuda pendiente de tarjetas`

Donde:

- deuda pendiente = consumos con tarjeta - pagos de resúmenes
- cuotas posteriores a `mes actual + 1` no deben impactar `Saldo Vivo`

### Openings históricos aprobados para migración

- `Banco Nación`: `343604 ARS`, `7300 USD`
- `Banco Nación`: `343604 ARS`, `0 USD`
- `MercadoPago`: `0 / 0`
- `BBVA`: `0 / 0`
- `Efectivo`: `0 ARS`, `7300 USD`

### Referencia esperada hoy

- `Saldo Vivo ARS`: `~9.1M`
- `Saldo Vivo USD`: `~7.3k`
