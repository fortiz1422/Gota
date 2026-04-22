# P0 Open Items Closure Runbook

**Fecha:** 2026-04-22

Este runbook cierra los pendientes operativos que quedaron despues de implementar P0-01 a P0-07 en codigo. No requiere cambios de codigo, pero si requiere acceso a Supabase/Vercel y una prueba manual con datos descartables.

## Estado local verificado

Chequeo hecho sin imprimir secretos:

| Item | Estado |
| --- | --- |
| `.env.local` | Existe |
| `NEXT_PUBLIC_SUPABASE_URL` en `.env.local` | Presente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local` | Presente |
| `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` | Presente |
| `NEXT_PUBLIC_SENTRY_DSN` en `.env.local` | Pendiente |
| Variables cargadas en el proceso de shell | No cargadas |
| Supabase CLI local | No instalado |

## P0-01 Observabilidad

### Pendiente

- Configurar `NEXT_PUBLIC_SENTRY_DSN` en local/preview/produccion.
- Validar que un error controlado llegue al proyecto de Sentry.
- Confirmar que no se envian montos, descripciones, emails ni payloads financieros completos.

### Validacion

1. Agregar `NEXT_PUBLIC_SENTRY_DSN` en `.env.local` y en Vercel.
2. Levantar la app en entorno de prueba.
3. Forzar un error controlado temporal o usar un flujo que ya capture errores.
4. Confirmar en Sentry:
   - evento recibido;
   - ruta/entorno presentes;
   - sin montos, textos libres ni emails en tags/contextos.

## P0-02 Metricas Baseline

### SQL manual

Ejecutar en Supabase SQL editor:

```sql
-- Product analytics baseline for Gota.
-- Same content as docs/supabase-product-events.sql.

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (
    event_name in (
      'onboarding_started',
      'onboarding_completed',
      'first_account_created',
      'first_expense_created',
      'smartinput_parse_started',
      'smartinput_parse_succeeded',
      'smartinput_parse_failed',
      'parsepreview_confirmed',
      'parsepreview_cancelled',
      'anonymous_banner_seen',
      'anonymous_link_started',
      'anonymous_link_completed',
      'card_payment_prompt_seen',
      'card_payment_prompt_confirmed',
      'card_payment_prompt_dismissed',
      'dashboard_loaded_with_data'
    )
  ),
  properties jsonb not null default '{}'::jsonb,
  session_id text,
  path text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.product_events enable row level security;

drop policy if exists "product_events_insert_own" on public.product_events;
create policy "product_events_insert_own"
  on public.product_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create index if not exists idx_product_events_user_created
  on public.product_events(user_id, created_at desc);

create index if not exists idx_product_events_name_created
  on public.product_events(event_name, created_at desc);

create index if not exists idx_product_events_created
  on public.product_events(created_at desc);
```

### Verificacion SQL

```sql
select to_regclass('public.product_events') as product_events_table;

select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'product_events';

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'product_events'
order by indexname;
```

Resultado esperado:

- `product_events_table = product_events`;
- politica `product_events_insert_own`;
- indices `idx_product_events_created`, `idx_product_events_name_created`, `idx_product_events_user_created`.

### Validacion funcional

1. Iniciar sesion con usuario descartable.
2. Abrir dashboard.
3. Usar SmartInput con un parse valido y otro invalido.
4. Confirmar preview de gasto.
5. Revisar eventos:

```sql
select event_name, count(*) as total
from public.product_events
where created_at > now() - interval '1 day'
group by event_name
order by event_name;
```

Eventos esperados en alguna combinacion segun flujo:

- `dashboard_loaded_with_data`
- `smartinput_parse_started`
- `smartinput_parse_succeeded`
- `smartinput_parse_failed`
- `parsepreview_confirmed`
- `first_expense_created`

## P0-04/P0-05 Pagos Legacy Y Deuda De Tarjeta

### Pendiente

- Aplicar/verificar schema vigente en Supabase.
- Validar manualmente que pagos legacy bajan Saldo Vivo pero no reducen deuda pendiente de tarjeta.
- Validar que pagos aplicables si reducen deuda pendiente.

### Datos a capturar antes de probar

```sql
select id, email
from auth.users
order by created_at desc
limit 20;

select id, name
from public.cards
where user_id = '<USER_ID>';

select id, name, type
from public.accounts
where user_id = '<USER_ID>';
```

### Caso manual recomendado

1. Crear o elegir un usuario descartable.
2. Crear una cuenta y una tarjeta.
3. Registrar gasto CREDIT de 100 ARS con tarjeta.
4. Confirmar que la deuda pendiente de tarjeta sube a 100.
5. Registrar pago aplicable de 40 ARS para esa tarjeta.
6. Confirmar que deuda pendiente baja a 60.
7. Registrar pago legacy de 100 ARS sin consumo original asociado.
8. Confirmar que Saldo Vivo baja, pero deuda pendiente sigue en 60 y no queda negativa.

### Queries de inspeccion

```sql
select id, amount, currency, category, payment_method, card_id, account_id, is_legacy_card_payment, date, created_at
from public.expenses
where user_id = '<USER_ID>'
  and (
    payment_method = 'CREDIT'
    or category = 'Pago de Tarjetas'
  )
order by created_at desc
limit 50;
```

Calculo esperado por moneda/tarjeta:

```sql
with card_movements as (
  select
    card_id,
    currency,
    sum(amount) filter (
      where payment_method = 'CREDIT'
        and category <> 'Pago de Tarjetas'
    ) as credit_accrued,
    sum(amount) filter (
      where category = 'Pago de Tarjetas'
        and coalesce(is_legacy_card_payment, false) = false
    ) as applicable_payments,
    sum(amount) filter (
      where category = 'Pago de Tarjetas'
        and coalesce(is_legacy_card_payment, false) = true
    ) as legacy_payments
  from public.expenses
  where user_id = '<USER_ID>'
  group by card_id, currency
)
select
  card_id,
  currency,
  coalesce(credit_accrued, 0) as credit_accrued,
  coalesce(applicable_payments, 0) as applicable_payments,
  coalesce(legacy_payments, 0) as legacy_payments,
  greatest(coalesce(credit_accrued, 0) - coalesce(applicable_payments, 0), 0) as expected_pending_debt
from card_movements
order by currency, card_id;
```

## P0-07 Borrado De Cuenta

### Pendiente

- Confirmar `SUPABASE_SERVICE_ROLE_KEY` en Vercel/entorno real.
- Ejecutar prueba con usuario descartable.
- Confirmar que no quedan filas asociadas.
- Confirmar retencion de logs externos.

### Pre-check

Antes de borrar, guardar estos IDs del usuario descartable:

```sql
select id as user_id, email
from auth.users
where email = '<TEST_EMAIL>';

select array_agg(id) as account_ids
from public.accounts
where user_id = '<USER_ID>';

select array_agg(id) as subscription_ids
from public.subscriptions
where user_id = '<USER_ID>';

select array_agg(id) as expense_ids
from public.expenses
where user_id = '<USER_ID>';
```

### Flujo manual

1. Verificar que el entorno tiene `SUPABASE_SERVICE_ROLE_KEY`.
2. Iniciar sesion con usuario descartable.
3. Crear al menos:
   - cuenta;
   - tarjeta;
   - gasto;
   - ingreso;
   - transferencia si aplica;
   - suscripcion si aplica.
4. Ir a Configuracion -> Cuenta.
5. Abrir Privacidad y datos y confirmar que `/privacy` carga.
6. Volver a Configuracion.
7. Tocar Eliminar mi cuenta.
8. Escribir `ELIMINAR`.
9. Confirmar borrado.
10. Esperar redirect a `/login`.

### Verificacion posterior

```sql
select 'expenses' as table_name, count(*) from public.expenses where user_id = '<USER_ID>'
union all select 'monthly_income', count(*) from public.monthly_income where user_id = '<USER_ID>'
union all select 'user_config', count(*) from public.user_config where user_id = '<USER_ID>'
union all select 'accounts', count(*) from public.accounts where user_id = '<USER_ID>'
union all select 'income_entries', count(*) from public.income_entries where user_id = '<USER_ID>'
union all select 'transfers', count(*) from public.transfers where user_id = '<USER_ID>'
union all select 'yield_accumulator', count(*) from public.yield_accumulator where user_id = '<USER_ID>'
union all select 'instruments', count(*) from public.instruments where user_id = '<USER_ID>'
union all select 'recurring_incomes', count(*) from public.recurring_incomes where user_id = '<USER_ID>'
union all select 'cards', count(*) from public.cards where user_id = '<USER_ID>'
union all select 'card_cycles', count(*) from public.card_cycles where user_id = '<USER_ID>'
union all select 'product_events', count(*) from public.product_events where user_id = '<USER_ID>';
```

Si `product_events` todavia no existe, esa ultima linea puede omitirse.

Verificar tablas sin `user_id` directo:

```sql
select count(*) as account_period_balance_left
from public.account_period_balance
where account_id = any(array[
  '<ACCOUNT_ID_1>',
  '<ACCOUNT_ID_2>'
]::uuid[]);

select count(*) as subscription_insertions_left
from public.subscription_insertions
where subscription_id = any(array[
  '<SUBSCRIPTION_ID_1>',
  '<SUBSCRIPTION_ID_2>'
]::uuid[])
   or expense_id = any(array[
  '<EXPENSE_ID_1>',
  '<EXPENSE_ID_2>'
]::uuid[]);
```

Verificar Auth:

```sql
select id, email
from auth.users
where id = '<USER_ID>';
```

Resultado esperado: cero filas o cero counts en todos los casos.

## Cierre

Cuando los pasos anteriores esten completos, actualizar `docs/Codex - Backlog P0 Detallado Gota 21.4.md` y marcar cada open item como cerrado con fecha.
