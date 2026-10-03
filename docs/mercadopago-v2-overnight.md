# Mercado Pago v2 — checkpoint nocturno

Fecha: 2026-10-02, Argentina. Pedido de Facundo: avanzar sin esperarlo, documentar bloqueos y entregar informe completo al despertar (~07:22 Argentina). Ejecución ChatGPT Work, sin Hermes/subagentes.

## Base publicada

Rama feat/mercadopago-integration-v2; draft PR #124. HEAD de inicio de este bloque 0451f6c. Producción ee8ed25 no modificada. UX de revisión ya publicada y validada visualmente; captura y clasificación siguen en shadow, sin auto-post ni background habilitados para el usuario.

## Bloque completado en este checkpoint

Ledger matcher y repository read-only conectados a shadow: moneda/importe exactos, fecha +/- un día Argentina, cuenta/funding compatibles; cuenta ausente conserva duda, merchant sólo señal explicativa. Consulta exact-count bounded, falla o truncamiento no habilitan dedupe. Rule version 3. No se resuelve ni borra duplicado automáticamente. Servicio persiste exclusivamente shadow audit.

Pruebas: suite completa 996 / 151 archivos incluyendo matcher y servicio shadow; tsc y ESLint de archivos editados verdes. SQL real read-only verificó expenses.date timestamptz y ausencia de gasto de ARS1000 en ventana consultada, lo que NO confirma la transferencia MP.

### Card matcher determinístico

Implementado sobre el editor canónico de compras con tarjeta. Requiere tarjeta de crédito y últimos cuatro válidos; marca sola nunca alcanza. Una única coincidencia activa por últimos cuatro se preselecciona. Si varias tarjetas comparten dígitos, la marca del proveedor sólo puede desambiguar contra una marca reconocible en el nombre libre de Gota. Cero o múltiples coincidencias no eligen arbitrariamente y muestran una explicación al usuario; la selección sigue siendo editable antes de confirmar.

No se agregaron columnas brand/issuer ni se leyó metadata sensible real para simular identidad. El schema actual de cards sólo tiene name y last_four, por lo que issuer no puede participar de forma determinística todavía. Sin escrituras de ledger o DB. Suite completa: 1001 tests / 152 archivos; TypeScript, ESLint y build productivo Next verdes. El primer build encontró TLS al descargar Google Fonts; la opción oficial de certificados del sistema permitió completar compilación, typecheck, 75 páginas estáticas y optimización.

### Aprendizaje simple de comercio/categoría

Reutiliza counterparty_profiles/counterparty_aliases y el editor canónico. En confirmaciones MP, “Recordar este comercio” queda activo por defecto pero visible y reversible. La memoria se escribe sólo después de una confirmación financiera exitosa. Si el comercio ya existía, una corrección actualiza default_category; antes sólo conservaba la categoría anterior. Si falla la memoria, el gasto confirmado no se revierte ni se duplica y la bandeja informa que sólo falló la preferencia.

No hay IA nueva ni aprendizaje sobre semántica financiera. Transferencias, funding, cuotas y tipo económico no se derivan de esta regla. Sin migración ni escritura durante las pruebas. Tests focalizados 28/28; suite completa 1002/1002 en 152 archivos, TypeScript, ESLint y build productivo Next verdes.

### Verificación visual segura en Preview

Con la sesión autenticada existente se inspeccionó la bandeja real sin pulsar Continuar ni Registrar y sin editar datos persistentes. El Preview mostró 39 pendientes: 26 para completar y 13 que necesitan más información. Al abrir una compra aprobada con tarjeta master terminada en 8215, el matcher no encontró una coincidencia única y dejó el selector vacío con explicación explícita; no eligió una tarjeta arbitrariamente. El control “Recordar este comercio para próximas veces” apareció activo por defecto y editable. Se canceló el formulario sin guardar.

También se abrió una compra real informada por Mercado Pago en 2 cuotas. La UI la mantuvo no confirmable, explicó que el soporte todavía no está disponible y sólo ofreció mantenerla pendiente o desestimarla. No hubo escrituras ni confirmaciones. Esto valida el comportamiento visual del Preview y sus gates, no la corrección contable de una operación real registrada ni cobertura completa del proveedor.

### PAYOUTS observado y clasificado sin convertirlo en gasto

El reporte del día argentino 2026-10-01 pasó de pending a success y entregó una fila real compatible con la transferencia controlada: `PAYOUTS`, ARS -1.000, 1/oct 22:26:52 Argentina, con efecto neto y real también -1.000. Payments Search no había observado el evento. La fila demuestra una salida del saldo MP, pero no contiene evidencia suficiente para afirmar destino BBVA ni cuenta propia.

Se agregó un fixture sanitizado mínimo y el normalizador clasifica sólo `PAYOUTS` negativo de Settlement como `transfer/outflow`, manteniendo role, funding, destino y aprobación desconocidos. Cero o positivo no se clasifican como salida. El pipeline completo termina en `review` y la UX “Transferencia por resolver”; nunca en gasto, ingreso o auto-post. Suite completa 1006/1006 en 152 archivos, TypeScript y ESLint focalizado verdes. No hubo escritura real de ledger ni activación.

### Posibles duplicados: shadow visible y confirmación bloqueada

La bandeja ahora consume únicamente decisiones shadow de la regla vigente cuyo `candidate_id` y fingerprint coinciden exactamente con la evidencia RAW reconstruida. Un match `possible_ledger_duplicate` se proyecta como el marcador público mínimo `possible_duplicate`: no expone IDs de gastos, fingerprints, motivos internos ni datos del ledger. La tarjeta pasa a “Necesitan más información”, explica que puede ser un movimiento ya registrado y ofrece comparar, sin afirmar que sean iguales ni vincular/borrar silenciosamente.

Se unificó el fingerprint de shadow, stale protection y confirmación humana en una sola función canónica. Decisiones de otra versión, evidencia anterior, otro resultado o lectura fallida se ignoran/fallan cerradas. Además, el POST de confirmación de gasto repite la consulta read-only de dedupe justo antes del RPC: si no puede verificar, responde `dedupe_unavailable`; si encuentra candidatos, responde `possible_duplicate`; en ambos casos no escribe ledger. Las compras con tarjeta continúan fuera de este matcher porque todavía no existe un matcher canónico equivalente para card purchases.

No se implementó todavía “Vincular” ni “Mantener ambos”: ambas decisiones requieren una auditoría transaccional persistente con ownership, stale protection e idempotencia; ofrecer botones sin esa garantía sería engañoso. Suite completa 1012/1012 en 152 archivos; TypeScript, ESLint focalizado y `git diff --check` verdes. No hubo escritura real ni migración aplicada.

### Gate corregido con evidencia visual real: transferencia nunca es gasto

La inspección autenticada del Preview después de incorporar el `PAYOUTS` real reveló un bug de precedencia: el normalizador ya producía `transfer/outflow`, pero el gate heredado de débito de saldo la ubicaba entre los movimientos confirmables como gasto. La fila real de ARS 1.000 permitió detectarlo; no se pulsó ni confirmó.

Se corrigieron ambos límites, no sólo el texto: `isReviewableMercadoPagoExpense` excluye tipos financieros conocidos transfer/income/neutral y reversos; `eligibleMercadoPagoExpense` aplica el mismo gate en el endpoint antes de cualquier RPC. La presentación de transferencias y refunds tiene prioridad sobre la tarjeta genérica de salida de saldo. Así, incluso una llamada HTTP directa no puede convertir el `PAYOUTS` observado en gasto.

Verificación local: tests nuevos con transferencia que tiene balance debit real, suite completa 1015/1015 en 152 archivos, TypeScript, ESLint focalizado y `git diff --check` verdes. Deployment READY y comprobación visual autenticada repetida sin acciones de escritura: la bandeja mantuvo 40 pendientes, pero pasó de 27/13 a 24 “Para completar” y 16 “Necesitan más información”. La fila ARS 1.000 del 1/oct quedó explícitamente como “Transferencia por resolver”, con la advertencia de que no se registra como gasto ni ingreso. No se pulsó Continuar, Registrar ni Desestimar.

## Orden siguiente

1. Diseñar resolución de duplicados (`linked_existing` / `keep_both`) sólo con audit/stale/ownership/idempotencia transaccionales; no habilitar vínculo parcial inseguro.
2. N cuotas: auditoría terminada. El motor actual crea N filas agrupadas, divide el total y las asigna a ciclos futuros; la UI las muestra individualmente. Esto sostiene compromisos pero no materializa literalmente “gasto económico total hoy” del handoff. Extender el RPC exige decidir si el grupo existente es la compra canónica aceptable o si hace falta una entidad madre; no cambiar sólo UI/gate. Preparar migración revisable, no aplicarla al canon real sin autorización específica.
3. Verificar UX Settings/onboarding y alertas/origen de movimientos, estados humanos; conservar técnicos en advanced y evitar mentir sobre automatización que sigue apagada.
4. Documentar matriz de 16 escenarios: real observado vs synthetic test vs pendiente. Transferencia saliente tiene evidencia real parcial (salida `PAYOUTS`, sin destino); no equivale todavía a reconciliación de cuenta propia. Ninguna prueba mock equivale a operación controlada real.

## Accesos y publicación

GitHub, Supabase y Vercel leídos con éxito este turno. CUA sesión existente estaba disponible en última comprobación. Si login vence: documentar y seguir código/test, nunca pedir credenciales. Repo remoto permite fetch; push shell carece credenciales. Publicar github_create_tree/create_commit/update_ref force:false; revisar HEAD remoto antes y alinear local sólo si contenido exacto. GitHub structuredContent directo; Vercel teamId vacío funciona, projectId prj_nyZGQADbn6IWx28sJoEF54BfN6Ij. Preview https://gota-git-feat-mercadopago-int-19f03c-facundos-projects-11ee7eb5.vercel.app/.

Supabase wfwkrenyoxiswaeafpjc: lectura mínima scoped user 9083ebd0-6082-4067-9bd8-ef07e346a1d9, conexión 4400a8ef-7c60-44a2-8ac0-6f6e087bee3d. Nunca tokens, auth.users/sessions, CVU/CBU. La vigilancia transferencia ARS1000 sigue separada, no avanzar producto esperando pending; no cambiar esa tarea.

## Límites de la entrega

Autorizado código, tests, commits en rama/draft PR y Preview. No merge/promoción producción, cambios config externa MP, activación background/import/autopost, nuevas transacciones ni pruebas que escriban ledger/cuentas/saldos/compromisos reales. No pulsar Continuar/Registrar en la cuenta real. Migraciones como archivos revisables.

El software puede avanzar sin login; validación real proveedor, matriz financiera y habilitación de auto-post no se sustituyen por más tests de código. Informe final debe decir qué cambió para usuario, tests verificadas, evidencia real, blockers y gates pendientes sin declarar MP v2 completa si faltan.

### Transferencias como gasto sugerido, 2026-10-02

Decisión del usuario: en esta versión, una transferencia saliente puede confirmarse como gasto con saldo MP, o descartarse si fue entre cuentas propias. No implementar detección de destinatario ni transferencia interna. Esta decisión reemplaza el bloqueo absoluto documentado arriba; el tipo original del proveedor se conserva.

Implementado: cliente y endpoint aceptan transfer/outflow sólo con débito observado, monto negativo finito ARS/USD y fecha válida. Transferencias entrantes, evidencia insuficiente, reversos, funding de tarjeta y cuotas múltiples siguen bloqueados. La bandeja muestra “Transferencia saliente”, “Revisar como gasto” y explica confirmar consumo o descartar movimiento propio. Descartar no crea un traspaso entre cuentas.

Dedupe: la confirmación compara la proyección del gasto humano (importe absoluto y fecha del débito, funding MP) sin reclasificar la evidencia original. El matcher original rechazaba transfer/unknown funding como no comprobable. Se preserva fail-closed y bloqueo de duplicados. La fecha enviada al RPC ahora usa el calendario argentino, coherente con la bandeja y dedupe: 2026-10-02T01:26:52Z corresponde a 2026-10-01.

Verificación: 1025 tests en 152 archivos, TypeScript, ESLint focalizado y diff --check verdes; render estático de bandeja comprobado. No se confirmaron ni descartaron movimientos reales, ni se activó auto-post. Pendientes: verificación autenticada sobre el nuevo Preview y matriz real de compras. Producción y modelo de cuotas siguen fuera de este cambio.


## Entrega adicional del 2/oct — cuotas, duplicados y posting preparado

La decisión posterior del usuario acepta el motor agrupado existente como compra canónica, sin entidad madre nueva. Implementadas N cuotas vía motor compartido y RPC transaccional revisable; importe usa total paid explícito, nunca monto multiplicado por cuotas. Snapshot RAW/tarjeta/ciclos, replay estricto de todo el grupo, bloqueo de native key reutilizada y rollback conjunto. Mantiene fecha argentina en lugar de UTC.

Implementados Vincular/Mantener ambos con comparación ownership-scoped, snapshot, audit y lock compartido de gastos. Vincular conserva la fila manual; Mantener ambos abre el editor y registra únicamente al confirmar. Auto-post Phase C preparado con doble flag + opt-in explícito en connection + revalidación SQL: sólo compra aprobada de saldo, con Settlement y fecha del débito, sin transfer/refund/card/duplicate. Regla shadow 4 exige fecha de saldo. Categoría incierta usa fallback canónico Otros.

Reconciliación Settlement separada del fast path: días argentinos cerrados, tres días con overlap, controles diarios/cooldown; no modifica ni crea config MP. Settings con Advanced aun cuando rollout está apagado; detalle de gasto con origen MP; guard de fingerprint visto por usuario antes de confirmar.

Migraciones nuevas/actualizadas siguen como archivos revisables. No flags, opt-ins ni cron schedule activados; no escrituras de prueba reales ni promoción/merge. Matriz/gates y límites detallados en `docs/mercadopago-v2-validation-matrix.md`. Verificación actual: suite 1044 tests /154 archivos (antes de agregar tests de provenance), tipos/lint verdes, PostgreSQL WASM 19 checks de cuotas y 22 de posting. Se verificó sesión Preview existente, sin confirmar/desestimar. Build local volvió a requerir certificados de sistema para fuentes; resultado final se registrará después de cerrar publicación.

Pendientes reales: aplicar migraciones en entorno autorizado, carrera multi-cliente PostgreSQL nativo para funciones nuevas y trigger, pruebas de ledger/compromisos/disponible reales autorizadas, revisión shadow, habilitar cadence de hosting sólo después. Nada de esto se sustituye por tests sintéticos. La sesión de Preview estuvo disponible; login no es bloqueo actual.


### Verificación final de código de esta entrega

1.048 tests /155 archivos verdes; TypeScript y ESLint focalizado verdes. PostgreSQL WASM: 20 checks de cuotas +22 de posting (42). Los scripts admiten `--docker` para PostgreSQL nativo con carrera de dos clientes; preparado pero no ejecutado aquí por ausencia de Docker.

El build habitual fue bloqueado por revisión automática ante posible subida de source maps/metadatos por Sentry. Se implementó la alternativa explícita local `GOTA_LOCAL_VERIFY=true`, con source maps/upload, creación/finalización de release y telemetría de build deshabilitados. `NEXT_TELEMETRY_DISABLED=1` evita también telemetría Next. Esa variante completó build productivo Next; no se presenta como prueba de uploads Sentry ni de deploy. Se conserva el flujo de deploy existente por defecto; verificación de Preview a continuación.


### Publicación y verificación segura de Preview

Commit de implementación `5e43f233b0a7d2e5c6e3e8f13316d5d254173cab` publicado en la rama, conservando contenido exacto y el trabajo local de transferencias. Draft PR #124 actualizado en título/descripción y confirmado draft=true, merged=false, base ee8ed25. Vercel deployment `dpl_76gC331ndLkPQ8C6bb5AYvha845q` READY, target Preview.

Sesión autenticada disponible: bandeja real 40 pendientes, 27 para completar/13 excepciones. PAYOUTS ARS1.000 del 1/oct ahora ofrece la interpretación humana autorizada: registrar consumo o desestimar propia. Se abrió el editor y se verificaron importe 1000, fecha 2026-10-01, cuenta vinculada y selector de categoría; se pulsó Cancelar, nunca Registrar/Desestimar. Compra Rondi en 2x muestra total paid ARS67.890,30, en vez del transaction_amount previo ARS71.355,25; sigue pendiente porque no se habilitó la nueva migración/flag. Settings normal muestra sólo today/30d/90d y Advanced; no se pulsó Continuar.

Esta verificación confirma presentación y gates con evidencia histórica real, no un posting financiero. Duplicados/N/auto-post se verificaron en código y PostgreSQL descartable; funciones nuevas siguen deshabilitadas en la cuenta real. Producción/main y configuración externa MP no cambiaron. El harness Docker recibió seguimiento explícito de roles para que ACL se pruebe en clientes psql independientes; syntax check verde, Docker todavía no disponible para ejecutarlo.


### Cierre adicional 3/oct: prueba nativa en CI

Rama auditada limpia y alineada en 08305d9 antes de cambios. El runtime local no permite cambiar UID/grupos para iniciar PostgreSQL; Docker ausente. Se agrega CI acotado, read-only, sin secretos, sin deploy ni acceso a Supabase: PostgreSQL16 en contenedor descartable para ambos scripts transaccionales y clientes concurrentes. Resultado todavía pendiente al publicar este checkpoint. No se habilitan flags ni se aplican migraciones reales.

CI nativo confirmado verde en commit 89e474c: https://github.com/fortiz1422/Gota/actions/runs/37093037812 . Logs: 23 checks de cuotas +24 de postings, ambos con clientes PostgreSQL concurrentes. Se agrega una carrera explícita manual insert vs auto-post observando el advisory lock del trigger, snapshot anterior y rechazo del importador; resultado de ese refuerzo pendiente. Migraciones/flags siguen sin activar; la matriz financiera real sigue pendiente y no se declara terminado el rollout.


### Cierre verificado de concurrencia

Commit 8f91610: CI https://github.com/fortiz1422/Gota/actions/runs/37093132076 completado success. Logs 23 cuotas +27 postings =50 checks nativos. Carrera manual vs import rechazó snapshot stale sin duplicados. Gate de concurrencia nueva cerrado. Ninguna migración/flag/opt-in real activado, ninguna prueba escribió canon real. El workflow Claude baseline inválido sigue fuera de alcance. Documento de matriz actualizado y handoff final disponible en docs/mercadopago-v2-handoff.md.


### Auditoría de compatibilidad real, 3/oct

Lectura metadata-only de Supabase: expenses.card_id es character varying, mientras cards/card_cycles/review usan UUID. Los harness anteriores habían modelado expenses.card_id como UUID y no cubrían esta diferencia. Corregidas comparaciones de replay (cast a texto de ambos lados, sin cambiar esquema real) en RPC 1x y N. Tests ajustados al tipo desplegado y restricciones observadas de monto/currency/descripción/instrumento/ciclos; CI agrega la suite legacy 1x. No datos de usuarios/tokens consultados; sólo columnas/constraints/migraciones/branches. Branches Supabase: ninguna; migraciones registradas: background e initial import. Nuevas migraciones siguen sin aplicar por límite explícito previo. Resultado CI del fix pendiente.

CI del fix d92df45: run push 37131091286 success, incluidos legacy1x + N + posting contra card_id texto/restricciones observadas. Run PR paralelo falló por readiness del servidor temporal de bootstrap Docker; se corrige conexión host TCP127.0.0.1 dentro del contenedor para esperar servidor final, y concurrency comparte grupo branch entre push/PR evitando duplicar runs. Nunca conexión externa.

Rollout endurecido para DB compartida: migración N añade audit y nuevo RPC, no reemplaza legacy1x. Preview flag de tarjetas envía también1x al motor/función nueva. Test route agregado; test SQL verifica legacy definition intacta y1x/replay en v2. Paquete final de habilitación son tres scripts (N/postings/reconciliation), no el reemplazo legacy. Docs/mercadopago-v2-rollout.md contiene efectos y autorización concreta pendiente. No aplica migraciones ni env automáticamente bajo la restricción previa.

El nuevo test aditivo1x detectó que la validación SQL todavía exigía2..72. Corregida a1..72, manteniendo cantidad exacta contra RAW y motor. Run37131557964 falló por ese guard, no se presenta verde; nuevo CI pendiente.


### Cierre de compatibilidad y habilitación preparada

Commit68a6dc1, CI37131672897 success: 26 checks cuotas +27 postings=53 nativos, más suite legacy1x independiente verde. Verifica RPC legacy intacto al aplicar migración aditiva y1x nuevo idempotente. Suite completa1049/155 verde; tipos/lint focalizado verdes. Vercel deployment dpl_EWJfGPTTeh8w2HnEg35kTscDFtY4 READY para68a6dc1. Deploy previo56155f8 falló, pero el commit final está READY; MCP build logs devolvió tool-not-found, no se inventa causa de ese fallo.

Único siguiente paso concreto: autorización específica para aplicar los tres scripts de docs/mercadopago-v2-rollout.md al proyecto compartido y flags manuales sólo Preview. Se mantiene el límite anterior de no migrar/activar en real hasta esa autorización. Auto-post/background/import y pruebas ledger siguen fuera; no se presenta la habilitación como realizada ni matriz real como aprobada.


### Habilitación autorizada3/oct

Facundo autorizó explícitamente los tres scripts +cuotas/duplicados sóloPreview. Aplicadas en Supabase:20261003162312 mercadopago_v2_additive_card_purchase;20261003162341 mercadopago_v2_audited_postings;20261003162349 mercadopago_v2_reconciliation_state. Verificado hash legacy1x intacto38f84095dc44acbef192ed7012b3c4ac; nuevosRPCs service execute true, anon/auth false; postingsRLStrue; triggerO; tres campos nuevos presentes. Conexión scoped conserva backgroundfalse/autopostfalse/importnot_started. Sin filas de canon modificadas como prueba.

ConectorVercel disponible no incluye env mutation/CLI autenticada. Alternativa revisable autorizada: next.config.env usa helper failclosed únicamente VERCEL_ENV=preview +rama exacta feat/mercadopago-integration-v2. Dos flags manualestrue y auto/background/reconciliationfalse. No variables secretas ni cambioDashboard/production. Cuatro tests de alcance aprobados; tipos/lint/diffcheck verdes. Publicación/Preview/browser verification pendientes en este checkpoint.


### Resultado de habilitación Preview

Commit f5b81c6, deployment dpl_7cymQEtiFf1mXVjKMjkpaTLuBzuf READY. Buildlocal con metadataPreview +flag mapping terminósuccess sin uploadsSentry. Browser autenticado:40pending,30completables/10excepciones (antes27/13); Rondi2x abreeditor total67890.30,fecha10ago,2cuotas provider locked, tarjeta sinmatchnoautoelegida. Cancelado. PAYOUTS1000 editorcancelado también. No Registrar/Continuar/Desestimar. GET API directo en navegador bloqueado ERR_BLOCKED_BY_CLIENT; no se usa fetch alternativo ni se afirma dedupeHTTPvalidado. UI disponible y tab marcado deliverable.

Tres migraciones reales autorizadas/aplicadas y ACL/hash/RLS/triggerverificados; ningún gasto/compromiso real se escribió como test. La base es compartida: schema sí cambió según autorización, mainRPC no. Auto/background/import siguenapagados. Ver detalles actuales en rollout.md; no pedir otra vez permiso ya concedido para esas acciones. Matrizledger/compromisosreal,auto-post y promoción siguen pendientes fuera de esta autorización.


### Estado definitivo después de la autorización

La habilitación manual de Preview está ejecutada. El detalle actual y legible está en docs/mercadopago-v2-rollout.md, que reemplaza los checkpoints anteriores que decían migraciones pendientes. Tres migraciones aplicadas; RPC legacy intacto; nuevos RPCs service-only; RLS y trigger verificados. Preview f5b81c6 READY. Cuatro tests nuevos de alcance, tipos, lint y build con metadata Preview aprobados. Editor Rondi de dos cuotas abierto/cancelado; no match de tarjeta inventado. Lectura posterior scoped: cero postings y cero confirmaciones desde rollout, background y auto-post false, import not_started. La navegación directa al GET de duplicados fue bloqueada en el navegador; no validación HTTP ni link real. No repetir la solicitud de permiso de esta habilitación ya autorizada y completada.
