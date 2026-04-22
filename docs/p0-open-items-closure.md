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
| `NEXT_PUBLIC_SENTRY_DSN` en `.env.local` | Presente |
| `SENTRY_DSN` en `.env.local` | Presente |
| Smoke test local Sentry | OK, issue visible en Sentry |
| Variables cargadas en el proceso de shell | No cargadas |
| Supabase CLI local | No instalado |

## P0-01 Observabilidad

### URLs

- Sign up: `https://sentry.io/signup/`
- Login: `https://sentry.io/auth/login/`
- DSN docs: `https://docs.sentry.io/product/sentry-basics/dsn-explainer/`

### Pendiente

- Configurar `NEXT_PUBLIC_SENTRY_DSN` y `SENTRY_DSN` en Vercel preview/produccion.
- Validar que un error controlado llegue al proyecto de Sentry desde preview/produccion.
- Confirmar que no se envian montos, descripciones, emails ni payloads financieros completos.

### Crear proyecto Sentry

1. Entrar a Sentry.
2. Ir a `Projects` -> `Create Project`.
3. Elegir plataforma `Next.js`.
4. Usar nombre sugerido `gota-web`.
5. En alerts, elegir `I'll create my own alerts later` por ahora.
6. No correr el wizard ni instalar nada: el repo ya tiene `@sentry/nextjs` y configuracion.

### Copiar DSN

1. Ir a `Project Settings`.
2. Abrir `SDK Setup`.
3. Entrar a `Client Keys (DSN)`.
4. Copiar el DSN del proyecto.

### Configurar env vars

En `.env.local` agregar:

```env
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

En Vercel:

1. Abrir el proyecto.
2. Ir a `Settings` -> `Environment Variables`.
3. Agregar `NEXT_PUBLIC_SENTRY_DSN`.
4. Agregar `SENTRY_DSN`.
5. Marcar `Production`, `Preview` y `Development`.
6. Guardar y redeployar.

Usamos ambas variables porque el cliente lee `NEXT_PUBLIC_SENTRY_DSN` y server/edge leen `SENTRY_DSN` con fallback a `NEXT_PUBLIC_SENTRY_DSN`.

### Smoke test local

1. Reiniciar el dev server despues de editar `.env.local`.
2. Abrir la app en el navegador.
3. Abrir DevTools -> Console.
4. Ejecutar:

```js
setTimeout(() => {
  throw new Error('gota sentry smoke test')
}, 0)
```

5. Ir a Sentry -> `Issues`.
6. Buscar `gota sentry smoke test`.

Resultado esperado:

- aparece un issue/evento nuevo;
- environment correcto;
- no aparecen emails, montos, descripciones libres ni payloads financieros completos.

### Regla P0

No activar Session Replay en este cierre. Para P0 solo se valida error tracking basico sin PII.

### Business trial

La organizacion puede quedar en Business trial por 14 dias al crearla. Segun Sentry, no se cobra al terminar el trial y vuelve al plan Developer/Free salvo upgrade manual. Para mantenerlo sin costo:

- no agregar tarjeta;
- no usar `Manage Plan` / `Upgrade`;
- no activar Session Replay, Logs, Profiling ni Performance;
- esperar el vencimiento del trial.

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
