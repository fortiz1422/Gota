# G03 — Plan de activación: conciliación por checkpoints

**Tipo:** solo documentación. Este ítem **no activa** esquema, flags ni despliegues.

**Referencias:** `docs/audits/g03-checkpoints.md`, `docs/reconciliation-mvp.md`, `docs/supabase-balance-reconciliation.sql`.

**Estado del entorno (producción, staging, Vercel):** por verificar en el momento de ejecutar este plan.

---

## 1. Alcance y decisiones de producto

Activar la conciliación de saldo por cuenta y moneda (`ARS` / `USD`) mediante checkpoints, ajustes y resoluciones. El reconciliador de Mercado Pago queda fuera (`lib/mercadopago/reconciliation.ts`).

Decisiones ya tomadas para validar en el piloto:

| Decisión | Comportamiento esperado al probar |
| -------- | --------------------------------- |
| Campana (Signals Center) | Solo arma tareas de conciliación para la **moneda del snapshot** de Home (`load-intelligence-signals.ts` filtra por `snapshot.currency`). |
| Recordatorios | Sábado y **cierre de mes por la noche** (`America/Argentina/Buenos_Aires`), vía `balanceCheckDue` — sin cron dedicado. |
| Home | El usuario ve el **saldo confirmado** (ej. `$420.000`) como lectura principal y lo **pendiente de explicar** aparte; no mezclar ambos en un solo número opaco. |

Si Home o el copy no coinciden con esto en el build desplegado, tratarlo como brecha de producto (ver G03-E en la auditoría) antes de ampliar adopción.

---

## 2. Feature flags — nombres, efecto y orden

Todos los switches leen el string `'true'` (cualquier otro valor o ausencia = apagado). Los nombres deben coincidir **literalmente** con el código.

### 2.1 Tres flags de conciliación

| Variable | Tipo | Qué habilita (código) |
| -------- | ---- | --------------------- |
| `BALANCE_RECONCILIATION_SCHEMA_READY` | servidor (runtime) | `readCorrections` deja de devolver `[]` y lee workspaces (`lib/reconciliation/repository.ts`). Junto con el flag de escritura, la API exige esquema listo (`app/api/reconciliation/route.ts`). La campana carga `balanceChecks` solo si además está `BALANCE_RECONCILIATION_ENABLED`. |
| `BALANCE_RECONCILIATION_ENABLED` | servidor (runtime) | `reconciliationEnabled()`: ruta `/reconciliation/[accountId]` deja de responder `notFound()`; `POST`/`GET` `/api/reconciliation` dejan de rechazar por `disabled`. Sin este flag, la conciliación no es usable aunque el esquema exista. |
| `NEXT_PUBLIC_BALANCE_RECONCILIATION_ENABLED` | cliente (build-time) | En `components/settings/AccountBottomSheet.tsx`, links «Confirmar ARS» / «Confirmar USD» hacia el flujo de conciliación. Requiere **rebuild** al cambiar. |

### 2.2 Flag de la campana

| Variable | Tipo | Qué habilita (código) |
| -------- | ---- | --------------------- |
| `NEXT_PUBLIC_FF_SIGNALS_CENTER_V1` | cliente (build-time, exportado como `FF_SIGNALS_CENTER_V1` en `lib/flags.ts`) | Campana en Home / tab bar, sheet de señales y `GET /api/intelligence/signals`. Ahí se renderizan los `balanceChecks` que el servidor adjunta al modelo (`components/signals/SignalsNowView.tsx`). Sin este flag, la UI de campana no muestra tareas de saldo aunque el servidor las calcule. |

### 2.3 Orden recomendado de encendido

No prender todo a la vez. Secuencia alineada con `docs/reconciliation-mvp.md` § Rollout:

1. **Esquema en base** (paso 3 de este doc) — sin flags de conciliación aún, o con todos apagados.
2. **`BALANCE_RECONCILIATION_SCHEMA_READY=true`** — habilita lectura de correcciones publicadas en Home (`readCorrections` → `buildLiveBalanceBreakdown` / `heroBreakdown`). Aún sin rutas de escritura si `BALANCE_RECONCILIATION_ENABLED` sigue apagado.
3. **`BALANCE_RECONCILIATION_ENABLED=true`** — API y página de conciliación. La campana puede calcular `balanceChecks` en el servidor si el paso 2 ya está activo.
4. **`NEXT_PUBLIC_BALANCE_RECONCILIATION_ENABLED=true`** — entrada desde la ficha de cuenta (nuevo deploy).
5. **`NEXT_PUBLIC_FF_SIGNALS_CENTER_V1=true`** — presentación de campana y recordatorios visibles (nuevo deploy). Útil cuando los pasos 2–3 están estables; no sustituye al paso 3 para escribir checkpoints.

**Nota:** Los dos `NEXT_PUBLIC_*` viven en variables de entorno de **build** en Vercel; un cambio exige redeploy. Los dos `BALANCE_RECONCILIATION_*` son de **runtime** en el servidor.

---

## 3. SQL y esquema

### 3.1 Dónde está

- Archivo preparado: **`docs/supabase-balance-reconciliation.sql`**
- Comentario del archivo: *PREPARED ONLY* — no modifica producción por sí solo.
- **No** hay migración versionada equivalente en `supabase/migrations/` (confirmado en `docs/audits/g03-checkpoints.md`).

Contenido relevante: tablas `balance_reconciliation_workspaces` y `balance_reconciliation_audit`, RLS lectura dueño / escritura service role, `balance_reconciliation_ledger_snapshot`, triggers de guardia del libro, RPC `save_balance_reconciliation` (10 argumentos) y `save_transfer_reconciliation`.

### 3.2 Qué verificar antes de aplicarlo

| Verificación | Motivo |
| ------------ | ------ |
| Base **aislada** (staging o proyecto Supabase de prueba), no producción personal sin backup | Migración aditiva pero instala triggers en gastos, ingresos, transferencias, cuentas, rendimientos e instrumentos. |
| No existe ya un RPC `save_balance_reconciliation` con **firma antigua de 9 argumentos** | `docs/reconciliation-mvp.md` pide resolver el overload explícitamente antes de adoptar. |
| Tras aplicar: tablas y funciones listadas arriba presentes | Consultar catálogo (`information_schema` / panel Supabase) sin pegar credenciales en tickets. |
| `node scripts/test-balance-reconciliation-sql.mjs <proveedor-pglite-o-db-de-prueba>` en verde | Cobertura RLS, idempotencia, guards, RPC atómico (`docs/reconciliation-mvp.md` § Verification). PGlite es externo a la app. |
| Opcional: `node scripts/test-reconciliation-transfers-sql.mjs <proveedor>` | Transferencias propias en el mismo lock de libro. |
| Regenerar tipos TypeScript de Supabase si el proyecto los versiona | `repository.ts` usa tipos locales hasta refrescar generated types. |

### 3.3 Cómo aplicar (acción humana, fuera de este PR)

1. Revisar el SQL completo en el repo.
2. Ejecutarlo en el entorno elegido (SQL Editor de Supabase o pipeline acordado).
3. Correr los scripts de prueba contra esa base.
4. Solo entonces considerar el paso 2 de flags (`SCHEMA_READY`).

---

## 4. Checklist previo en un entorno (sin secretos)

Marcar cada ítem como **por verificar** hasta inspeccionarlo. No copiar valores de API keys, `service_role`, URLs con tokens ni dumps de `.env`.

### 4.1 Esquema

- [ ] ¿Existen `public.balance_reconciliation_workspaces` y `public.balance_reconciliation_audit`? — **por verificar**
- [ ] ¿Existe `public.balance_reconciliation_ledger_snapshot(uuid)` y RPC `save_balance_reconciliation` / `save_transfer_reconciliation`? — **por verificar**
- [ ] ¿Los scripts `scripts/test-balance-reconciliation-sql.mjs` (y transferencias si aplica) pasaron en esa base? — **por verificar**

### 4.2 Flags (Vercel / hosting)

Inspeccionar en el dashboard de variables de entorno del **proyecto y entorno** (Preview vs Production). Solo registrar `true` / ausente / otro; no publicar el valor completo de secretos no relacionados.

| Variable | Production | Preview / staging |
| -------- | ---------- | ----------------- |
| `BALANCE_RECONCILIATION_SCHEMA_READY` | por verificar | por verificar |
| `BALANCE_RECONCILIATION_ENABLED` | por verificar | por verificar |
| `NEXT_PUBLIC_BALANCE_RECONCILIATION_ENABLED` | por verificar | por verificar |
| `NEXT_PUBLIC_FF_SIGNALS_CENTER_V1` | por verificar | por verificar |

### 4.3 Comportamiento esperado con flags apagados (sanity)

- [ ] `GET` o navegación a `/reconciliation/<uuid>?currency=ARS` → **404** si `BALANCE_RECONCILIATION_ENABLED` ≠ `true` — **por verificar**
- [ ] Home sin correcciones de conciliación si `BALANCE_RECONCILIATION_SCHEMA_READY` ≠ `true` (`readCorrections` → `[]`) — **por verificar**

### 4.4 Calidad de build (recomendado antes del piloto)

- [ ] `TZ=America/Argentina/Buenos_Aires npm test` (suite `lib/reconciliation`) — **por verificar**
- [ ] `npx tsc --noEmit` — **por verificar**
- [ ] Deploy de prueba con los `NEXT_PUBLIC_*` ya en el valor deseado — **por verificar**

---

## 5. Recorrido manual de prueba en celular (paso a paso)

Usar un usuario de prueba con al menos una cuenta en ARS (y opcional USD), PWA o navegador móvil, **después** de encender flags y esquema en ese entorno. Anotar build / deployment ID, no contraseñas.

### 5.1 Entrada y campana

1. Iniciar sesión en la app desplegada.
2. En Home, confirmar moneda del snapshot (selector ARS/USD si aplica).
3. Si `NEXT_PUBLIC_FF_SIGNALS_CENTER_V1=true`, abrir la **campana**.
4. En sábado o noche de fin de mes (Argentina), o con cuenta sin checkpoint reciente, buscar texto tipo **«Confirmá tu saldo de {cuenta}»** solo para cuentas en la moneda del snapshot.
5. Si hay diferencia sin cerrar, buscar **«Seguir con {cuenta}»**.

### 5.2 Confirmar saldo (checkpoint)

6. Ir a **Ajustes → cuenta** (o link de campana) y tocar **Confirmar ARS** (o USD) si el flag público de conciliación está activo.
7. En el paso **check**, revisar que «Gota calcula …» refleje el esperado del libro.
8. Ingresar un monto **confirmado** distinto (ej. esperado `$500.000`, confirmado `$420.000`) y confirmar.
9. En **discrepancy**, ver residual a explicar (ej. `$80.000`) y acciones: Resolver ahora / Ajustar y seguir / Después.

### 5.3 Home y saldo confirmado

10. Volver a Home **sin** ajustar aún (o tras «Después»).
11. Validar decisión de producto: saldo principal coherente con lo **confirmado** donde corresponda, y lo **pendiente** visible o entendible por separado (no solo el esperado del libro).
12. Abrir desglose / sheet de saldo si existe y comprobar que correcciones publicadas (`balanceCorrection`) impactan el vivo solo después de **Ajustar y seguir**.

### 5.4 Ajuste y explicación

13. Reentrar al flujo → **Ajustar y seguir** si el esperado vivo no cambió.
14. En **resolve**, vincular un gasto/ingreso/transferencia candidato o crear uno nuevo; responder «¿Ya estaba en el saldo que confirmaste?» según el caso.
15. Tras explicar parcialmente, comprobar que el pendiente baja y que un movimiento **posterior** al día del checkpoint no se acepta como explicación (mensaje de fecha).

### 5.5 Cierre

16. Probar **Después**: la tarea debe ocultarse ~24 h (`snoozedUntil`) pero la diferencia no publicada sigue sin ajuste.
17. Opcional: desvincular / revertir ajuste desde historial y ver preview de saldo.

Registrar capturas o notas por paso fallido; no subir secretos ni datos reales de terceros.

---

## 6. Rollback (apagar sin borrar dinero)

Objetivo: frenar **nuevas** acciones y entradas UI sin ocultar correcciones ya reconocidas.

### 6.1 Orden inverso (recomendado)

1. **`NEXT_PUBLIC_FF_SIGNALS_CENTER_V1=false`** (o quitar) + redeploy — oculta campana y links de señales de saldo.
2. **`NEXT_PUBLIC_BALANCE_RECONCILIATION_ENABLED=false`** + redeploy — quita «Confirmar ARS/USD» del bottom sheet de cuenta.
3. **`BALANCE_RECONCILIATION_ENABLED=false`** — API y página `/reconciliation/*` vuelven a comportarse deshabilitados (404 en página).
4. **`BALANCE_RECONCILIATION_SCHEMA_READY`** — **no apagarlo** si ya hubo ajustes publicados: `readCorrections` dejaría de alimentar Home y las correcciones «desaparecerían» de la UI aunque sigan en DB (`docs/reconciliation-mvp.md`). Mantener en `true` salvo rollback de esquema acordado con reversión financiera explícita.

### 6.2 Reversión financiera (si hace falta)

No basta con apagar flags: usar el flujo en app (con flags temporariamente encendidos en un entorno controlado) o operación manual auditada:

- Desvincular resoluciones (`undo`) antes de revertir ajustes.
- **Revertir ajuste** (`reverse`) cuando corresponda.
- El esquema y triggers siguen protegiendo movimientos ligados hasta desvincular.

### 6.3 Esquema en base

Revertir tablas/RPC en producción **no** forma parte de este plan. Si se requiere, tratarlo como migración dedicada con backup y ventana de mantenimiento. El archivo en `docs/` permanece como referencia; no se elimina por rollback de flags.

---

## 7. Criterios de «activación documentada» (este ítem)

- [x] Este plan existe en `docs/plans/g03-activacion-conciliacion.md`.
- [ ] Ejecución real de activación (esquema + flags + piloto móvil): **pendiente / por verificar** en entorno destino.
- [ ] Nombres de flags validados contra `lib/reconciliation/repository.ts`, `app/api/reconciliation/route.ts`, `components/settings/AccountBottomSheet.tsx`, `lib/flags.ts`.

**Última revisión de nombres en código:** alineado con `main` en la rama del PR que introduce este archivo.
