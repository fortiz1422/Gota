# Disponible Real y Deuda Legacy de Tarjetas

**Fecha:** 2026-04-07  
**Objetivo:** cerrar la lógica de `Disponible Real` para usuarios que empiezan a usar Gota con deuda de tarjeta previa ya existente.

---

## 1. Problema detectado

Hoy `Disponible Real` se calcula conceptualmente como:

`Saldo Vivo - deuda pendiente de tarjetas`

Y la deuda pendiente se obtiene como:

`consumos con tarjeta registrados - pagos de resumen registrados`

El problema aparece cuando el usuario empieza a usar Gota teniendo ya deuda previa en sus tarjetas.

En ese caso:

- el usuario registra pagos reales de resumen
- esos pagos sí son dinero que sale de la cuenta
- por lo tanto sí deben bajar `Saldo Vivo`
- pero no necesariamente corresponden a consumos registrados dentro de Gota

Si esos pagos se usan para compensar el crédito devengado que sí fue registrado en Gota, el sistema rompe la lógica de `Disponible Real`.

### Ejemplo del problema

Caso real auditado:

- `credito_devengado ARS = 2,164,376.01`
- `pagos_resumen ARS = 1,836,528`
- cálculo actual:

`deuda_pendiente = 2,164,376.01 - 1,836,528 = 327,848.01`

Pero esos `1.836M` incluyen pagos de consumos previos a usar Gota.

Entonces:

- sí deben impactar `Saldo Vivo`
- no deberían reducir la deuda pendiente construida con consumos registrados en Gota

---

## 2. Regla de producto aprobada

### Saldo Vivo

Todo pago de tarjeta representa una salida real de dinero.

Por lo tanto:

- cualquier pago de tarjeta baja `Saldo Vivo`

Sin importar si corresponde a:

- consumos registrados en Gota
- consumos previos a usar Gota

### Disponible Real

`Disponible Real` debe medir cuánto dinero queda libre descontando deuda pendiente generada por consumos que Gota sí conoce.

Por lo tanto:

- los pagos aplicados a consumos previos a Gota **no deben compensar** la deuda calculada desde consumos registrados en Gota

---

## 3. Nueva distinción necesaria

Hay que distinguir dos tipos de pago:

### A. Pago de Tarjetas normal

Definición:

- pago de resumen correspondiente a deuda generada por consumos que Gota sí está siguiendo

Impacto:

- baja `Saldo Vivo`
- reduce deuda pendiente en `Disponible Real`

### B. Pago de consumos anteriores

Definición:

- pago de tarjeta correspondiente a deuda previa al inicio de uso de Gota

Impacto:

- baja `Saldo Vivo`
- **no** reduce la deuda pendiente usada por `Disponible Real`

---

## 4. Regla funcional exacta

### Fórmula de Saldo Vivo

Se mantiene:

`Saldo Vivo = opening histórico + ingresos acumulados + rendimientos acumulados - gastos percibidos - pagos de tarjeta - ajustes cross-currency - instrumentos activos`

Acá entran:

- pagos normales
- pagos de consumos anteriores

Ambos restan.

### Fórmula de deuda pendiente para Disponible Real

Nueva versión:

`deuda_pendiente = consumos de tarjeta registrados en Gota - pagos normales aplicables a esos consumos`

Excluye:

- pagos de consumos anteriores / legacy

### Fórmula de Disponible Real

`Disponible Real = Saldo Vivo - deuda_pendiente`

---

## 5. UX propuesta

Al registrar un pago de tarjeta, el usuario debe poder distinguir si el pago corresponde a:

- resumen normal de consumos seguidos por Gota
- consumos anteriores al inicio de Gota

### Texto sugerido para la UI

Opción:

- `Pago de consumos anteriores`

Texto explicativo:

- `Baja tu Saldo Vivo porque es plata que salió de tu cuenta, pero no se usa para cancelar deuda registrada dentro de Gota.`

---

## 6. Requisito técnico

El sistema necesita persistir esta diferencia de alguna manera.

Opciones posibles:

### Opción 1. Nueva categoría

Agregar una categoría específica:

- `Pago de consumos anteriores`

Ventajas:

- simple de entender
- explícita en datos
- fácil de filtrar

Desventajas:

- mezcla semántica de negocio dentro de categoría

### Opción 2. Mismo tipo de gasto + flag explícito

Mantener categoría `Pago de Tarjetas` y agregar un flag tipo:

- `is_legacy_card_payment = true`

Ventajas:

- modelo más limpio
- evita multiplicar categorías

Desventajas:

- requiere cambio de schema

### Recomendación

Si buscamos una solución sólida de largo plazo:

- usar flag explícito

Si buscamos la menor fricción de implementación:

- usar nueva categoría

---

## 7. Cómo debe comportarse el sistema

### Caso 1. Pago normal

- el usuario paga un resumen de consumos registrados en Gota
- baja `Saldo Vivo`
- baja deuda pendiente
- sube `Disponible Real`

### Caso 2. Pago legacy

- el usuario paga una deuda previa al inicio de Gota
- baja `Saldo Vivo`
- no baja deuda pendiente de Gota
- `Disponible Real` no mejora artificialmente

### Caso 3. Usuario nuevo con deuda vieja

- puede registrar pagos reales sin distorsionar el hero
- `Saldo Vivo` refleja la caja real
- `Disponible Real` refleja sólo deuda generada dentro del universo conocido por Gota

---

## 8. Decisión recomendada

La solución correcta para producto es:

1. soportar explícitamente pagos legacy de tarjeta
2. hacer que impacten `Saldo Vivo`
3. excluirlos del cálculo de deuda pendiente para `Disponible Real`

Esto evita:

- falsos aumentos de `Disponible Real`
- inconsistencias para usuarios nuevos
- necesidad de inventar compensaciones manuales raras

---

## 9. Estado

**Aprobado conceptualmente para implementación.**

Pendiente definir:

- si se implementa como categoría nueva o como flag de schema
- cómo se expone exactamente en la UI del flujo de pago de tarjeta

---

## 10. Decisión de UI/UX

### Punto de entrada elegido

La carga de un pago legacy de tarjeta **no** debe hacerse desde Smart Input ni desde la pantalla genérica de expenses.

Se hará desde:

- `Config > Tarjetas`
- usando el mismo flujo actual de `Pagar resumen`

### Motivo

El usuario no interpreta este caso como:

- “estoy cargando un gasto”

Lo interpreta como:

- “estoy pagando la tarjeta”

Por eso el punto de entrada correcto es la superficie de tarjetas y no la superficie general de gastos.

---

## 11. UX propuesta sobre el flujo existente

Hoy la configuración de tarjetas ya muestra el botón de pagar resumen por período.

La propuesta es **no** agregar una pantalla nueva y **no** mover la acción a otro módulo.

En cambio:

- se reutiliza el modal actual de `Pagar resumen`
- se agrega una opción explícita para indicar que el pago corresponde a deuda previa a Gota

### Variante elegida

Dentro de `PagarResumenModal`, agregar un control tipo checkbox / toggle:

- `Este pago corresponde a consumos anteriores a Gota`

### Comportamiento

#### Si NO está marcado

El flujo funciona como hoy:

- crea gasto categoría `Pago de Tarjetas`
- `legacy = false`
- baja `Saldo Vivo`
- reduce deuda pendiente
- mejora `Disponible Real`

#### Si SÍ está marcado

El flujo crea:

- gasto categoría `Pago de Tarjetas`
- `legacy = true`

Impacto:

- baja `Saldo Vivo`
- **no** reduce deuda pendiente de `Disponible Real`

---

## 12. Copy sugerido

### Label del toggle

- `Corresponde a deuda previa a Gota`

### Texto explicativo corto

- `Usalo si este pago cancela consumos que hiciste antes de empezar a registrar tu tarjeta en Gota.`

### Texto de impacto contable

- `Este pago baja tu Saldo Vivo porque el dinero salió de tu cuenta, pero no se usa para cancelar la deuda registrada dentro de Gota.`

---

## 13. Estructura de la experiencia

### Estado base del modal

Campos actuales:

- tarjeta
- período / resumen
- monto
- cuenta desde la que se paga

Nuevo bloque:

- checkbox o toggle `Corresponde a deuda previa a Gota`
- texto helper debajo

### Reglas visuales

Si el toggle está apagado:

- no cambia nada del flujo actual

Si el toggle está prendido:

- mostrar helper más explícito
- opcional: badge o leyenda `Pago legacy`

---

## 14. Qué NO hacer

Para evitar fricción y errores de carga:

- no mover esta acción a Smart Input
- no obligar al usuario a registrarlo desde expenses
- no crear una ruta separada si no hace falta
- no mezclarlo con categorías nuevas visibles al usuario si se puede resolver con un flag interno

---

## 15. Recomendación final de UX

La UX recomendada es:

1. el usuario entra a `Config > Tarjetas`
2. elige `Pagar resumen`
3. dentro del modal decide si es:
   - pago normal
   - pago de deuda previa a Gota
4. el sistema registra el pago con el flag correcto

Esto mantiene:

- el flujo mental correcto
- mínima fricción de aprendizaje
- consistencia con la UI actual de tarjetas
