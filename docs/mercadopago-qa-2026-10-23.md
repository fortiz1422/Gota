# Mercado Pago — QA local del 23/10/2026

## Alcance y estado

Base real inspeccionada: `a9f0fdb` (main de la copia recuperada). Rama aislada: `qa/mercadopago-2026-10-23`. Este trabajo no incorpora los cambios de revisión de comprobantes/MODO de la rama concurrente.

Se corrigieron dos fallas reproducibles en código y se amplió la cobertura de renovación de credenciales. No se consultaron servicios autenticados, no se leyeron secretos ni datos reales, y no hubo migraciones, cambios de configuración de hosting, publicación o escrituras financieras. Las pruebas no certifican cobertura completa de compras personales de Mercado Pago.

## Fallas reproducidas y corregidas

### Cron de reconciliación interceptado por autenticación de navegador

`/api/cron/mercadopago-reconcile` tiene su propia validación de `CRON_SECRET`, pero `proxy.ts` sólo exceptuaba `/api/cron/mercadopago-sync`. Una invocación de scheduler sin sesión personal era rechazada antes de alcanzar el handler.

La regresión falló sobre la base. La corrección agrega exclusivamente la ruta exacta de reconciliación a la excepción existente. Los handlers siguen exigiendo secreto; rutas con sufijos o subrutas siguen detrás de autenticación de usuario. Ambos handlers se prueban con secreto ausente, inválido y bandera desactivada sin acceso a base. También se prueba reconciliación desactivada con background habilitado.

Esto permite alcanzar el handler cuando se configure el scheduler; no crea un cron ni habilita automatización.

### Página de pagos repetida aceptada como cobertura completa

El contador de captura sumaba filas sin verificar identidad dentro de la ejecución. Un fixture sintético de dos páginas idénticas de cincuenta pagos con `paging.total=100` provocaba `success` y avance del watermark aunque sólo existieran cincuenta pagos únicos persistidos. La regresión falló sobre la base con ese resultado.

La captura ahora rechaza una clave nativa repetida dentro del mismo recorrido. No avanza el watermark y permite reintentar la misma ventana. Las observaciones ya persistidas conservan el upsert existente; el conjunto de identidades es local a la ejecución, por lo que una operación que reaparece en otro sync sigue siendo idempotente. La paginación válida de cincuenta y una operaciones y la repetición normal entre ejecuciones siguen aprobadas.

Límite: rechazar repetidos no convierte la paginación por offset en una instantánea transaccional del proveedor. Cambios de orden o nuevos datos durante una captura aún requieren reconciliación y evidencia real de cobertura. No se afirma que se haya observado esta falla en la cuenta de Facundo; es una condición sintética reproducida.

## Verificación ejecutada

| Verificación | Resultado actual |
| --- | --- |
| Suite MP/spike/settings/contrato UI | 371/371 pruebas; 46 archivos |
| Regresión proxy/reconciliación | Rojo antes del fix; verde después |
| Regresión página repetida/watermark | Rojo antes del fix; verde después |
| Renovación de tokens | 11 pruebas nuevas aprobadas |
| Auth callback, landing y device route | 34/34 pruebas adicionales |
| TypeScript | `npx tsc --noEmit` aprobado |
| ESLint de todos los archivos TS modificados/nuevos | Aprobado |
| Diff whitespace | `git diff --check` aprobado |

Las pruebas nuevas de token cubren reutilización sin refresh prematuro, rotación cifrada antes de devolver el token, conservación del refresh previo si el proveedor no lo rota, estado revocado/token ausente/fecha inválida/falta de refresh, fallo del proveedor, fallo de persistencia y rechazo por lease vencido o escritura fallida. Usan reloj fijo y credenciales ficticias; no llaman a Mercado Pago ni Supabase.

Comandos:

```sh
npx vitest run lib/mercadopago lib/mercadopago-spike lib/settings/mercadopago-expense-review.test.ts lib/mercadopago-review-ui-contract.test.ts
npx vitest run lib/device-auth/device-route.test.ts lib/auth-callback.test.ts lib/landing-html.test.ts
npx tsc --noEmit
npx eslint proxy.ts lib/mercadopago/observability-sync.ts lib/mercadopago/access-token.test.ts lib/mercadopago/cron-proxy.test.ts lib/mercadopago/background-route.test.ts lib/mercadopago/incremental-sync.test.ts
git diff --check
```

## Qué sigue sin estar verificado

- **SQL transaccional y concurrencia en esta sesión:** el runtime no incluye Docker, PostgreSQL nativo ni PGlite; tampoco se encontró PGlite en el bundle Node o cache npm. No se ejecutaron los harness SQL ni se usó una base real como sustituto. Los resultados históricos de CI mencionados por documentos previos no cuentan como ejecución nueva.
- **Build local de esta rama:** aprobado por el agente principal tras el cierre inicial: compilación webpack, TypeScript y generación de 84 páginas completos. Proceso sin credenciales, Supabase ficticio, `GOTA_LOCAL_VERIFY=true`, telemetría desactivada y fuentes originales desde cache local. No equivale a build con configuración real de producción.
- **Deployment:** no ejecutado. Vercel devuelve 403 al consultar proyecto/despliegues en el equipo propietario; requiere acceso autorizado al equipo. El proyecto se identificó sin modificarlo.
- **OAuth real:** reconexión y renovación se verificaron con dobles de proveedor/base. No hay renovación real de credenciales ni verificación de callbacks desplegados.
- **Proveedor real y cobertura personal:** no hay nuevas compras QR/ML, devoluciones ni transferencias controladas observadas. Los fixtures históricos sanitizados conservados se distinguen de los mocks; no demuestran todas las operaciones de la cuenta.
- **Integración financiera completa:** no se confirmó un gasto real para medir saldo, cuotas, ciclos, compromisos y disponible; no se habilitó auto-post.
- **Estado de hosting actual:** el código de `preview-rollout.ts` mantiene automáticos en false y el `vercel.json` versionado sólo programa shared-receipts. Esto no prueba las variables/schedules existentes fuera del repositorio. No se inspeccionó ni modificó el hosting.

## Próximo gate de liberación

Revisión del diff, build de esta rama y verificación de despliegue coordinada por el agente principal. La validación de cobertura real y efectos financieros continúa siendo un gate separado de publicar estos fixes. Sin staging aislado no corresponde fabricar movimientos de prueba en el canon real. No presentar Mercado Pago como terminado por tener 371 unitarias verdes.
