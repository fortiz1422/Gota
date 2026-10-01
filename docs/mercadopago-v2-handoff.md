# Handoff para Hermes — Mercado Pago v2: captura incremental y shadow

Fecha: 30/09/2026. Base verificada: `main` en `ee8ed25abc5ad6b0f71693d96ea8934e0c3da635`.
Rama de trabajo: `feat/mercadopago-integration-v2`. Checkout inicial limpio. No se encontraron AGENTS.md.

## Alcance entregado

Este cambio es el primer tramo de plumbing/shadow; **MP v2 no está terminado ni activado**.
No se aplicaron migraciones ni se alteró el canon financiero de producción.

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

- Suite completa: 137 archivos, 878 tests verdes.
- Después del hardening final: regresión focalizada de sync route, incremental, policy y gates del job; TypeScript sin errores.
- ESLint sobre los archivos TypeScript modificados: sin errores ni advertencias.
- Migración ejecutada dos veces en PostgreSQL efímero (PGlite): replay seguro, pertenencia de usuario, exclusión de segundo worker, reclaim de lease, fencing, CAS del watermark, bloqueo tras desconexión y permisos exclusivos de service role.
- `git diff --check` limpio.
- Build de producción **no validado**: primer intento falló por TLS al descargar Google Fonts. Segundo intento con certificados del sistema fue bloqueado por revisión automática porque disparaba tráfico a Sentry con payload no autorizado. No se reintentó ni se eludió el bloqueo.
- No hubo operaciones reales de Mercado Pago. Todos los escenarios de los nuevos unit tests son sintéticos; no equivalen a fixtures reales ni verifican saldo, compromisos o Disponible real en producción.

Reproducir PostgreSQL efímero sin agregar dependencia a Gota:

```sh
npm install --prefix /tmp/gota-pg-validation --ignore-scripts --no-save --package-lock=false @electric-sql/pglite
PGLITE_MODULE_PATH=/tmp/gota-pg-validation/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-mercadopago-background-sql.mjs
```

## Activación pendiente — entorno controlado primero

1. Confirmar hosting, plan, límites de ejecución, frecuencia cron y entorno de prueba separado. No asumir Vercel Pro.
2. Revisar/aplicar `docs/supabase-mercadopago-background-sync.sql` en ese entorno y verificar constraints/roles reales.
3. Configurar el flag `MERCADOPAGO_BACKGROUND_SYNC_ENABLED=true` solamente allí; `CRON_SECRET` queda server-side. No pegar ni guardar secretos en handoffs.
4. Una conexión de prueba debe tener `background_sync_enabled=true` y `incremental_watermark` definido deliberadamente según el período autorizado. La migración no habilita ninguna ni elige la fecha.
5. Invocar el endpoint con autenticación de cron y comprobar RAW, watermark, leases, auditoría y reintento sin duplicación con tráfico real.
6. Definir el schedule después de medir duración y carga. Una conexión por invocación implica que la latencia crece con cantidad de conexiones; no prometer diez minutos por usuario.
7. Mantener auto-post bloqueado. La auditoría shadow no es una aprobación para activar escrituras.

## Pendientes respecto del handoff original

P0 pendiente: importación inicial today/30/90, creación/vínculo automático de cuenta, UX de conexión, estado humano de salud, reconciliación diaria y polling programado real.
P1 pendiente: matching contra ledger, auditoría de posting, auto-post saldo y exception inbox.
P2/P3 pendiente: mapping de tarjetas, 1/N cuotas con motor canónico, merchant learning, refunds, enriquecimiento ML/servicios y transfers propios.
No se alteró la configuración externa de Settlement ni se agregó webhook, Apple Pay o infraestructura externa.

La matriz original de 16 operaciones sigue pendiente completa. Obtener fixtures reales sanitizados y resultados sobre ledger/compromisos/disponible real antes de habilitar auto-post.

## Próximo handoff necesario de Hermes

- Hosting/plan, entorno de prueba, mecanismo de deploy y estado de migraciones aplicadas.
- Disponibilidad de una cuenta MP OAuth para pruebas y forma de observar RAW sin revelar credenciales.
- Responsables de ejecutar las operaciones controladas y evidencia sanitizada por escenario.

Supuestos no demostrados: cobertura personal de Payments Search, metadata buyer/QR/cuotas/issuer, operaciones tardías y huecos sólo visibles en Settlement.
