# Cuotas: edicion, resúmenes de tarjeta y consistencia histórica

**Fecha:** 2026-04-14  
**Objetivo:** dejar cerrada una definición funcional y técnica para la edición de gastos con tarjeta cuando cambian las cuotas, incluyendo el impacto en resúmenes, métricas, movimientos y resúmenes ya pagados.

## 1. Problema observado

Hoy existe un bug funcional:

- un gasto de tarjeta cargado sin cuotas puede editarse desde UI para pasar a cuotas
- visualmente parece posible seleccionar `3x`, `6x`, etc.
- pero el cambio no impacta realmente

La causa es que la edición actual no reescribe la operación como cuotas reales en `expenses`.

Eso deja una inconsistencia:

- la UI permite expresar una intención de cambio
- la base sigue teniendo la compra como un único gasto
- por lo tanto resúmenes, métricas y movimientos no cambian

## 2. Modelo actual de cuotas en Gota

La app hoy ya tiene una definición clara para cuotas al momento de crear:

- `sin cuotas` = una sola fila en `expenses`
- `con cuotas` = múltiples filas en `expenses`, una por mes

Campos relevantes:

- `installment_group_id`
- `installment_number`
- `installment_total`

La app no trabaja con una "compra madre" abstracta para cálculos.
Trabaja con filas reales ya distribuidas por fecha.

Consecuencia:

- cualquier edición de cuotas debe terminar en una reescritura real de filas
- guardar solo un número de cuotas como metadata no sirve

## 3. Decisión de producto

Se define que el usuario debe poder corregir libremente un gasto de tarjeta aunque haya sido cargado mal originalmente.

Eso incluye:

- pasar de sin cuotas a con cuotas
- pasar de con cuotas a sin cuotas
- cambiar la cantidad de cuotas
- corregir incluso si afecta ciclos viejos o ya pagados

Se prioriza la capacidad de corrección del usuario por sobre la inmutabilidad histórica del detalle del resumen.

## 4. Regla contable adoptada

La app adopta esta semántica:

- el gasto puede corregirse retroactivamente
- la composición de un resumen histórico puede cambiar
- el pago ya registrado del resumen no se modifica
- el estado `paid` del ciclo no se modifica
- no se intenta reconciliar automáticamente diferencias históricas

Interpretación:

- `paid` significa que el usuario registró y validó un pago de resumen
- `paid` no significa que la composición interna del ciclo quede congelada para siempre

Si el usuario después corrige una compra mal cargada:

- el ciclo puede mostrar otra composición actual
- el pago registrado sigue igual
- cualquier diferencia histórica se asume ya absorbida manualmente por el usuario mediante otros movimientos, como cargos bancarios u otros gastos

## 5. Qué debe pasar al editar cuotas

### Caso A. Pasar de sin cuotas a con cuotas

Ejemplo:

- antes: una compra de `$120.000` el `2026-04-10`
- después: `6` cuotas

Resultado esperado:

- desaparece la fila original única
- aparecen 6 filas reales en `expenses`
- cuota 1 queda en `2026-04-10`
- cuota 2 queda en `2026-05-10`
- cuota 3 queda en `2026-06-10`
- etc.

Impacto:

- el ciclo de abril deja de cargar `$120.000`
- pasa a cargar solo el valor de la cuota 1
- las cuotas futuras impactan ciclos futuros

### Caso B. Pasar de con cuotas a sin cuotas

Ejemplo:

- antes: 6 cuotas ya materializadas
- después: una sola operación

Resultado esperado:

- desaparecen todas las filas del grupo de cuotas
- queda una sola fila en `expenses`
- esa fila mantiene la fecha base de la operación editada

### Caso C. Cambiar cantidad de cuotas

Ejemplo:

- antes: 3 cuotas
- después: 6 cuotas

Resultado esperado:

- desaparece el grupo anterior
- se crea un nuevo grupo completo con la nueva cantidad de cuotas
- la operación editada queda representada según el nuevo esquema

## 6. Invariantes que debe respetar el sistema

1. La representación final siempre debe ser materializada en filas reales de `expenses`.
2. Nunca deben coexistir:
   - la fila original única
   - y las cuotas nuevas
   porque eso duplicaría impacto.
3. La suma de todas las cuotas debe cerrar exactamente con el monto total original.
4. Las fechas deben distribuirse mes a mes con la misma lógica usada hoy en `POST /api/expenses`.
5. Editar cuotas no debe tocar:
   - pagos de tarjeta ya registrados
   - `amount_paid`
   - `paid_at`
   - `status = paid`
6. Cualquier vista derivada debe recalcularse desde `expenses`, no desde metadata auxiliar.

## 7. Regla de split de monto

El split de cuotas debe seguir la misma lógica que ya existe en el alta:

- si el total divide exacto, todas las cuotas tienen el mismo monto
- si no divide exacto, se reconcilian centavos

Ejemplo:

- `$100.000` en `3` cuotas

Resultado:

- `33.333,33`
- `33.333,33`
- `33.333,34`

Objetivo:

- evitar desfasajes acumulados
- garantizar que la suma final coincida exactamente con la operación original

## 8. Impacto funcional en toda la app

Como la app calcula casi todo desde las filas reales de `expenses`, editar cuotas tiene impacto real en varias vistas.

### A. Resúmenes de tarjeta

Archivos principales:

- [lib/analytics/computeResumen.ts](/C:/Users/Admin/Documents/gota/lib/analytics/computeResumen.ts)
- [lib/card-summaries.ts](/C:/Users/Admin/Documents/gota/lib/card-summaries.ts)

Comportamiento:

- el resumen suma gastos `CREDIT` por tarjeta y por rango de fechas
- no usa una entidad abstracta de compra
- depende de qué filas existen y qué fecha tiene cada una

Conclusión:

- si una compra se convierte a cuotas, cambia automáticamente el monto del resumen actual y de futuros resúmenes

### B. Compromisos de tarjeta

Archivo:

- [lib/analytics/computeCompromisos.ts](/C:/Users/Admin/Documents/gota/lib/analytics/computeCompromisos.ts)

Comportamiento:

- `currentSpend` y `nextCycleSpend` se calculan a partir de gastos `CREDIT` y su fecha

Conclusión:

- una compra que antes estaba entera en el ciclo actual puede repartir parte del gasto a ciclos siguientes

### C. Dashboard live y gasto devengado de tarjeta

Archivo:

- [lib/server/dashboard-queries.ts](/C:/Users/Admin/Documents/gota/lib/server/dashboard-queries.ts)

Comportamiento:

- `gastos_tarjeta` se calcula desde gastos de crédito devengados menos pagos aplicables

Conclusión:

- el gasto devengado del mes cambia automáticamente si una compra se redistribuye en cuotas

### D. Analytics mensuales

Archivos:

- [app/api/analytics-data/route.ts](/C:/Users/Admin/Documents/gota/app/api/analytics-data/route.ts)
- [lib/analytics/computeMetrics.ts](/C:/Users/Admin/Documents/gota/lib/analytics/computeMetrics.ts)

Comportamiento:

- métricas como `totalGastado`, `pctCredito`, categorías, hábitos y concentración usan las filas del mes

Conclusión:

- editar cuotas cambia la foto analítica del mes actual y eventualmente de meses futuros

### E. Movimientos

Archivo:

- [app/api/movimientos/route.ts](/C:/Users/Admin/Documents/gota/app/api/movimientos/route.ts)

Comportamiento:

- la lista y stats de movimientos también salen de `expenses`

Conclusión:

- una compra convertida a cuotas deja de verse como un único gasto en un mes y pasa a aparecer distribuida

## 9. Resúmenes pagados: nueva definición

Se define explícitamente lo siguiente:

- un resumen pagado puede seguir mostrando detalle
- un resumen pagado puede cambiar su composición actual si el usuario corrige gastos después
- el pago registrado no se toca
- el estado `paid` no se toca

Esto resuelve una necesidad real:

- el usuario quiere revisar después qué gastos hoy componen ese ciclo
- incluso si originalmente el resumen fue pagado y validado con otra composición

## 10. Detalle de gastos en resúmenes pagados

Hoy el detalle de gastos del ciclo existe en la UI de pago de resumen, pero no está disponible como vista general para ciclos `paid`.

Definición deseada:

- cualquier resumen debe poder abrirse y mostrar:
  - gastos incluidos en el ciclo
  - fechas
  - categoría
  - monto
  - indicador de cuota cuando aplique

Eso debe valer tanto para:

- `en_curso`
- `cerrado`
- `vencido`
- `pagado`

## 11. Indicador de resumen modificado después del pago

También se define una señal informativa para resúmenes ya pagados.

### Objetivo

Avisar al usuario cuando un resumen pagado ya no coincide exactamente con su composición actual.

### Regla mínima

Si un ciclo está `paid` y existe al menos una `expense` incluida en ese ciclo con:

- `created_at > paid_at`
- o `updated_at > paid_at`

entonces el resumen se considera modificado después del pago.

### Qué comunica el indicador

No intenta explicar exactamente qué cambió ni si cambió el monto pagado.
Solo comunica:

- "Este resumen fue pagado, pero tuvo cambios posteriores."

### Causas posibles

- una compra pasó de sin cuotas a cuotas
- una compra pasó de cuotas a gasto único
- cambió el monto
- cambió la fecha
- entró o salió una compra del rango del ciclo
- se creó una compra nueva con fecha dentro del ciclo
- se regeneró una operación en cuotas después del pago

### Limitación aceptada

Sin snapshot histórico, el sistema no puede explicar con precisión:

- qué campo cambió
- si cambió el monto del resumen
- o si fue una edición cosmética como descripción o categoría

Para esta etapa, eso se considera suficiente porque el objetivo del badge es señalar que hubo actividad posterior al pago, no reconciliar automáticamente el resumen.

### Diferencia contra monto pagado

La comparación entre:

- `amount` actual del ciclo
- y `amount_paid`

no debe usarse como definición de "resumen modificado".

Motivo:

- el usuario puede haber pagado el mínimo
- puede haber hecho un pago parcial
- puede haber validado manualmente diferencias por fuera del flujo

Por lo tanto:

- `amount_paid !== amount` no implica necesariamente que el resumen haya cambiado después del pago
- como mucho puede mostrarse aparte como información complementaria, nunca como badge principal de modificación

## 12. Opción futura: snapshot histórico del resumen

Si más adelante se quiere mayor precisión, se puede extender `card_cycles` para guardar un snapshot al momento del pago.

Ejemplos posibles:

- `amount_snapshot`
- hash o lista de ids de gastos incluidos
- fecha de cálculo del snapshot

Eso permitiría responder preguntas como:

- qué gasto entró o salió
- si el cambio fue solo por cuotas
- si el monto pagado coincidía con la composición en el momento del pago

No es requisito para la primera implementación.

## 13. Propuesta técnica de implementación

### Etapa 1. Reescritura correcta de cuotas al editar gasto

Cambios esperados:

- la UI de edición debe mandar la nueva cantidad de cuotas real
- el backend de update debe soportar reescritura completa
- si el resultado final es sin cuotas:
  - debe quedar una única fila
- si el resultado final es con cuotas:
  - debe quedar un grupo de cuotas materializado

Regla técnica:

- editar un gasto debe regenerar su representación final completa según el esquema nuevo

### Etapa 2. Detalle de gastos para cualquier resumen

Cambios esperados:

- extraer la lógica de detalle de gastos del ciclo a un componente reutilizable
- usarlo tanto en resumenes abiertos como pagados

### Etapa 3. Indicador de resumen modificado

Cambios esperados:

- derivar un flag del ciclo pagado si existe alguna `expense` del ciclo con `created_at > paid_at` o `updated_at > paid_at`
- mostrar badge o texto informativo en la UI de resúmenes
- opcionalmente mostrar la diferencia entre `amount` actual y `amount_paid`, pero como dato secundario

## 14. Riesgos y consideraciones

### Riesgo 1. Cambios retroactivos en analytics

Editar cuotas puede cambiar:

- total gastado de meses pasados
- porcentaje de crédito
- hábitos
- categorías top

Esto es aceptado por producto como parte de la corrección del dato.

### Riesgo 2. Ciclos pagados con monto actual distinto

Un resumen pagado puede mostrar un monto actual distinto al monto abonado.

Esto también es aceptado, siempre que:

- quede el pago intacto
- quede visible la señal de modificación

### Riesgo 3. Complejidad de edición de grupos ya existentes

Editar una compra que ya está en cuotas implica borrar o reemplazar su grupo completo y regenerarlo.

Hay que hacerlo con cuidado para evitar:

- cuotas duplicadas
- pérdida de consistencia
- fechas incorrectas

## 15. Decisiones cerradas

Quedan definidas como cerradas:

1. El usuario puede corregir libremente la cuota de un gasto, incluso retroactivamente.
2. La corrección debe materializarse en filas reales de `expenses`.
3. Los pagos ya registrados de tarjeta no se modifican.
4. Los ciclos `paid` no cambian de estado por una corrección posterior.
5. Los resúmenes `paid` deben poder mostrar detalle de gastos.
6. Debe existir un indicador si un resumen pagado cambió después del pago.

## 16. Decisiones aún abiertas

Quedan todavía abiertas estas cuestiones de implementación fina:

1. Si el detalle del resumen pagado debe mostrar además:
   - monto pagado
   - diferencia actual
   - fecha de pago
2. Si conviene agregar snapshot histórico en esta etapa o dejarlo para una segunda iteración.

## 17. Recomendación de implementación

Orden recomendado:

1. Corregir la edición de cuotas con reescritura real de filas.
2. Habilitar detalle de gastos en resúmenes pagados.
3. Agregar indicador de resumen modificado.
4. Recién después evaluar snapshot histórico si hace falta más precisión.

## 18. Criterio de éxito

La feature estará bien resuelta cuando:

- editar cuotas cambie de verdad los datos persistidos
- resúmenes y métricas reflejen automáticamente el cambio
- un resumen pagado siga siendo revisable
- el usuario pueda detectar si un resumen ya pagado cambió después
- no se toquen pagos ni estados históricos del ciclo

## 19. SQL a correr en Supabase

Para que `updated_at` sea confiable en general y pueda usarse con seguridad en la detección de cambios posteriores al pago, se recomienda blindarlo en la base con triggers.

### Objetivo

- que `updated_at` se actualice siempre en cada `UPDATE`
- que no dependa de que la app lo mande manualmente
- que `created_at` y `updated_at` tengan `DEFAULT now()` donde corresponda

### SQL sugerido

Se recomienda correrlo en fases, no pegar todo a ciegas de una sola vez.
Motivo:

- Supabase puede marcar como `potential issue` los `UPDATE` masivos
- el backfill de `updated_at` nulos puede no hacer falta
- conviene primero dejar la protección futura y recién después corregir históricos si es necesario

### Fase 1. Función + defaults + triggers

```sql
-- 1. Funcion generica para mantener updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Defaults para created_at / updated_at en tablas relevantes
alter table public.expenses
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.card_cycles
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.cards
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.accounts
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.recurring_incomes
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.yield_accumulator
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.monthly_income
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.user_config
  alter column created_at set default now(),
  alter column updated_at set default now();
 
-- 3. Triggers por tabla
drop trigger if exists set_updated_at_expenses on public.expenses;
create trigger set_updated_at_expenses
before update on public.expenses
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_card_cycles on public.card_cycles;
create trigger set_updated_at_card_cycles
before update on public.card_cycles
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_cards on public.cards;
create trigger set_updated_at_cards
before update on public.cards
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_accounts on public.accounts;
create trigger set_updated_at_accounts
before update on public.accounts
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_recurring_incomes on public.recurring_incomes;
create trigger set_updated_at_recurring_incomes
before update on public.recurring_incomes
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_yield_accumulator on public.yield_accumulator;
create trigger set_updated_at_yield_accumulator
before update on public.yield_accumulator
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_monthly_income on public.monthly_income;
create trigger set_updated_at_monthly_income
before update on public.monthly_income
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_user_config on public.user_config;
create trigger set_updated_at_user_config
before update on public.user_config
for each row
execute function public.set_updated_at();
```

### Fase 2. Verificar si hace falta backfill

Antes de correr `UPDATE` masivos, revisar si realmente existen `updated_at` nulos:

```sql
select 'expenses' as table_name, count(*) as null_updated_at
from public.expenses
where updated_at is null

union all

select 'card_cycles' as table_name, count(*) as null_updated_at
from public.card_cycles
where updated_at is null

union all

select 'cards' as table_name, count(*) as null_updated_at
from public.cards
where updated_at is null

union all

select 'accounts' as table_name, count(*) as null_updated_at
from public.accounts
where updated_at is null

union all

select 'recurring_incomes' as table_name, count(*) as null_updated_at
from public.recurring_incomes
where updated_at is null

union all

select 'yield_accumulator' as table_name, count(*) as null_updated_at
from public.yield_accumulator
where updated_at is null

union all

select 'monthly_income' as table_name, count(*) as null_updated_at
from public.monthly_income
where updated_at is null

union all

select 'user_config' as table_name, count(*) as null_updated_at
from public.user_config
where updated_at is null;
```

### Fase 3. Backfill opcional de históricos

Solo si la fase 2 muestra filas con `updated_at is null`, correr este bloque:

```sql
update public.expenses
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.card_cycles
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.cards
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.accounts
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.recurring_incomes
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.yield_accumulator
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.monthly_income
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.user_config
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;
```

### Fase 4. Validación manual recomendada

Después de correr la fase 1, validar que los updates nuevos ya muevan `updated_at`.

1. elegir una fila de `expenses`
2. anotar su `updated_at`
3. hacer un `update` real desde la app o SQL
4. verificar que `updated_at` quedó más nuevo

Query simple de verificación:

```sql
select id, created_at, updated_at
from public.expenses
order by updated_at desc
limit 20;
```

### Nota

Este blindaje no implementa todavía la feature de edición de cuotas ni el badge de resumen modificado.
Solo garantiza que `updated_at` represente la realidad de las filas y pueda usarse con confianza en esa implementación posterior.
