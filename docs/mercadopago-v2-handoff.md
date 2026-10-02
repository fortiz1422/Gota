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

- Suite completa actualizada: 143 archivos, 916 tests verdes (incluye regresión histórica, decisiones entre fuentes y límite de autenticación del cron).
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
Supabase y Vercel fueron conectados. Se inspeccionó Supabase y se aplicaron las migraciones preparadas. Vercel devuelve 403 al enviar `teamId`, pero permite leer Gota y sus deployments usando el contexto predeterminado de la misma conexión (sin `teamId`). No requiere otra reconexión para esas lecturas. No se conoce todavía el plan ni la cadencia cron disponible.
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
- Lectura de hosting resuelta usando el contexto predeterminado autorizado de la conexión. La obtención del preview protegido aún falla por permisos; no se intentó quitar protección ni usar credenciales alternativas.

La prueba de captura real sigue pendiente: resolver acceso/entorno de hosting, desplegar la rama en prueba y autorizar el período de importación. No se requiere otra aprobación para estas migraciones ya aplicadas.

## Hosting y entrada del cron — 1 octubre 2026

- Proyecto Vercel Gota inspeccionado: Next.js, Node 24, región de deployment iad1. El preview del commit `7546aa6` está READY; producción sigue en `ee8ed25`. No se promovió ni fusionó el PR.
- El wrapper de herramientas anuncia `projectId`, pero el endpoint real de get_project requiere `idOrName`. Enviar teamId explícito causa 403 y list_teams devuelve vacío. Consultar el proyecto conocido por nombre con el contexto predeterminado funciona; list_deployments y get_deployment también. No fue necesario pedir ni obtener otro token.
- Las peticiones del plugin a las URLs del preview protegido fueron rechazadas por Vercel. No constituyen una respuesta del handler de Gota ni prueban su funcionamiento. La conexión ofrece lectura de deployments pero no expone herramientas para gestionar variables de entorno.
- Se detectó y corrigió un bloqueo adicional en código: proxy redirigía el cron a login porque exigía sesión de Supabase. La excepción ahora coincide sólo con `/api/cron/mercadopago-sync` y deja la autorización a su handler con CRON_SECRET. No se abre un prefijo de rutas ni los endpoints de setup/sync.
- Tests verifican llegada al handler sin sesión/dependencia auth, protección de rutas vecinas, rechazo de secreto ausente/incorrecto y modo disabled con secreto válido. No hay schedule añadido ni job activado.
- La configuración del entorno de prueba y la prueba autenticada del endpoint siguen pendientes de acceso al panel o herramienta de gestión de entornos. No solicitar una nueva reconexión genérica: la lectura ya funciona.

## Handoff para Hermes — configuración de Preview, 1 octubre 2026

Este registro conserva el estado del trabajo realizado por ChatGPT Work; no delega la implementación.

- Decisión autorizada por el usuario: extender a Production y Preview las variables existentes `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET`, `MERCADOPAGO_TOKEN_ENCRYPTION_KEY`, `MERCADOPAGO_REDIRECT_URI` y `CRON_SECRET`. Se guardó cada cambio desde el panel de Vercel y se verificó su alcance. Los secretos no se revelaron, copiaron al workspace ni rotaron. El permiso aplica a todos los previews del proyecto, no sólo a esta rama.
- Se agregó `MERCADOPAGO_BACKGROUND_SYNC_ENABLED=true` como Config exclusivamente para la rama `feat/mercadopago-integration-v2`, en Preview. Production no recibió el flag. Las credenciales por sí solas no habilitan conexiones ni auto-post.
- El callback conserva `https://gota-arg.vercel.app/api/integrations/mercadopago/callback`. Sirve como configuración requerida para usar la conexión existente; no valida OAuth nuevo desde Preview. Ese recorrido requiere un callback y sesión coherentes con el host de prueba.
- Plan observado en el panel: Hobby. No se contrató infraestructura ni se agregó cron de MP; la cadencia inicial del scheduler sigue pendiente y debe respetar el plan.
- Se solicitó un redeploy del commit `e6143216fafec35d339c970c07ca7de9252118f4`, verificando destino Preview, rama correcta y dominio de rama. Deployment: `dpl_3EbnCJn5PGZDBUnppEfNPXLJwQdP`.
- Supabase después de configurar Preview: cero conexiones con `background_sync_enabled=true` y cero imports iniciados. No se invocó setup, refresh, captura ni posting.
- Riesgo: Preview usa la base existente y ahora puede descifrar las credenciales de MP. La protección del deployment se conservó. Mantener shadow sin escrituras de ledger; los previews de otras ramas también tienen las cinco variables ampliadas.
- Redeploy verificado READY mediante plugin y panel, duración 1m52s. URL del deployment: `https://gota-gvi0kz6o5-facundos-projects-11ee7eb5.vercel.app`. Conserva el commit `e614321` y destino Preview. No se promovió producción.
- Intento de navegación del navegador a `/api/cron/mercadopago-sync` sin secreto: `net::ERR_BLOCKED_BY_CLIENT`. Es un bloqueo del cliente, no una respuesta HTTP del handler; no demuestra 401, readiness ni ejecución. No se leyó el secreto para intentar sortearlo.
- Pendientes: probar límites de autenticación en el host nuevo con un cliente autorizado, elegir explícitamente período de importación para la cuenta autorizada, ejecutar captura real, comparar RAW/decisiones y completar la matriz controlada. La suite previa sigue en 143 archivos/916 tests; estas acciones son configuración y documentación, no nuevas pruebas de negocio.

## Prueba autenticada de captura preparada — 1 octubre 2026

- El plugin volvió a rechazar el fetch protegido. La navegación al dominio de rama sí llegó al login de Gota: el login de Vercel no constituye una sesión de Supabase en la aplicación.
- Se implementó `POST /api/integrations/mercadopago/capture-probe`, visible en Opciones avanzadas sólo con `probeAvailable` en Preview. El backend exige además `VERCEL_ENV=preview`, flag de rollout, Origin del mismo host y sesión Supabase validada. Rechaza identidades/connection IDs del cliente y se deshabilita en producción.
- Consulta un único día argentino de los últimos 90 días y repite exactamente la ventana bajo un mismo lease. Reusa access-token, incremental-sync, RAW y shadow existentes. No requiere setup ni habilita la conexión; no crea/vincula cuentas ni avanza watermark. Puede refrescar y persistir tokens cifrados si vencieron.
- Responde sólo conteos y estado de repetición. Cero eventos no prueba deduplicación; claves distintas o crecimiento en la segunda pasada se declara inconcluso. Captura incompleta falla sin afirmar una prueba exitosa. Hay deadline compartido de 45 segundos para consultas de proveedor y timeout de ocho segundos por request; maxDuration del handler 120 segundos.
- La UI explica que guarda evidencia y no registra gastos, saldos ni compromisos. No se añadieron schedules, infraestructura ni políticas de auto-post. `ledgerDedupeChecked` sigue false en el runner real.
- Verificación local: suite completa 145 archivos/930 tests verdes; TypeScript, ESLint de archivos cambiados y diff check pasan. Casos nuevos cubren exclusión de producción, Origin/sesión/identidad, fechas, repetición, captura incompleta, cambio de identidad bajo lease y sanitización de errores.
- Deploy verificado READY: `dpl_E8XpCUHZL4ua79fWmMeoZWmZwwo8`, commit `2867f6c2db2055cd3c0ac9909d706af275e117a5`, URL `https://gota-qa9hll0nu-facundos-projects-11ee7eb5.vercel.app`. El alias de rama llega al login de Gota sin el bloqueo de navegación del endpoint anterior.
- Login de Gota mediante Google iniciado con formularios seguros. Google informó explícitamente que el intento terminó por inactividad; no se verificó sesión de Gota ni se ejecutó capture-probe. No se debe inferir que se enviaron credenciales a partir de un formulario que venció.
- Pendiente real: completar ingreso a Gota en el navegador compartido y ejecutar la prueba para el dueño de la conexión. No requiere reconectar MP, activar setup ni escoger un período de importación. Los mocks y el build no constituyen evidencia de una llamada real a MP ni validan la matriz de operaciones.

## Handoff para Hermes — bloqueo de autenticación, 1 octubre 2026

### Hechos y evidencia

- El usuario informó que el email de Supabase contiene un magic link, mientras la UI solicita seis dígitos. No se leyó el correo ni se recibió su enlace/credencial por chat. `sendOtpEmail` usa `signInWithOtp`; la documentación oficial confirma que el contenido del template determina magic link versus OTP: https://supabase.com/docs/guides/auth/auth-email-passwordless.
- Google completó el ingreso de email/contraseña mediante browserAuth y el usuario informó aprobar la notificación en su teléfono. La navegación de retorno intentó acceder a `gota-arg.vercel.app`, fuera del Preview entonces autorizado; auto-review la bloqueó. El usuario autorizó después verificar producción sólo en lectura.
- En producción se observó el banner **Modo exploración**, no una sesión permanente confirmada. El Preview volvió a `/login`. No se puede afirmar que la cuenta del usuario quedó autenticada en ninguno de los dos hosts. No se ejecutó capture-probe.
- La petición OAuth visible sí incluía `redirect_to` al callback del Preview. Hipótesis principal: ese callback no está permitido en Supabase y el retorno cae al Site URL. No se verificó el allowlist y no debe presentarse como hecho. Referencia: https://supabase.com/docs/guides/auth/redirect-urls.
- Auto-review rechazó una consulta SQL a `auth.users`/`auth.sessions` y abrir el dashboard de Supabase por ser una fuente administrativa privada no cubierta por la autorización específica. No se eludieron los rechazos. La consulta agregada de fuentes de logs sólo devolvió conteos, no datos de sesión ni credenciales.

### Cambios concretos preparados

- `/auth/callback` ahora falla explícitamente si falta code, hay error de proveedor, falla el intercambio, falla `getUser`, no hay usuario o sólo hay usuario anónimo. No propaga detalles de proveedor/códigos al cliente y no da por exitoso un callback fallido. Telemetría de linking sólo después de validar el usuario; su fallo no invalida un login correcto.
- Destinos `next` quedan dentro del origen que inició el callback; se rechazan URLs externas, protocol-relative y backslashes. Conserva rutas locales y el destino create-password del upgrade por email.
- `/auth/error` explica que el ingreso no se completó y que podría haber vencido o vuelto al entorno equivocado; no afirma una causa sin evidencia.
- Template exacto preparado en `docs/auth-magic-link-otp-template.html`: incluye `{{ .Token }}`, sin enlace, para que el email Magic Link coincida con el OTP de la UI. **No aplicado en Supabase**. Revisar también Confirm Signup antes de afirmar que el primer registro por email está validado.
- Pruebas: 12 casos de callback; suite completa **146 archivos / 942 tests**, TypeScript, ESLint focalizado y `git diff --check` pasan. Son pruebas locales; no prueban login real ni llamadas a MP.

### Propuesta administrativa limitada, pendiente de autorización

1. Leer sólo Auth URL Configuration y el template Magic Link del proyecto `wfwkrenyoxiswaeafpjc`, para confirmar la causa. No leer claves, registros de usuarios ni sesiones privadas.
2. Con aprobación de cambio de acceso a tiempo de acción, agregar únicamente el callback exacto del alias estable de la rama: `https://gota-git-feat-mercadopago-int-19f03c-facundos-projects-11ee7eb5.vercel.app/auth/callback`. No usar wildcard ni cambiar Site URL de producción. Alias observado en el deployment `dpl_6RD5NofM3ZtvyLBRGszsg9ZtKZog`, SHA `29ca34f`.
3. Reemplazar sólo template Magic Link por el archivo preparado. Riesgo: template compartido entre producción y Preview; cambiaría los correos passwordless de ambos. Conservar expiración, MFA y límites existentes.
4. Probar una vez OTP en el mismo alias, mediante browserAuth; confirmar sesión permanente en ese host antes de tocar captura.
5. Ejecutar capture-probe de un día con operaciones existentes, repetir y comparar los conteos. No registrar ledger, no habilitar conexión/import ni auto-post. Si hay cero eventos, deduplicación sigue inconclusa.

### Decisiones y pendientes

- No insistir con más rondas Google sin corregir/confirmar el retorno. No copiar sesión, cookies o tokens entre hosts ni abrir endpoint de captura en producción.
- Producción no recibió cambios de código ni configuración; PR #124 sigue draft. Auto-post apagado. No hay resultado real de captura/deduplicación que reportar.
- Falta autorización para inspeccionar la configuración administrativa y, luego, aplicar el alcance exacto propuesto. El usuario puede aprobar sin delegar el trabajo a Hermes; este handoff es registro de continuidad.
- El push por CLI falló por falta de credenciales de GitHub en este entorno. El intento posterior de crear el primer blob mediante el conector fue rechazado por auto-review: consideró que publicar código privado en `fortiz1422/Gota` no estaba explícitamente autorizado en este turno. No se eludió ni se subió ningún archivo por ese camino. La corrección permanece **local**, pendiente de permiso de publicación en la rama existente del PR #124. No hay nuevo deployment para esta corrección y no se verificó su UI desplegada.
- Permisos concretos pendientes: publicar los cinco archivos preparados en `feat/mercadopago-integration-v2` (sin merge ni producción), y abrir en lectura únicamente Auth URL Configuration / template Magic Link en el dashboard de Supabase. Cualquier cambio que agregue un callback se confirmará con el alcance exacto a tiempo de acción.


## Verificación real de Preview — 2026-10-01 (Argentina)

- Usuario informó haber agregado el callback exacto de Preview en Supabase Redirect URLs. No se inspeccionó el panel; la plantilla Magic Link sigue pendiente.
- Login Google probado desde la Preview: retorno al mismo origen y sesión permanente verificada en Configuración (Cuenta personal / acceso con Google), sin otro ingreso de credenciales en esta prueba.
- Capture probe de 2026-10-01: 0 / 0 operaciones, RAW Payments Search 36 → 36 → 36, 41 evaluaciones shadow. No valida dedupe con operaciones.
- Capture probe de 2026-09-16: 2 / 2 operaciones, RAW Payments Search 36 → 36 → 36, repetición estable y 41 evaluaciones shadow. UI reporta Gastos registrados: 0. No se inició importación, no se pulsó Continuar ni acciones de pago.
- Interacción: fill automatizado de input date cambió DOM pero no estado React; se repitió accidentalmente el rango de hoy. Entrada por teclado nativo corrigió la fecha; valor 2026-09-16 confirmado durante ejecución. No se atribuye aún a bug de producto.
- Evidencia visual: gota-mp-replay-20261001.jpg en conversación.
- Alcance: valida login y replay sobre dos operaciones ya observadas; no valida captura de nuevas filas, cron desplegado, matriz de 16 escenarios, auto-post ni efecto sobre disponible real.
- Pendientes: revisar semántica por escenario y fixture sanitizado, probar operación nueva controlada, configurar cadencia de captura cuando corresponda. Producción y canon siguen sin habilitar auto-post.


## Escenario controlado: MP → BBVA ARS 1.000 — 2026-10-01

- Usuario informó transferencia propia de MP a BBVA aproximadamente 22:27 Argentina. Verdad esperada del escenario: transferencia propia saliente; nunca gasto automático. No se recibió comprobante ni se ejecutó la transferencia desde el agente.
- Probe ejecutado 22:29:10 Argentina sobre día 2026-10-01. Dos source runs Payments Search success, count 0 / 0. UI RAW de conexión 36 → 36 → 36 y 41 evaluaciones históricas shadow. Ninguna evidencia nueva de la transferencia.
- Conteos globales antes/después: expenses 1835 / 1835, accounts 58 / 58, RAW Payments Search 72 / 72. Consulta de RAW Payments Search date_created desde 2026-10-01T03:00Z: 0 observaciones.
- Resultado: captura técnicamente completada, cobertura/normalización/clasificación del escenario NO validadas. No existe evento recibido para afirmar transferencia correctamente clasificada. Hipótesis: demora o ausencia de cobertura Payments Search para retiro/transferencia bancaria.
- Próximo chequeo: reconciliación Settlement para misma ventana, sin apropiarse de config externa. El probe actual captura únicamente Payments Search; aún no se ejecutó Settlement para este escenario. No hace falta que el usuario mueva más dinero para repetir la consulta.
- Evidencia: gota-mp-transfer-probe-20261001.jpg en conversación. Canon sin modificaciones de esta prueba.


## Diagnóstico Settlement en Preview
- Endpoint de captura acepta source settlement explícito, con mismos límites de Preview, sesión, origen y lease. Consulta un día argentino, no cambia import/opt-in/watermark/cuentas/ledger.
- Reusa Settlement Report y refresh común; allowConfigCreation=false impide crear configuración cuando falta y no hay PUT de configuración. Puede solicitar generación de un reporte del día, conserva cooldown y estado pending.
- UI avanzada: Consultar reporte de saldo; distingue pending/error/success, no afirma que el evento esté confirmado sólo por recibir un reporte.
- Verificación: 146 archivos / 947 tests verdes, TypeScript y eslint de archivos modificados pasan. Prueba real Settlement todavía pendiente al publicar.
