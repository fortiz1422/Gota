# Registro de implementación — Mercado Pago v2

Fecha: 30/09/2026. Base verificada: `main` en `ee8ed25abc5ad6b0f71693d96ea8934e0c3da635`.
Rama de trabajo: `feat/mercadopago-integration-v2`. Checkout inicial limpio. No se encontraron AGENTS.md.

## Alcance entregado

Este cambio incluye plumbing/shadow, setup e importación inicial; **MP v2 no está terminado ni activado**.
Se aplicaron las dos migraciones v2 el 1 octubre 2026 con autorización del usuario. No se alteró el canon financiero ni se habilitaron conexiones, cron o auto-post.

- Refresh/decrypt/encrypt compartidos en `access-token.ts`; persistencia protegida por lease cuando se utiliza el job.
- Motor de sincronización manual extraído a `sync-service.ts`; contrato y UI existentes conservados.
- Captura incremental Payments Search aislada de Settlement. Overlap de cinco minutos, tramos de hasta un día, IDs de batch únicos.
- Un rango incompleto, respuesta inválida, persistencia fallida o watermark obsoleto no permite avanzar.
- Corregido límite de paginación que antes devolvía éxito al agotar diez páginas sin completar cobertura.
- Endpoint backend `/api/cron/mercadopago-sync`, autenticado mediante `CRON_SECRET`, flag global y opt-in por conexión. Una conexión por invocación; prioridad por intento más antiguo. Sin schedule en vercel.json.
- Lease compartido entre captura backend y sync manual al activar el flag. Refresh y finalización manual no resucitan una conexión desconectada bajo lease.
- Migración aditiva con watermark, lease y auditoría shadow; RPCs limitadas al service role y fencing de workers obsoletos.
- `FinancialEvent`, política de decisión central y shadow persistido con fingerprint/version/reasons, sin tokens ni payloads en la tabla de decisiones.
- RAW, normalizador, reconciliador, confirmación humana y ledger existentes preservados.

## Decisiones y límites explícitos

La política no considera categoría un bloqueo financiero. INSTORE se conserva como canal desconocido: no demuestra QR.
Saldo MP sólo sería elegible si monto/moneda/fecha/approval/payer son inequívocos, sin refund, con cuenta vinculada, dedupe ejecutado y evidencia de débito compatible.
La ausencia de información de refund se conserva como incertidumbre.
Tarjetas, transferencias, ajustes, refunds y conflictos quedan en review. No se agregó ningún escritor automático al ledger.

**El runner shadow todavía marca `ledgerDedupeChecked=false`**: no pretende haber validado duplicados manuales. Por ello no genera auto-posts elegibles en este tramo. La prueba unitaria del caso elegible usa contexto sintético completo.

El polling usa el rango actual `date_created`. Overlap de cinco minutos no garantiza descubrir cambios tardíos de estado fuera de esa ventana. La reconciliación programada y una estrategia empírica de relectura siguen pendientes.
Las diez páginas se mantienen como presupuesto; una ventana muy densa fallará y repetirá la misma ventana hasta implementar subdivisión. Nunca se saltea automáticamente.
Un fallo shadow posterior a la captura no revierte el watermark: se reevalúa RAW preservado en la siguiente invocación.
El job reevalúa hasta el límite existente de 10.000 observaciones por conexión; superar ese límite falla. Medir costo antes de crecer.
El lease dura diez minutos y los GET de Payments Search tienen timeout de ocho segundos. No se verificó duración máxima del hosting ni tasa efectiva con DB real.

## Pruebas ejecutadas

- Suite completa actualizada: 142 archivos, 911 tests verdes (incluye regresión histórica y decisiones entre fuentes).
- Después del hardening final: regresión focalizada de sync route, incremental, policy y gates del job; TypeScript sin errores.
- ESLint sobre los archivos TypeScript modificados: sin errores ni advertencias.
- Migración ejecutada dos veces en PostgreSQL efímero (PGlite): replay seguro, pertenencia de usuario, exclusión de segundo worker, reclaim de lease, fencing, CAS del watermark, bloqueo tras desconexión y permisos exclusivos de service role.
- `git diff --check` limpio.
- Build local de producción **no validado**: primer intento falló por TLS al descargar Google Fonts. Segundo intento con certificados del sistema fue bloqueado por revisión automática porque disparaba tráfico a Sentry con payload no autorizado. No se reintentó ni se eludió el bloqueo.
- El deployment automático de Vercel para el primer commit `1e6c5d6` quedó Ready, verificado mediante estado de GitHub. Esto no demuestra OAuth ni RAW/ledger real.
- No se realizaron nuevas operaciones controladas de Mercado Pago. La validación inicial fue sintética; posteriormente se incorporó evidencia histórica sanitizada, detallada abajo. Ninguna de esas pruebas verifica efectos reales en saldo, compromisos o Disponible real.

Reproducir PostgreSQL efímero sin agregar dependencia a Gota:

```sh
npm install --prefix /tmp/gota-pg-validation --ignore-scripts --no-save --package-lock=false @electric-sql/pglite
PGLITE_MODULE_PATH=/tmp/gota-pg-validation/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-mercadopago-background-sql.mjs
```

## Activación pendiente — entorno controlado primero

1. Confirmar hosting, plan, límites de ejecución, frecuencia cron y entorno de prueba separado. No asumir Vercel Pro.
2. Background-sync ya aplicado y verificado en la base existente; revisar el mismo esquema al preparar un entorno de prueba separado.
3. Configurar el flag `MERCADOPAGO_BACKGROUND_SYNC_ENABLED=true` solamente allí; `CRON_SECRET` queda server-side. No pegar ni guardar secretos en handoffs.
4. Initial-import también aplicado y verificado en la base existente. El endpoint de setup habilita una conexión sólo al aceptar el período elegido por el usuario; las migraciones no habilitan conexiones.
5. Invocar el endpoint con autenticación de cron y comprobar RAW, watermark, leases, auditoría y reintento sin duplicación con tráfico real.
6. Definir el schedule después de medir duración y carga. Una conexión por invocación implica que la latencia crece con cantidad de conexiones; no prometer diez minutos por usuario.
7. Mantener auto-post bloqueado. La auditoría shadow no es una aprobación para activar escrituras.

## Pendientes respecto del handoff original

P0 implementado en código y SQL: setup today/30/90, cuenta automática inequívoca, onboarding al volver de OAuth, Settings sin fuentes/rangos de sync en el modo nuevo, desconexión y reanudación.
P0 pendiente real: resolver entorno de prueba, activar scheduler según plan/hosting, validar captura con cuenta MP autorizada, estado de salud y reconciliación diaria.
P1 pendiente: matching contra ledger, auditoría de posting, auto-post saldo y exception inbox.
P2/P3 pendiente: mapping de tarjetas, 1/N cuotas con motor canónico, merchant learning, refunds, enriquecimiento ML/servicios y transfers propios.
No se alteró la configuración externa de Settlement ni se agregó webhook, Apple Pay o infraestructura externa.

La matriz original de 16 operaciones sigue pendiente completa. Obtener fixtures reales sanitizados y resultados sobre ledger/compromisos/disponible real antes de habilitar auto-post.

## Verificación directa pendiente

El handoff original provino de ChatGPT. El trabajo lo continúa ChatGPT Work; no se requiere intervención ni un handoff de Hermes.
Supabase y Vercel fueron conectados. Se inspeccionó Supabase y se aplicaron las migraciones preparadas. Las herramientas de Vercel ahora están expuestas, pero `get_project` devuelve 403: el token no está autorizado para el equipo `facundos-projects-11ee7eb5`. Se requiere reautenticar con acceso a ese equipo. No se conoce todavía el plan ni la cadencia cron disponible.
No copiar ni persistir credenciales en el repo o chat.
Para la prueba OAuth personal puede ser necesaria la autorización del titular; esa autorización no se sustituye por mocks.

## Tramo de setup e importación inicial

- `POST /api/integrations/mercadopago/setup` acepta exactamente today/30d/90d para el usuario autenticado. No admite rangos, user IDs ni connection IDs aportados por el cliente.
- La RPC transaccional conserva una cuenta ya vinculada válida. Sin vínculo, sólo reutiliza una cuenta digital activa marcada como Mercado Pago o con nombre exacto Mercado Pago/Mercadopago. Si hay dos, pide selección explícita; no elige arbitrariamente.
- No hay duplicación ni reset del watermark/version al repetir el mismo setup. Cambiar el período después de empezar requiere un flujo de reimportación todavía no implementado.
- Cuenta nueva: digital, no primaria, saldos iniciales 0 **provisionales**. No representa evidencia de saldo MP; el UI lo informa y el auto-post sigue bloqueado. Resolver baseline antes de activar ledger automático.
- La selección explícita de cuenta ante ambigüedad reutiliza el account-link existente.
- El job termina el import inicial sólo al alcanzar el target temporal persistido. Overlap nunca consulta antes del período autorizado.
- Desconectar elimina access/refresh locales, expiry y lease; detiene captura y conserva cuenta, RAW, auditoría y ledger.
- Reanudar después de OAuth conserva watermark y período, sin reimportación silenciosa.
- Trigger impide cambiar a otra identidad MP en una conexión existente; queda pendiente diseñar un flujo explícito de reemplazo de identidad.
- UI nueva gated por el flag backend. Informa que la captura está en validación y aún requiere revisar movimientos; no promete auto-post.
- PostgreSQL efímero verificó reaplicación, períodos, creación/reuso, balances existentes, ambigüedad, idempotencia, identity guard, finalización, disconnect/resume y permisos. Se agregaron tests funcionales de endpoint y render del contrato de UI; no se probó interacción de navegador con OAuth real.

Para repetir la prueba de setup con la misma dependencia temporal PGlite:

```sh
PGLITE_MODULE_PATH=/tmp/gota-pg-validation/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-mercadopago-initial-import-sql.mjs
```

Supuestos no demostrados: cobertura completa personal de Payments Search, metadata buyer/issuer, operaciones tardías y huecos sólo visibles en Settlement. La evidencia parcial histórica no prueba cobertura universal.

## Inspección real y regresión histórica — 1 octubre 2026

- Supabase: un proyecto activo, organización Free, sin ramas de base de datos. La lista de migraciones está vacía, pero el esquema existe; no confundir historial vacío con esquema vacío.
- Las dos migraciones v2 se aplicaron posteriormente, con autorización explícita para avanzar manteniendo cron/auto-post apagados. No se modificaron datos financieros en producción.
- Hay dos conexiones, una activa. La última captura registrada fue el 17 septiembre UTC (16 septiembre en Argentina). Total histórico: 108 RAW; conexión activa: 36 Payments + 18 Settlement.
- Existen protecciones adicionales de identidad en producción ausentes del repo principal: `mercadopago_operation_decisions`, triggers de identidad y locks sobre RAW. No ejecutar de nuevo migraciones antiguas de confirmación que puedan sobrescribirlas. Las migraciones v2 no reemplazan esas funciones.
- Shadow consulta las tablas existentes de confirmaciones y descartes, paginadas y filtradas por usuario/conexión. Compara las native keys de sus snapshots, además del candidate ID. Así conserva decisiones previas cuando cambia el candidate al incorporar una segunda fuente, sin exigir la tabla adicional de producción.
- `lib/mercadopago/fixtures/personal-history.sanitized.json` proviene de los 54 registros de la conexión activa. La sanitización se hizo en SQL antes de devolver datos: identidades remapeadas, nombres/issuer/last4 reemplazados, montos por rangos sintéticos, fechas fijas. Conserva roles, signos, igualdad de importes, identidad entre fuentes, estados, instrumentos, cuotas y contexto de canal. No es RAW exacto ni sirve para validar totales, temporalidad, similitud de merchants o saldo original.
- Evidencia observada: transferencias entrante/saliente, cinco cargas de cuenta bancaria, 18 compras de crédito (tres en dos cuotas), validación de tarjeta con importe cero y seis QR con contexto explícito Mercado Pago/QR en Settlement por native ID exacto. `INSTORE` aislado sigue sin establecer QR.
- Se corrigió la transferencia recibida a `transfer/inflow`; no se convierte a ingreso. Una validación aprobada de tarjeta con importe cero se ignora. Ninguna compra de tarjeta se convierte en débito de MP.
- Evaluación histórica con dedupe simulado como completado: 41 candidatos, 7 elegibles según la política de saldo, 32 review, 1 ignore, 1 espera de reconciliación. Es un ejercicio de reglas, no una tasa real de automatización. El runner real conserva `ledgerDedupeChecked=false`, no escribe ledger y no habilita auto-post.
- No hay evidencia controlada de 3/6 cuotas, refunds, Mercado Libre, servicios ni matching de cuentas propias. La matriz de 16 operaciones continúa pendiente.

## Cambio de base aplicado y verificado — 1 octubre 2026

Se aplicaron en orden `docs/supabase-mercadopago-background-sync.sql` y `docs/supabase-mercadopago-initial-import.sql`, con el MCP `apply_migration`. Versiones registradas: `20261001103546` (`mercadopago_v2_background_sync`) y `20261001103602` (`mercadopago_v2_initial_import`). Agregan columnas, auditoría shadow y RPCs de servicio; preparan lease/watermark, setup, identidad, desconexión y reanudación.

La aplicación no creó cuentas ni gastos y no invocó setup ni rutinas de ledger. Los conteos de accounts, expenses, RAW y decisiones quedaron iguales antes/después. Hay cero conexiones habilitadas, ambos imports `not_started` y cero filas shadow. No se activó el flag, cron ni auto-post. No se creó infraestructura paga.

- Verificación de privilegios: los cinco RPCs nuevos de servicio no son ejecutables por anon/authenticated, sí por service_role; tienen search_path vacío. Auditoría shadow con RLS y sin permisos de lectura/escritura para clientes.
- Huellas de definición de las seis funciones protegidas existentes (confirmaciones y protecciones de identidad) idénticas antes/después. No se sobrescribieron protecciones ajenas a v2.
- Advisors antes/después: única observación nueva INFO `rls_enabled_no_policy` sobre shadow. Es intencional: tabla sólo backend, sin acceso cliente. [Referencia del advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Existen alertas previas fuera del cambio: vista `user_active_cards` con security definer y RPCs legacy públicamente ejecutables. No se modificaron en estas migraciones; requieren revisar uso y permisos antes de endurecerlos. [Vista](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- Bloqueo para probar captura en hosting: el plugin Vercel devuelve 403 para el equipo que aloja Gota. Reautenticar ese scope antes de inspeccionar/configurar entorno, plan y cron. No se intentó eludirlo ni se usaron credenciales alternativas.

La prueba de captura real sigue pendiente: resolver acceso/entorno de hosting, desplegar la rama en prueba y autorizar el período de importación. No se requiere otra aprobación para estas migraciones ya aplicadas.
