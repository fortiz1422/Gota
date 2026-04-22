# Account Deletion And Privacy Coverage

**Fecha:** 2026-04-22

## Alcance

P0-07 agrega una base minima de privacidad y control de datos:

- pagina publica `/privacy`;
- acceso desde Settings/Cuenta;
- copy de SmartInput e IA;
- borrado de cuenta con confirmacion explicita `ELIMINAR`;
- endpoint server-side con service role para borrar datos financieros y usuario Auth.

## Endpoint

`DELETE /api/account`

Requiere sesion activa. El endpoint usa el usuario autenticado para obtener `user.id` y despues usa `SUPABASE_SERVICE_ROLE_KEY` para borrar datos con privilegios server-side.

## Tablas cubiertas

| Tabla | Estrategia |
| --- | --- |
| `product_events` | DELETE por `user_id`; si la tabla aun no existe porque el SQL manual no fue aplicado, se omite |
| `subscription_insertions` | DELETE por `subscription_id` y `expense_id` asociados al usuario; si la tabla no existe, se omite |
| `yield_accumulator` | DELETE por `user_id` |
| `recurring_incomes` | DELETE por `user_id` |
| `income_entries` | DELETE por `user_id` |
| `transfers` | DELETE por `user_id` |
| `instruments` | DELETE por `user_id` |
| `subscriptions` | DELETE por `user_id` |
| `card_cycles` | DELETE por `user_id` |
| `cards` | DELETE por `user_id` |
| `expenses` | DELETE por `user_id` |
| `monthly_income` | DELETE por `user_id` |
| `account_period_balance` | DELETE por `account_id` asociado al usuario |
| `accounts` | DELETE por `user_id` |
| `user_config` | DELETE por `user_id` |
| Auth user | `admin.auth.admin.deleteUser(userId)` |

## Pendientes manuales

- Confirmar `SUPABASE_SERVICE_ROLE_KEY` en Vercel/entorno real.
- Ejecutar prueba manual con usuario descartable.
- Verificar en Supabase que no queden filas asociadas al usuario eliminado.
- Confirmar politica de retencion de logs externos de Sentry o proveedor equivalente.
